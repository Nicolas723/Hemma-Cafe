import { addDoc, deleteDoc, doc, getDocs, increment, limit, query, setDoc, updateDoc, where, writeBatch, Timestamp } from "firebase/firestore";
import { toDate } from "../lib/format";
import { transactionItems } from "../lib/pricing";
import { logAudit } from "../lib/audit";
import { formatCurrency } from "../lib/format";
import { isSameDay, startOfDay, endOfDay } from "../lib/dates";

const BATCH_LIMIT = 400;
export const OTRO_PRODUCT = { name: "Otro", price: 0, quantity: 999999, categoryId: "", isPriceFlexible: true }; // Firestore admite 500 operaciones por lote; dejamos margen.

/**
 * Ejecuta operaciones en lotes de máximo 400 (Firestore falla con más de 500).
 * No espera al servidor: los lotes quedan aplicados en el equipo al instante y
 * se sincronizan solos (sin internet, o en la demo, esperar dejaría la UI colgada).
 */
function commitInChunks(db, ops, onError) {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
        batch.commit().catch(onError);
    }
}

/** Escritura "optimista": la UI no espera al servidor (clave con internet inestable). */
function fireAndForget(promise, notify, message) {
    promise.catch((err) => {
        console.error(message, err);
        notify(`${message}. Quedó guardado en este equipo y se reintentará.`, "warning");
    });
}

/** Agrupa cantidades por producto (varias líneas "Otro" comparten id). */
function quantitiesByProduct(lines) {
    const map = new Map();
    for (const l of lines) map.set(l.id, (map.get(l.id) || 0) + (l.cartQuantity || 0));
    return map;
}

export function createActions({ db, col, getData, getUser, notify }) {
    const logError = (err) => console.error("Error al guardar:", err);
    const ref = (name, id) => doc(col(name), id);
    const audit = (type, action, detail) => logAudit(db, getUser(), type, action, detail);
    const userName = () => getUser()?.displayName || "";
    const productName = (id) => getData().productsById[id]?.name || "Producto";

    // Los +/- de stock se agrupan: un clic por unidad no debe llenar el registro.
    const pendingStock = new Map();
    let stockTimer = null;
    const queueStockAudit = (id, delta) => {
        pendingStock.set(id, (pendingStock.get(id) || 0) + delta);
        clearTimeout(stockTimer);
        stockTimer = setTimeout(() => {
            pendingStock.forEach((d, pid) => d && audit("stock", "Ajustó stock", `${productName(pid)}: ${d > 0 ? "+" : ""}${d}`));
            pendingStock.clear();
        }, 4000);
    };

    /** Descuenta (o devuelve) stock con increment(): seguro offline y con varios equipos. */
    const adjustStock = (batch, qtyById, sign) => {
        const { productsById } = getData();
        qtyById.forEach((qty, id) => {
            if (qty && productsById[id]) batch.update(ref("products", id), { quantity: increment(sign * qty) });
        });
    };

    return {
        // ───────────────────────── Caja ─────────────────────────
        checkout({ order, customerName, vendedorName, payments, notes }) {
            const { productsById } = getData();
            const primary = payments[0]?.method || "Efectivo";
            const tag = primary === "Servicio" ? "(Cortesía)" : order.hasCustom ? "(Descuento personalizado)" : "";
            const finalNotes = [notes, tag].filter(Boolean).join(" ");

            const txRef = doc(col("transactions"));
            const transaction = {
                date: new Date(),
                customerName: customerName || "General",
                vendedorName,
                paymentMethod: primary,
                payments,
                notes: finalNotes,
                total: order.total,
                items: transactionItems(order, productsById),
                registeredBy: userName(),
            };
            const batch = writeBatch(db);
            batch.set(txRef, transaction);
            adjustStock(batch, quantitiesByProduct(order.lines), -1);
            fireAndForget(batch.commit(), notify, "La venta no se sincronizó aún");
            if (primary === "Servicio") audit("sale", "Registró una cortesía", `${formatCurrency(order.subtotal)} en productos · ${customerName || "General"}`);
            else if (order.hasCustom) audit("sale", "Aplicó un descuento", `${formatCurrency(order.subtotal)} → ${formatCurrency(order.total)} · ${customerName || "General"}`);
            return { id: txRef.id, ...transaction };
        },

        saveLoan({ order, customer, vendedorName, notes }) {
            const now = new Date();
            const { productsById } = getData();
            const items = order.lines.map((l) => ({
                id: l.id,
                name: l.name,
                ...(productsById[l.id]?.cost > 0 ? { cost: productsById[l.id].cost } : {}),
                price: l.cartQuantity > 0 ? l.subtotal / l.cartQuantity : l.unit,
                cartQuantity: l.cartQuantity,
                subtotal: l.subtotal,
                dateAdded: now.toISOString(),
            }));
            const batch = writeBatch(db);
            batch.set(doc(col("loans")), {
                customerId: customer.id,
                customerName: customer.name,
                vendedorName,
                items,
                notes: notes || "",
                date: now,
                createdAt: now,
                lastUpdated: now,
                status: "pending",
                registeredBy: userName(),
            });
            adjustStock(batch, quantitiesByProduct(order.lines), -1);
            fireAndForget(batch.commit(), notify, "El crédito no se sincronizó aún");
        },

        /**
         * Abono a uno o varios créditos en UNA sola transacción.
         * plans: ver lib/loans.js (planFromPicks = por productos, planFromAmount = por monto).
         */
        payLoans({ plans, payments, vendedorName }) {
            const batch = writeBatch(db);
            const now = new Date();
            const paidItems = plans.flatMap((p) => p.paidItems);
            for (const { loan, remaining } of plans) {
                const loanRef = ref("loans", loan.id);
                if (remaining.length === 0) batch.delete(loanRef);
                else batch.update(loanRef, { items: remaining, lastUpdated: now });
            }
            const total = paidItems.reduce((s, i) => s + (i.subtotal || 0), 0);
            const customerName = plans[0]?.loan.customerName || "General";
            batch.set(doc(col("transactions")), {
                date: now,
                customerName,
                vendedorName,
                paymentMethod: payments[0]?.method || "Efectivo",
                payments,
                total,
                items: paidItems,
                type: "abono",
                loanId: plans[0]?.loan.id || null,
                loanIds: plans.map((p) => p.loan.id),
                notes: `Abono a crédito de ${customerName}`,
                registeredBy: userName(),
            });
            fireAndForget(batch.commit(), notify, "El abono no se sincronizó aún");
            return total;
        },

        removeLoanItem(loan, index) {
            const removed = loan.items?.[index];
            if (removed) audit("loan", "Quitó un producto de un crédito sin cobrarlo", `${loan.customerName}: ${removed.cartQuantity} × ${removed.name}`);
            const remaining = (loan.items || []).filter((_, i) => i !== index);
            const loanRef = ref("loans", loan.id);
            const p = remaining.length === 0 ? deleteDoc(loanRef) : updateDoc(loanRef, { items: remaining, lastUpdated: new Date() });
            fireAndForget(p, notify, "El cambio del crédito no se sincronizó aún");
        },

        // ──────────────────────── Historial ────────────────────────
        updateTransaction(transaction, newItems, payments) {
            const batch = writeBatch(db);
            const txRef = ref("transactions", transaction.id);
            const total = newItems.reduce((s, i) => s + (i.subtotal ?? i.price * (i.cartQuantity || 1)), 0);

            if (newItems.length === 0) {
                batch.delete(txRef);
            } else {
                const fixedPayments =
                    payments && payments.length > 1
                        ? payments.map((p) => ({ method: p.method, amount: Number(p.amount) || 0 }))
                        : [{ method: payments?.[0]?.method || transaction.paymentMethod || "Efectivo", amount: total }];
                batch.update(txRef, {
                    items: newItems,
                    total,
                    payments: fixedPayments,
                    paymentMethod: fixedPayments[0].method,
                    lastUpdated: new Date(),
                });
            }

            // Los abonos no movieron stock al registrarse, así que tampoco al editarse.
            if (transaction.type !== "abono") {
                const diff = quantitiesByProduct(transaction.items || []);
                quantitiesByProduct(newItems).forEach((q, id) => diff.set(id, (diff.get(id) || 0) - q));
                adjustStock(batch, diff, 1);
            }
            fireAndForget(batch.commit(), notify, "La edición no se sincronizó aún");
            audit(
                "sale",
                newItems.length === 0 ? "Anuló una venta" : "Editó una venta",
                `${transaction.customerName || "General"} · ${formatCurrency(transaction.total)}${newItems.length ? ` → ${formatCurrency(total)}` : ""}`
            );
            notify(newItems.length === 0 ? "Venta eliminada" : "Venta actualizada", "success");
        },

        /** Carga ventas antiguas (fuera de la ventana en vivo) para el historial. */
        async loadTransactionsRange(start, end) {
            const s = start ? startOfDay(start) : new Date(2000, 0, 1);
            const e = end ? endOfDay(end) : new Date();
            const snap = await getDocs(query(col("transactions"), where("date", ">=", Timestamp.fromDate(s)), where("date", "<=", Timestamp.fromDate(e))));
            return snap.docs.map(normalizeTransaction);
        },

        // ──────────────────────── Inventario ────────────────────────
        addProduct(data) {
            fireAndForget(addDoc(col("products"), { ...data, createdAt: new Date() }), notify, "El producto no se sincronizó aún");
            audit("stock", "Creó un producto", `${data.name} · ${formatCurrency(data.price)}`);
        },
        updateProduct(id, data) {
            const before = getData().productsById[id];
            fireAndForget(updateDoc(ref("products", id), { ...data, lastUpdated: new Date() }), notify, "El producto no se sincronizó aún");
            const changes = [];
            if (before && before.price !== data.price) changes.push(`precio ${formatCurrency(before.price)} → ${formatCurrency(data.price)}`);
            if (before && (before.quantity || 0) !== data.quantity) changes.push(`stock ${before.quantity || 0} → ${data.quantity}`);
            if (before && before.name !== data.name) changes.push(`antes «${before.name}»`);
            audit("stock", "Editó un producto", `${data.name}${changes.length ? ` · ${changes.join(", ")}` : ""}`);
        },
        adjustProductStock(id, delta) {
            fireAndForget(updateDoc(ref("products", id), { quantity: increment(delta) }), notify, "El stock no se sincronizó aún");
            queueStockAudit(id, delta);
        },

        /** Llegada de mercancía: suma stock y deja constancia (colección stockEntries). */
        registerStockEntry({ lines, note }) {
            const valid = lines.filter((l) => l.qty > 0 && getData().productsById[l.id]);
            if (!valid.length) return false;
            const batch = writeBatch(db);
            valid.forEach((l) => batch.update(ref("products", l.id), { quantity: increment(l.qty) }));
            batch.set(doc(col("stockEntries")), {
                date: new Date(),
                items: valid.map((l) => ({ id: l.id, name: productName(l.id), qty: l.qty })),
                units: valid.reduce((s, l) => s + l.qty, 0),
                note: note || "",
                registeredBy: userName(),
            });
            fireAndForget(batch.commit(), notify, "La entrada no se sincronizó aún");
            audit("stock", "Registró una llegada de mercancía", valid.map((l) => `${productName(l.id)} +${l.qty}`).join(", ") + (note ? ` · ${note}` : ""));
            return true;
        },

        async deleteProduct(id) {
            const { promotions } = getData();
            const batch = writeBatch(db);
            batch.delete(ref("products", id));
            promotions.filter((p) => p.productId === id).forEach((p) => batch.delete(ref("promotions", p.id)));
            fireAndForget(batch.commit(), notify, "La eliminación no se sincronizó aún");
            audit("stock", "Eliminó un producto", productName(id));
            notify("Producto eliminado", "success");
        },

        addCategory: (name) => fireAndForget(addDoc(col("categories"), { name: name.trim(), createdAt: new Date() }), notify, "La categoría no se sincronizó aún"),
        deleteCategory(id) {
            const name = getData().categories.find((c) => c.id === id)?.name || "";
            fireAndForget(deleteDoc(ref("categories", id)), notify, "La eliminación no se sincronizó aún");
            audit("stock", "Eliminó una categoría", name);
        },
        addPromotion: (promo) => fireAndForget(addDoc(col("promotions"), promo), notify, "La promoción no se sincronizó aún"),
        deletePromotion(id) {
            const promo = getData().promotions.find((p) => p.id === id);
            fireAndForget(deleteDoc(ref("promotions", id)), notify, "La eliminación no se sincronizó aún");
            audit("stock", "Eliminó una promoción", promo ? productName(promo.productId) : "");
        },

        async importProducts(rows) {
            const { products, categories } = getData();
            const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
            const prodByName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p.id]));
            const ops = [];
            let created = 0;
            let updated = 0;
            const num = (v) => (v === undefined || v === null || v === "" ? null : parseFloat(v));

            for (const row of rows) {
                const name = String(row.Nombre || "").trim();
                if (!name) continue;
                const catName = String(row["Categoría"] || row.Categoria || "General").trim();
                let categoryId = catByName.get(catName.toLowerCase());
                if (!categoryId) {
                    const catRef = doc(col("categories"));
                    categoryId = catRef.id;
                    catByName.set(catName.toLowerCase(), categoryId);
                    ops.push((b) => b.set(catRef, { name: catName, createdAt: new Date() }));
                }
                const data = {
                    name,
                    price: num(row.Precio) || 0,
                    quantity: parseInt(row.Cantidad || 0, 10) || 0,
                    specialPrice: num(row["Precio Especial"]),
                    ...(num(row.Costo) ? { cost: num(row.Costo) } : {}),
                    wholesalePrice: num(row["Precio Mayorista"]),
                    categoryId,
                    lastUpdated: new Date(),
                };
                const existingId = prodByName.get(name.toLowerCase());
                if (existingId) {
                    ops.push((b) => b.update(ref("products", existingId), data));
                    updated++;
                } else {
                    const pRef = doc(col("products"));
                    prodByName.set(name.toLowerCase(), pRef.id);
                    ops.push((b) => b.set(pRef, { ...data, image: "", createdAt: new Date() }));
                    created++;
                }
            }
            commitInChunks(db, ops, logError);
            audit("stock", "Importó productos desde Excel", `${created} nuevos, ${updated} actualizados`);
            return { created, updated };
        },

        // ──────────────────────── Ajustes ────────────────────────
        addCustomer(name, priceType) {
            if (getData().customers.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())) {
                notify("Ya existe un cliente con ese nombre", "warning");
                return false;
            }
            fireAndForget(addDoc(col("customers"), { name: name.trim(), priceType }), notify, "El cliente no se sincronizó aún");
            return true;
        },
        updateCustomer: (id, data) => fireAndForget(updateDoc(ref("customers", id), data), notify, "El cliente no se sincronizó aún"),
        deleteCustomer(id) {
            const name = getData().customers.find((c) => c.id === id)?.name || "";
            fireAndForget(deleteDoc(ref("customers", id)), notify, "La eliminación no se sincronizó aún");
            audit("settings", "Eliminó un cliente", name);
        },
        addVendedor(name) {
            if (getData().vendedores.some((v) => v.name.trim().toLowerCase() === name.trim().toLowerCase())) {
                notify("Ya existe un vendedor con ese nombre", "warning");
                return false;
            }
            fireAndForget(addDoc(col("vendedores"), { name: name.trim() }), notify, "El vendedor no se sincronizó aún");
            return true;
        },
        deleteVendedor(id) {
            const name = getData().vendedores.find((v) => v.id === id)?.name || "";
            fireAndForget(deleteDoc(ref("vendedores", id)), notify, "La eliminación no se sincronizó aún");
            audit("settings", "Eliminó un vendedor", name);
        },

        addPaymentMethod({ name, emoji }) {
            const { paymentMethods } = getData();
            const clean = name.trim();
            if (paymentMethods.some((pm) => pm.name.trim().toLowerCase() === clean.toLowerCase())) {
                notify("Ese método de pago ya existe", "error");
                return false;
            }
            const order = Math.max(0, ...paymentMethods.map((p) => p.order || 0)) + 1;
            fireAndForget(addDoc(col("paymentMethods"), { name: clean, emoji, order }), notify, "El método no se sincronizó aún");
            audit("settings", "Creó un método de pago", clean);
            return true;
        },
        deletePaymentMethod(id) {
            const name = getData().paymentMethods.find((m) => m.id === id)?.name || "";
            fireAndForget(deleteDoc(ref("paymentMethods", id)), notify, "La eliminación no se sincronizó aún");
            audit("settings", "Eliminó un método de pago", name);
        },

        /** Borra TODOS los documentos de una colección (no solo los cargados en memoria). */
        async resetCollection(name) {
            const snap = await getDocs(col(name));
            commitInChunks(db, snap.docs.map((d) => (b) => b.delete(d.ref)), logError);
            audit("settings", "Borró un historial completo", `${name}: ${snap.size} registros`);
            return snap.size;
        },

        // ──────────────────────── Cierre de caja ────────────────────────
        /** Si ya hay cierres hoy, se unen en uno solo (y se limpian duplicados). */
        savePerformance(data) {
            const { performanceLogs } = getData();
            audit("closing", "Hizo el cierre de caja", `Contado ${formatCurrency(data.realTotal)} · diferencia ${formatCurrency(data.difference)}`);
            const todays = performanceLogs.filter((l) => isSameDay(l.date, new Date()));
            if (todays.length === 0) {
                fireAndForget(addDoc(col("dailyPerformance"), { ...data, date: new Date() }), notify, "El cierre no se sincronizó aún");
                return "created";
            }
            const [target, ...others] = todays;
            const merged = [...others, data].reduce(mergePerformance, {
                expectedTotal: target.expectedTotal || 0,
                realTotal: target.realTotal || 0,
                difference: target.difference || 0,
                productsSold: target.productsSold || 0,
                notes: target.notes || "",
                diffMethod: target.diffMethod || null,
                paymentMethodTotals: { ...(target.paymentMethodTotals || {}) },
                perMethodStats: JSON.parse(JSON.stringify(target.perMethodStats || {})),
                cashOutsTotal: target.cashOutsTotal || 0,
                cashOuts: target.cashOuts || [],
                cashBase: target.cashBase || 0,
            });
            const batch = writeBatch(db);
            others.forEach((o) => batch.delete(ref("dailyPerformance", o.id)));
            batch.update(ref("dailyPerformance", target.id), { ...merged, date: new Date() });
            fireAndForget(batch.commit(), notify, "El cierre no se sincronizó aún");
            return "merged";
        },

        /** Salida de efectivo de la caja (pago a proveedor, insumos…). Se descuenta en el cierre. */
        addCashOut({ amount, concept }) {
            fireAndForget(addDoc(col("cashOuts"), { date: new Date(), amount, concept, registeredBy: userName() }), notify, "La salida no se sincronizó aún");
            audit("closing", "Registró una salida de caja", `${formatCurrency(amount)} · ${concept}`);
        },
        deleteCashOut(out) {
            fireAndForget(deleteDoc(ref("cashOuts", out.id)), notify, "La eliminación no se sincronizó aún");
            audit("closing", "Eliminó una salida de caja", `${formatCurrency(out.amount)} · ${out.concept}`);
        },

        deletePerformanceLog(id) {
            const log = getData().performanceLogs.find((l) => l.id === id);
            fireAndForget(deleteDoc(ref("dailyPerformance", id)), notify, "La eliminación no se sincronizó aún");
            audit("closing", "Eliminó un cierre de caja", log ? `${toDate(log.date).toLocaleDateString("es-CO")} · ${formatCurrency(log.realTotal)}` : "");
        },

        // ──────────────────────── Siembra inicial ────────────────────────
        /** IDs fijos: aunque se ejecute dos veces (offline), no crea duplicados. */
        seedPaymentMethods: (defaults) => commitInChunks(db, defaults.map(({ id, ...pm }) => (b) => b.set(ref("paymentMethods", id), pm)), logError),
        seedOtroProduct: () => setDoc(ref("products", "otro"), OTRO_PRODUCT).catch(logError),
        dedupePaymentMethods(duplicates) {
            const batch = writeBatch(db);
            duplicates.forEach((id) => batch.delete(ref("paymentMethods", id)));
            batch.commit().catch(logError);
        },
        /**
         * Convierte a Timestamp las fechas guardadas como texto (la versión 1.x
         * guardaba así los abonos). Con todo en un solo formato basta una consulta.
         * Se ejecuta al abrir la app y solo toca los documentos que aún lo necesitan.
         */
        async migrateStringDates() {
            const snap = await getDocs(query(col("transactions"), where("date", ">=", ""), limit(400)));
            const ops = [];
            snap.docs.forEach((d) => {
                const date = new Date(d.data().date);
                if (!Number.isNaN(date.getTime())) ops.push((b) => b.update(d.ref, { date: Timestamp.fromDate(date) }));
            });
            commitInChunks(db, ops, logError);
            return ops.length;
        },

        /**
         * Restaura una copia de seguridad (ver lib/backup.js → readBackupFile).
         * Agrega o reemplaza cada documento por su id; no borra lo creado después de la copia.
         */
        restoreBackup(data) {
            const ops = [];
            Object.entries(data).forEach(([name, docs]) => docs.forEach(({ id, ...rest }) => ops.push((b) => b.set(ref(name, id), rest))));
            commitInChunks(db, ops, logError);
            audit("settings", "Restauró una copia de seguridad", `${ops.length} registros`);
            return ops.length;
        },

        /** Carga un conjunto de datos de golpe (solo la demo, que vive en memoria). */
        loadDataset(dataset) {
            const ops = [];
            Object.entries(dataset).forEach(([name, docs]) => docs.forEach(({ id, ...data }) => ops.push((b) => b.set(id ? ref(name, id) : doc(col(name)), data))));
            commitInChunks(db, ops, logError);
        },
    };
}

function mergePerformance(acc, log) {
    acc.expectedTotal += log.expectedTotal || 0;
    acc.realTotal += log.realTotal || 0;
    acc.difference += log.difference || 0;
    acc.productsSold += log.productsSold || 0;
    acc.cashOutsTotal = (acc.cashOutsTotal || 0) + (log.cashOutsTotal || 0);
    acc.cashOuts = [...(acc.cashOuts || []), ...(log.cashOuts || [])];
    if (log.cashBase !== undefined) acc.cashBase = log.cashBase;
    if (log.closedBy) acc.closedBy = log.closedBy;
    if (log.notes) acc.notes = acc.notes ? `${acc.notes} | ${log.notes}` : log.notes;
    if (log.diffMethod) acc.diffMethod = log.diffMethod;
    Object.entries(log.paymentMethodTotals || {}).forEach(([m, v]) => {
        acc.paymentMethodTotals[m] = (acc.paymentMethodTotals[m] || 0) + v;
    });
    Object.entries(log.perMethodStats || {}).forEach(([m, s]) => {
        const cur = acc.perMethodStats[m] || { expected: 0, real: 0, diff: 0 };
        acc.perMethodStats[m] = {
            expected: (cur.expected || 0) + (s.expected || 0),
            real: (cur.real || 0) + (s.real || 0),
            diff: (cur.diff || 0) + (s.diff || 0),
        };
    });
    return acc;
}

/** Fechas mezcladas (Timestamp / string ISO) → siempre string ISO en memoria. */
export function normalizeTransaction(d) {
    const data = d.data();
    const date = toDate(data.date);
    return { id: d.id, ...data, date: Number.isNaN(date.getTime()) ? null : date.toISOString() };
}

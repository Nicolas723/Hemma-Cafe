/**
 * Filtros y filas de las descargas a Excel (Cierre, Ventas, Créditos, Inventario).
 * Todo es puro: las pantallas solo arman los filtros y llaman a exportWorkbook.
 */
import { formatTime, toDate } from "./format";
import { inRange, toInputDate } from "./dates";
import { isFlexible } from "./pricing";
import { LOW_STOCK } from "./inventory";
import { itemOutstanding } from "./loans";

export const paymentsOf = (t) => (t.payments?.length ? t.payments : [{ method: t.paymentMethod || "Efectivo", amount: t.total || 0 }]);
const unitsOf = (t) => (t.items || []).reduce((s, i) => s + (i.partial ? 0 : i.cartQuantity || 1), 0);
const day = (d) => toDate(d).toLocaleDateString("es-CO");

/** Parte del nombre del archivo según el rango: "2026-11-01_a_2026-11-12", "2026-11-12" o "todo". */
export function rangeTag([start, end], now = new Date()) {
    if (!start && !end) return "todo";
    const a = toInputDate(start || end);
    const b = toInputDate(end || now);
    return a === b ? a : `${a}_a_${b}`;
}

/** Nombre de archivo seguro (sin caracteres que Windows no acepta). */
export const safeFileName = (s) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");

// ─── Cierres ───────────────────────────────────────────────

export function filterClosings(logs, { range, onlyDiff = false }) {
    return logs.filter((l) => inRange(l.date, range) && (!onlyDiff || (l.difference || 0) !== 0));
}

export function closingSheet(logs, methodNames = []) {
    const names = new Set(methodNames);
    logs.forEach((l) => Object.keys(l.perMethodStats || l.paymentMethodTotals || {}).forEach((m) => names.add(m)));
    const list = [...names];
    return {
        name: "Cierres",
        columns: [
            { header: "Fecha", key: "fecha", width: 12 },
            { header: "Hora", key: "hora", width: 9 },
            { header: "Cerró", key: "cerro", width: 16 },
            { header: "Productos", key: "productos", width: 10 },
            { header: "Esperado", key: "esperado", money: true },
            { header: "Real", key: "real", money: true },
            { header: "Diferencia", key: "dif", money: true },
            ...list.map((m) => ({ header: m, key: `m_${m}`, money: true })),
            { header: "Diferencia en", key: "difm", width: 14 },
            { header: "Base de caja", key: "base", money: true },
            { header: "Salidas", key: "salidas", money: true },
            { header: "Notas", key: "notas", width: 30 },
        ],
        rows: logs.map((l) => ({
            fecha: day(l.date),
            hora: formatTime(toDate(l.date)),
            cerro: l.closedBy || "",
            productos: l.productsSold || 0,
            esperado: l.expectedTotal || 0,
            real: l.realTotal || 0,
            dif: l.difference || 0,
            difm: l.diffMethod || "",
            base: l.cashBase || 0,
            salidas: l.cashOutsTotal || 0,
            notas: l.notes || "",
            ...Object.fromEntries(list.map((m) => [`m_${m}`, l.perMethodStats?.[m]?.real ?? l.paymentMethodTotals?.[m] ?? 0])),
        })),
    };
}

// ─── Ventas ────────────────────────────────────────────────

export const SALE_KINDS = [
    { value: "sale", label: "Ventas" },
    { value: "order", label: "Pedidos entregados" },
    { value: "abono", label: "Abonos" },
    { value: "anticipo", label: "Anticipos" },
];
const KIND_LABEL = { sale: "Venta", order: "Pedido", abono: "Abono crédito", anticipo: "Anticipo pedido" };

export function saleKind(t) {
    if (t.type === "anticipo") return "anticipo";
    if (t.type === "abono") return "abono";
    return t.orderId ? "order" : "sale";
}

/** kinds: lista de tipos a incluir (vacía o ausente = todos). */
export function filterSales(txs, { range, vendedor = "", method = "", kinds, onlyNotes = false, query = "" }) {
    const q = query.trim().toLowerCase();
    return txs.filter((t) => {
        if (!inRange(t.date, range)) return false;
        if (kinds?.length && !kinds.includes(saleKind(t))) return false;
        if (vendedor && t.vendedorName !== vendedor) return false;
        if (method && !paymentsOf(t).some((p) => p.method === method)) return false;
        if (onlyNotes && !t.notes) return false;
        if (q && !(t.items || []).some((i) => i.name?.toLowerCase().includes(q)) && !t.customerName?.toLowerCase().includes(q)) return false;
        return true;
    });
}

/** Detalle por producto: una fila por cada producto vendido (como siempre). */
export function salesDetailSheet(txs, { products = [], categories = [] } = {}) {
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const rows = [];
    txs.forEach((t) => {
        const d = toDate(t.date);
        const pays = paymentsOf(t);
        const base = { fecha: day(d), hora: formatTime(d), tipo: KIND_LABEL[saleKind(t)], vendedor: t.vendedorName || "N/A", cliente: t.customerName || "General", pago1: pays[0]?.method || "", pago2: pays[1]?.method || "" };
        // El anticipo no tiene productos: una fila para que el dinero cuadre en el Excel.
        if (t.type === "anticipo" || !(t.items || []).length) {
            rows.push({ ...base, producto: t.type === "anticipo" ? "Anticipo" : "", categoria: "", original: null, cantidad: 0, descuento: 0, subtotal: t.total || 0, total: t.total || 0, notas: t.notes || "" });
            return;
        }
        t.items.forEach((item, idx) =>
            rows.push({
                ...base,
                producto: item.name,
                categoria: catById[productById[item.id]?.categoryId] || "Sin categoría",
                original: item.originalPrice ?? item.price,
                cantidad: item.partial ? 0 : item.cartQuantity || 1,
                descuento: item.discount || 0,
                subtotal: item.subtotal ?? item.price * (item.cartQuantity || 1),
                total: idx === 0 ? t.total : null,
                notas: idx === 0 ? t.notes || "" : "",
            })
        );
    });
    return {
        name: "Ventas",
        columns: [
            { header: "Fecha", key: "fecha", width: 12 },
            { header: "Hora", key: "hora", width: 9 },
            { header: "Tipo", key: "tipo", width: 14 },
            { header: "Vendedor", key: "vendedor", width: 16 },
            { header: "Cliente", key: "cliente", width: 18 },
            { header: "Producto", key: "producto", width: 26 },
            { header: "Categoría", key: "categoria", width: 16 },
            { header: "Precio original", key: "original", money: true },
            { header: "Cantidad", key: "cantidad", width: 9 },
            { header: "Descuento", key: "descuento", money: true },
            { header: "Subtotal", key: "subtotal", money: true },
            { header: "Total venta", key: "total", money: true },
            { header: "Pago 1", key: "pago1", width: 12 },
            { header: "Pago 2", key: "pago2", width: 12 },
            { header: "Notas", key: "notas", width: 30 },
        ],
        rows,
    };
}

/** Una fila por venta, con una columna de dinero por método de pago (para cuadrar). */
export function salesSummarySheet(txs, methodNames = []) {
    const names = new Set(methodNames);
    txs.forEach((t) => paymentsOf(t).forEach((p) => names.add(p.method)));
    const list = [...names];
    return {
        name: "Ventas",
        columns: [
            { header: "Fecha", key: "fecha", width: 12 },
            { header: "Hora", key: "hora", width: 9 },
            { header: "Tipo", key: "tipo", width: 14 },
            { header: "Vendedor", key: "vendedor", width: 16 },
            { header: "Cliente", key: "cliente", width: 18 },
            { header: "Productos", key: "unidades", width: 10 },
            { header: "Detalle", key: "detalle", width: 40 },
            { header: "Total", key: "total", money: true },
            ...list.map((m) => ({ header: m, key: `m_${m}`, money: true })),
            { header: "Notas", key: "notas", width: 30 },
        ],
        rows: txs.map((t) => {
            const d = toDate(t.date);
            const byMethod = {};
            paymentsOf(t).forEach((p) => (byMethod[p.method] = (byMethod[p.method] || 0) + (p.amount || 0)));
            return {
                fecha: day(d),
                hora: formatTime(d),
                tipo: KIND_LABEL[saleKind(t)],
                vendedor: t.vendedorName || "N/A",
                cliente: t.customerName || "General",
                unidades: unitsOf(t),
                detalle: t.type === "anticipo" ? "Anticipo" : (t.items || []).map((i) => (i.partial ? `Abono a ${i.name}` : `${i.cartQuantity || 1}× ${i.name}`)).join(", "),
                total: t.total || 0,
                notas: t.notes || "",
                ...Object.fromEntries(list.map((m) => [`m_${m}`, byMethod[m] || null])),
            };
        }),
    };
}

// ─── Créditos ──────────────────────────────────────────────

export const loanDate = (loan) => toDate(loan.date || loan.lastUpdated || loan.createdAt);
const loanCustomerKey = (loan) => loan.customerId || "sin-cliente";

export function filterLoans(loans, { range, customer = "" }) {
    return loans.filter((l) => inRange(loanDate(l), range) && (!customer || loanCustomerKey(l) === customer));
}

/** Clientes que tienen créditos, para el selector: [{ value, label }]. */
export function loanCustomers(loans) {
    const map = new Map();
    loans.forEach((l) => map.set(loanCustomerKey(l), l.customerName || "Sin nombre"));
    return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function loansSheet(loans) {
    const rows = [];
    [...loans]
        .sort((a, b) => (a.customerName || "").localeCompare(b.customerName || "", "es") || loanDate(a) - loanDate(b))
        .forEach((loan) => {
            const d = loanDate(loan);
            (loan.items || []).forEach((item) =>
                rows.push({
                    cliente: loan.customerName,
                    fecha: day(d),
                    hora: formatTime(d),
                    producto: item.name,
                    cantidad: item.cartQuantity,
                    precio: item.price,
                    subtotal: item.price * item.cartQuantity,
                    abonado: item.paid || 0,
                    debe: itemOutstanding(item),
                    notas: loan.notes || "",
                })
            );
        });
    return {
        name: "Créditos",
        columns: [
            { header: "Cliente", key: "cliente", width: 25 },
            { header: "Fecha", key: "fecha", width: 14 },
            { header: "Hora", key: "hora", width: 10 },
            { header: "Producto", key: "producto", width: 30 },
            { header: "Cantidad", key: "cantidad", width: 10 },
            { header: "Precio unit.", key: "precio", money: true },
            { header: "Subtotal", key: "subtotal", money: true },
            { header: "Abonado", key: "abonado", money: true },
            { header: "Debe", key: "debe", money: true },
            { header: "Notas", key: "notas", width: 30 },
        ],
        rows,
    };
}

// ─── Inventario ────────────────────────────────────────────

export const isLowStock = (p) => !isFlexible(p) && (p.quantity || 0) <= LOW_STOCK;

export function filterInventory(products, { category = "", lowOnly = false }) {
    return products.filter((p) => !isFlexible(p) && (!category || p.categoryId === category) && (!lowOnly || isLowStock(p)));
}


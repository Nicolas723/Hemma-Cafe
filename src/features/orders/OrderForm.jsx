import { useMemo, useRef, useState } from "react";
import { ClipboardList, Bike, ShoppingBag, Plus, Minus, Trash2, UserPlus, X, PencilLine, Ban, Save, Coins, Pencil, Check } from "lucide-react";
import BirthdayInput from "../../components/BirthdayInput";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { ChipGroup, Field, Modal, MoneyInput, SearchInput } from "../../components/ui";
import { DEFAULT_PAYMENT_METHODS, SERVICE_METHOD } from "../../lib/paymentIcons";
import { PRICE_TYPES, isFlexible, lineSubtotal, liveLine, promoMap, unitPrice } from "../../lib/pricing";
import { formatCurrency } from "../../lib/format";
import { addDays } from "../../lib/dates";
import { dayKey, orderMoney } from "../../lib/orders";

const KINDS = [
    { value: "pickup", label: "Recoger", icon: <ShoppingBag size={15} /> },
    { value: "delivery", label: "Domicilio", icon: <Bike size={15} /> },
];

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

/** Líneas del formulario: producto del catálogo (precio vivo) o con precio fijo (ya acordado / especial). */
const fromOrderItems = (items = []) =>
    items.map((i) => ({
        key: newKey(),
        id: i.id || null,
        name: i.name,
        qty: i.cartQuantity || 1,
        // Lo ya acordado se respeta: precio fijo.
        fixedPrice: i.cartQuantity > 0 && i.subtotal !== undefined ? i.subtotal / i.cartQuantity : Number(i.price) || 0,
        custom: !i.id,
    }));

/**
 * Crear o editar un pedido. `order` = null → nuevo (con `defaultDate` "AAAA-MM-DD").
 */
export default function OrderForm({ order = null, defaultDate, onClose }) {
    const { customers, products, productsById, promotions, paymentMethods, actions } = useData();
    const { showToast, showConfirm } = useUi();
    const { can, sessionUser } = useAuth();
    const editing = Boolean(order);
    const methods = (paymentMethods.length ? paymentMethods : DEFAULT_PAYMENT_METHODS).filter((m) => m.name !== SERVICE_METHOD.name);

    const [customerId, setCustomerId] = useState(order?.customerId || "");
    const [customerQuery, setCustomerQuery] = useState("");
    const [newCustomerName, setNewCustomerName] = useState(""); // cliente que se creará al guardar
    const [phone, setPhone] = useState(order?.phone || "");
    const [address, setAddress] = useState(order?.address || "");
    const [kind, setKind] = useState(order?.kind || "pickup");
    const [dueDate, setDueDate] = useState(order?.dueDate || defaultDate || dayKey());
    const [dueTime, setDueTime] = useState(order?.dueTime || "");
    const [lines, setLines] = useState(() => fromOrderItems(order?.items));
    const [deliveryFee, setDeliveryFee] = useState(order?.deliveryFee ? String(order.deliveryFee) : "");
    const [notes, setNotes] = useState(order?.notes || "");
    const [deposit, setDeposit] = useState("");
    const [depositMethod, setDepositMethod] = useState(methods[0]?.name || "Efectivo");
    const [productQuery, setProductQuery] = useState("");
    const productSearchRef = useRef(null);
    const [birthday, setBirthday] = useState(() => customers.find((c) => c.id === order?.customerId)?.birthday || "");
    const [renaming, setRenaming] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [renamedTo, setRenamedTo] = useState(""); // nombre corregido aquí (antes de que llegue la ficha actualizada)

    const customer = customers.find((c) => c.id === customerId) || null;
    const customerName = renamedTo || customer?.name || newCustomerName;
    const priceType = customer ? customer.priceType || "special" : newCustomerName ? "general" : null;
    const promos = useMemo(() => promoMap(promotions), [promotions]);

    // ── Cliente ──
    const cq = customerQuery.trim().toLowerCase();
    const customerMatches = cq ? customers.filter((c) => c.name.toLowerCase().includes(cq)).slice(0, 6) : [];
    const exactCustomer = customers.some((c) => c.name.trim().toLowerCase() === cq);
    const chooseCustomer = (c) => {
        setCustomerId(c.id);
        setNewCustomerName("");
        setCustomerQuery("");
        if (!phone && c.phone) setPhone(c.phone);
        if (!address && c.address) setAddress(c.address);
        setBirthday(c.birthday || "");
        setRenamedTo("");
    };
    const createCustomer = () => {
        setNewCustomerName(customerQuery.trim());
        setCustomerId("");
        setCustomerQuery("");
    };
    const clearCustomer = () => {
        setCustomerId("");
        setNewCustomerName("");
        setRenamedTo("");
        setRenaming(false);
    };
    /** Corregir el nombre aquí mismo: en un cliente existente se cambia en su ficha, pedidos y créditos. */
    const confirmRename = () => {
        const next = nameDraft.trim();
        if (!next) return showToast("Escribe el nombre", "warning");
        if (customer) {
            const res = actions.renameCustomer(customer.id, next);
            if (res.error) return showToast(res.error, "warning");
            setRenamedTo(next);
            showToast("Nombre del cliente actualizado", "success");
        } else {
            setNewCustomerName(next);
        }
        setRenaming(false);
    };

    // ── Productos ──
    const pq = productQuery.trim().toLowerCase();
    const productMatches = pq ? products.filter((p) => !isFlexible(p) && p.name?.toLowerCase().includes(pq)).slice(0, 8) : [];
    const addProduct = (p) => {
        setLines((prev) => {
            const existing = prev.find((l) => l.id === p.id && l.fixedPrice === null);
            if (existing) return prev.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
            return [...prev, { key: newKey(), id: p.id, name: p.name, qty: 1, fixedPrice: null, custom: false }];
        });
        setProductQuery("");
        productSearchRef.current?.focus();
    };
    const addCustom = () => setLines((prev) => [...prev, { key: newKey(), id: null, name: "", qty: 1, fixedPrice: 0, custom: true }]);
    const updateLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    const changeQty = (key, delta) => setLines((prev) => prev.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }])));

    /** Precio de cada línea: fijo, o el del catálogo según el tipo de cliente y la promo. */
    const priced = lines.map((l) => {
        if (l.fixedPrice !== null) return { ...l, unit: l.fixedPrice, subtotal: Math.round(l.fixedPrice * l.qty) };
        const product = productsById[l.id];
        if (!product) return { ...l, unit: 0, subtotal: 0 };
        const live = liveLine({ ...product, cartQuantity: l.qty }, productsById);
        const subtotal = lineSubtotal(live, priceType, promos[l.id]);
        return { ...l, unit: unitPrice(live, priceType), subtotal };
    });

    const fee = kind === "delivery" ? parseInt(deliveryFee, 10) || 0 : 0;
    const draft = { items: priced.map((l) => ({ subtotal: l.subtotal })), deliveryFee: fee, deposits: order?.deposits || [] };
    const money = orderMoney(draft);
    const newDeposit = parseInt(deposit, 10) || 0;

    const today = dayKey();
    const tomorrow = dayKey(addDays(new Date(), 1));

    const save = () => {
        const name = customerName;
        if (!name) return showToast("Elige o crea el cliente del pedido", "warning");
        if (!dueDate) return showToast("Elige la fecha de entrega", "warning");
        if (priced.length === 0) return showToast("Agrega al menos un producto", "warning");
        if (priced.some((l) => l.custom && !l.name.trim())) return showToast("Escribe el nombre del producto especial", "warning");
        if (newDeposit > money.due) return showToast("El anticipo no puede ser mayor que el saldo", "warning");

        let id = customerId;
        if (!id) id = actions.quickAddCustomer({ name, phone: phone.trim(), address: kind === "delivery" ? address.trim() : "", birthday });
        else if (customer) {
            // Se completa la ficha del cliente con lo que se escribió aquí.
            const patch = {
                ...(phone.trim() && phone.trim() !== (customer.phone || "") ? { phone: phone.trim() } : {}),
                ...(kind === "delivery" && address.trim() && address.trim() !== (customer.address || "") ? { address: address.trim() } : {}),
                ...(birthday !== (customer.birthday || "") ? { birthday } : {}),
            };
            if (Object.keys(patch).length) actions.updateCustomer(id, patch);
        }

        const items = priced.map((l) => ({ id: l.id, name: l.name.trim(), price: l.unit, cartQuantity: l.qty, subtotal: l.subtotal }));
        const data = { customerId: id, customerName: name, phone: phone.trim(), address: address.trim(), kind, dueDate, dueTime, items, deliveryFee: fee, notes: notes.trim() };
        const orderId = actions.saveOrder(data, order?.id || null);
        if (newDeposit > 0) {
            actions.addOrderDeposit({ id: orderId, customerName: name, dueDate, deposits: order?.deposits || [] }, { amount: newDeposit, method: depositMethod, vendedorName: sessionUser?.displayName || "" });
        }
        showToast(editing ? "Pedido actualizado" : `Pedido de ${name} guardado${newDeposit ? ` · anticipo ${formatCurrency(newDeposit)}` : ""}`, "success");
        onClose();
    };

    const cancelOrder = async () => {
        const msg = money.prepaid > 0 ? `¿Cancelar el pedido de ${order.customerName}? Se registrará la devolución del anticipo (${formatCurrency(money.prepaid)}) como salida de caja.` : `¿Cancelar el pedido de ${order.customerName}?`;
        if (!(await showConfirm(msg, { confirmLabel: "Cancelar pedido" }))) return;
        actions.cancelOrder(order);
        showToast("Pedido cancelado: la reserva quedó libre", "success");
        onClose();
    };

    const footer = (
        <>
            {editing && can("cancelOrders") && (
                <button className="btn btn--ghost order-form__cancel" onClick={cancelOrder}>
                    <Ban size={18} /> Cancelar pedido
                </button>
            )}
            <div className="order-form__totals">
                <span>
                    Total <b>{formatCurrency(money.total)}</b>
                </span>
                {(money.prepaid > 0 || newDeposit > 0) && (
                    <span className="muted">
                        Saldo <b>{formatCurrency(money.due - newDeposit)}</b>
                    </span>
                )}
            </div>
            <button className="btn btn--primary btn--lg" onClick={save}>
                <Save size={18} /> {editing ? "Guardar cambios" : "Guardar pedido"}
            </button>
        </>
    );

    return (
        <Modal title={editing ? `Pedido de ${customerName || order.customerName}` : "Nuevo pedido"} icon={ClipboardList} onClose={onClose} size="lg" footer={footer}>
            <div className="order-form">
                {/* ── Cliente ── */}
                <section className="order-form__section">
                    <div className="order-form__label">Cliente</div>
                    {(customer || newCustomerName) && renaming ? (
                        <div className="order-form__customer order-form__customer--edit">
                            <input
                                className="input"
                                value={nameDraft}
                                onChange={(e) => setNameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        confirmRename();
                                    }
                                    if (e.key === "Escape") {
                                        e.stopPropagation();
                                        setRenaming(false);
                                    }
                                }}
                                autoFocus
                                aria-label="Nombre del cliente"
                            />
                            <button className="btn btn--primary btn--sm" onClick={confirmRename} title="Guardar nombre">
                                <Check size={16} /> Guardar
                            </button>
                            <button className="icon-btn" onClick={() => setRenaming(false)} title="Cancelar" aria-label="Cancelar">
                                <X size={16} />
                            </button>
                        </div>
                    ) : customer || newCustomerName ? (
                        <div className="order-form__customer">
                            <b>{customerName}</b>
                            <button
                                className="icon-btn"
                                onClick={() => {
                                    setNameDraft(customerName);
                                    setRenaming(true);
                                }}
                                title="Corregir el nombre del cliente"
                                aria-label="Corregir el nombre del cliente"
                            >
                                <Pencil size={15} />
                            </button>
                            {newCustomerName && <span className="tag tag--general">Nuevo · se crea al guardar</span>}
                            {customer && <span className={`tag tag--${customer.priceType || "special"}`}>{PRICE_TYPES[customer.priceType || "special"]?.label}</span>}
                            <button className="icon-btn order-form__change" onClick={clearCustomer} title="Elegir otro cliente" aria-label="Elegir otro cliente">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="order-form__search">
                            <SearchInput value={customerQuery} onChange={setCustomerQuery} placeholder="Buscar o escribir el nombre del cliente…" autoFocus={!editing} />
                            {cq && (
                                <div className="order-form__results">
                                    {customerMatches.map((c) => (
                                        <button key={c.id} type="button" onClick={() => chooseCustomer(c)}>
                                            {c.name}
                                            {c.phone && <span className="muted"> · {c.phone}</span>}
                                        </button>
                                    ))}
                                    {!exactCustomer && (
                                        <button type="button" className="order-form__create" onClick={createCustomer}>
                                            <UserPlus size={16} /> Crear cliente «{customerQuery.trim()}»
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="order-form__grid">
                        <Field label="Celular (opcional)">
                            <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="3001234567" />
                        </Field>
                        <Field label="Cumpleaños (opcional)">
                            <BirthdayInput key={customerId || "nuevo"} value={birthday} onChange={setBirthday} />
                        </Field>
                    </div>
                    <Field label="Tipo">
                        <ChipGroup options={KINDS} value={kind} onChange={setKind} />
                    </Field>
                    {kind === "delivery" && (
                        <div className="order-form__grid">
                            <Field label="Dirección (opcional)">
                                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Cra 5 #12-30, apto 301" />
                            </Field>
                            <Field label="Valor domicilio">
                                <MoneyInput value={deliveryFee} onChange={setDeliveryFee} />
                            </Field>
                        </div>
                    )}
                </section>

                {/* ── Entrega ── */}
                <section className="order-form__section">
                    <div className="order-form__label">{kind === "delivery" ? "Entregar el" : "Recogen el"}</div>
                    <div className="order-form__when">
                        <ChipGroup
                            options={[
                                { value: today, label: "Hoy" },
                                { value: tomorrow, label: "Mañana" },
                            ]}
                            value={dueDate}
                            onChange={setDueDate}
                        />
                        <input type="date" className="input" value={dueDate} min={editing ? undefined : today} onChange={(e) => setDueDate(e.target.value)} aria-label="Fecha de entrega" />
                        <input type="time" className="input" value={dueTime} onChange={(e) => setDueTime(e.target.value)} aria-label="Hora (opcional)" title="Hora (opcional)" />
                    </div>
                </section>

                {/* ── Productos ── */}
                <section className="order-form__section">
                    <div className="order-form__label">Productos</div>
                    <div className="order-form__search">
                        <div className="row-gap">
                            <SearchInput
                                inputRef={productSearchRef}
                                value={productQuery}
                                onChange={setProductQuery}
                                placeholder="Buscar producto…  (Enter agrega el primero)"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && productMatches[0]) {
                                        e.preventDefault();
                                        addProduct(productMatches[0]);
                                    }
                                }}
                            />
                            <button type="button" className="btn btn--ghost" onClick={addCustom} title="Algo que no está en el catálogo (ej. torta personalizada)">
                                <PencilLine size={17} /> Especial
                            </button>
                        </div>
                        {pq && (
                            <div className="order-form__results">
                                {productMatches.length === 0 && <div className="muted small order-form__empty">Sin resultados. Usa «Especial» para algo fuera del catálogo.</div>}
                                {productMatches.map((p) => (
                                    <button key={p.id} type="button" onClick={() => addProduct(p)}>
                                        {p.name}
                                        <span className="muted">
                                            {" "}
                                            · {formatCurrency(unitPrice(p, priceType))} · stock {p.quantity || 0}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {priced.length > 0 && (
                        <div className="order-form__lines">
                            {priced.map((l) => (
                                <div className="order-line" key={l.key}>
                                    {l.custom ? (
                                        <div className="order-line__custom">
                                            <input className="input" value={l.name} onChange={(e) => updateLine(l.key, { name: e.target.value })} placeholder="Ej: Torta de cumpleaños 1 libra" />
                                            <MoneyInput value={l.fixedPrice ? String(l.fixedPrice) : ""} onChange={(v) => updateLine(l.key, { fixedPrice: parseInt(v, 10) || 0 })} placeholder="Precio c/u" />
                                        </div>
                                    ) : (
                                        <div className="order-line__info">
                                            <b>{l.name}</b>
                                            <span className="muted small">
                                                {formatCurrency(l.unit)} c/u{l.fixedPrice !== null ? " · precio acordado" : ""}
                                            </span>
                                        </div>
                                    )}
                                    <div className="stepper stepper--sm">
                                        <button type="button" onClick={() => changeQty(l.key, -1)} aria-label="Quitar uno">
                                            {l.qty === 1 ? <Trash2 size={15} /> : <Minus size={15} />}
                                        </button>
                                        <span>{l.qty}</span>
                                        <button type="button" onClick={() => changeQty(l.key, 1)} aria-label="Agregar uno">
                                            <Plus size={15} />
                                        </button>
                                    </div>
                                    <b className="order-line__total">{formatCurrency(l.subtotal)}</b>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Anticipo y nota ── */}
                <section className="order-form__section">
                    <div className="order-form__label">
                        <Coins size={14} /> Anticipo {money.prepaid > 0 && <span className="muted">· ya abonó {formatCurrency(money.prepaid)}</span>}
                    </div>
                    {order?.deposits?.length > 0 && (
                        <div className="pills">
                            {order.deposits.map((d, i) => (
                                <span key={i} className="pay-pill">
                                    {formatCurrency(d.amount)} · {d.method} · {new Date(d.date).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="order-form__grid">
                        <Field label={money.prepaid > 0 ? "Nuevo abono (opcional)" : "Deja abonado (opcional)"} hint="Entra a la caja de hoy; al entregar solo se cobra el saldo.">
                            <MoneyInput value={deposit} onChange={setDeposit} />
                        </Field>
                        <Field label="Método">
                            <select className="select" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)} disabled={!newDeposit}>
                                {methods.map((m) => (
                                    <option key={m.id || m.name} value={m.name}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <textarea className="input" rows={2} placeholder="Nota (ej: escribir «Feliz cumpleaños Ana», sin azúcar…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </section>
            </div>
        </Modal>
    );
}

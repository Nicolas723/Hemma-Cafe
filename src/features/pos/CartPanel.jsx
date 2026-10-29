import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, X, Printer, Wallet, Percent, Split, StickyNote, ShoppingBag, CheckCircle2, UserCircle2, Gift } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { EmptyState, MoneyInput, Toggle } from "../../components/ui";
import { MethodPicker, SplitEditor, newSplitRow, splitRowsToPayments } from "../../components/PaymentMethods";
import { DEFAULT_PAYMENT_METHODS, SERVICE_METHOD } from "../../lib/paymentIcons";
import { PRICE_TYPES } from "../../lib/pricing";
import { formatCurrency, initials } from "../../lib/format";
import { readTables } from "../../lib/tables";

const BILLS = [2000, 5000, 10000, 20000, 50000, 100000];

/** Billetes útiles para el total: los 3 primeros que lo cubren. */
const cashSuggestions = (total) => BILLS.filter((b) => b > total).slice(0, 3);

export default function CartPanel({ pos, order, customer, onClose }) {
    const { vendedores, customers, paymentMethods, actions } = useData();
    const { showToast, showConfirm, printReceipt } = useUi();
    const { can } = useAuth();
    // «Servicio» ya no es un método más: la cortesía tiene su propio botón.
    const methods = (paymentMethods.length ? paymentMethods : DEFAULT_PAYMENT_METHODS).filter((m) => m.name !== SERVICE_METHOD.name);

    const [method, setMethod] = useState(methods[0]?.name || "Efectivo");
    const [received, setReceived] = useState("");
    const [split, setSplit] = useState(false);
    const [splitRows, setSplitRows] = useState(() => [newSplitRow(methods[0]?.name)]);
    const [showNotes, setShowNotes] = useState(false);

    // Al cambiar de mesa se reinicia el pago (cada mesa paga por separado).
    useEffect(() => {
        setReceived("");
        setSplit(false);
        setSplitRows([newSplitRow(methods[0]?.name)]);
        setShowNotes(Boolean(pos.notes));
        // La cortesía es por mesa: si la nueva mesa no la tiene, vuelve al método normal.
        if (method === SERVICE_METHOD.name && pos.customTotal !== "0") setMethod(methods[0]?.name || "Efectivo");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pos.activeTable]);

    const tableLabel = readTables().find((t) => t.id === pos.activeTable)?.label || "Mostrador";
    const empty = order.lines.length === 0;
    const change = received !== "" ? parseInt(received, 10) - order.total : null;
    const isCash = /efectivo/i.test(method);
    const needsVendor = !pos.vendedor;

    const selectMethod = (name) => setMethod(name);

    // Cortesía / consumo interno: total en $0, el stock sí se descuenta. Se guarda
    // con el método «Servicio» (el mismo nombre que usaban las ventas anteriores).
    const courtesy = method === SERVICE_METHOD.name;
    const setCourtesy = (on) => {
        setSplit(false);
        setMethod(on ? SERVICE_METHOD.name : methods[0]?.name || "Efectivo");
        pos.setCustomTotal(on ? "0" : null);
    };

    const payments = useMemo(
        () => (split ? splitRowsToPayments(splitRows, order.total) : [{ method, amount: order.total }]),
        [split, splitRows, method, order.total]
    );

    const checkout = () => {
        if (empty) return;
        if (needsVendor) {
            showToast("Elige quién atiende antes de cobrar", "warning");
            return;
        }
        const tx = actions.checkout({
            order,
            customerName: customer?.name || "General",
            vendedorName: pos.vendedor,
            payments,
            notes: pos.notes,
        });
        pos.clearTable(pos.activeTable);
        setReceived("");
        setSplitRows([newSplitRow(methods[0]?.name)]);
        setMethod(methods[0]?.name || "Efectivo");
        onClose?.();
        const changeMsg = isCash && change > 0 && !split ? ` · Cambio ${formatCurrency(change)}` : "";
        showToast(`Venta de ${formatCurrency(tx.total)} registrada${changeMsg}`, "success", {
            label: "Imprimir",
            onClick: () => printReceipt(tx),
        });
    };

    const saveLoan = () => {
        if (!customer) {
            showToast("Para fiar, primero elige el cliente", "warning");
            return;
        }
        if (needsVendor) {
            showToast("Elige quién atiende", "warning");
            return;
        }
        actions.saveLoan({ order, customer, vendedorName: pos.vendedor, notes: pos.notes });
        pos.clearTable(pos.activeTable);
        onClose?.();
        showToast(`Crédito de ${formatCurrency(order.subtotal)} anotado a ${customer.name}`, "success");
    };

    const printDraft = () =>
        printReceipt({
            date: new Date().toISOString(),
            customerName: customer?.name || "General",
            vendedorName: pos.vendedor,
            paymentMethod: split ? "Varios" : method,
            payments: split ? payments : null,
            total: order.total,
            notes: pos.notes,
            items: order.lines.map((l) => ({ name: l.name, cartQuantity: l.cartQuantity, subtotal: l.subtotal })),
        });

    // Ctrl+Enter o F12 cobran.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey && e.key === "Enter") || e.key === "F12") {
                e.preventDefault();
                checkout();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    return (
        <aside className="cart">
            <div className="cart__head">
                <div>
                    <div className="cart__eyebrow">Orden actual</div>
                    <h2 className="cart__title">{tableLabel}</h2>
                </div>
                <div className="cart__head-actions">
                    {!empty && (
                        <button
                            className="icon-btn icon-btn--danger"
                            title="Vaciar orden"
                            onClick={() => showConfirm(`¿Vaciar la orden de ${tableLabel}?`, { confirmLabel: "Vaciar" }).then((ok) => ok && pos.clearTable(pos.activeTable))}
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    {onClose && (
                        <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Quién atiende: un toque */}
            <div className={`cart__section ${needsVendor ? "needs-attention" : ""}`}>
                <div className="cart__label">Atiende {needsVendor && <span className="req">· elige uno</span>}</div>
                {vendedores.length <= 6 ? (
                    <div className="people">
                        {vendedores.map((v) => (
                            <button key={v.id} className={`person ${pos.vendedor === v.name ? "is-active" : ""}`} onClick={() => pos.setVendedor(v.name)} title={v.name}>
                                <span className="person__avatar">{initials(v.name)}</span>
                                <span className="person__name">{v.name.split(" ")[0]}</span>
                            </button>
                        ))}
                        {vendedores.length === 0 && <span className="muted">Agrega vendedores en Ajustes</span>}
                    </div>
                ) : (
                    <select className="select" value={pos.vendedor} onChange={(e) => pos.setVendedor(e.target.value)}>
                        <option value="">Seleccionar…</option>
                        {vendedores.map((v) => (
                            <option key={v.id} value={v.name}>
                                {v.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="cart__section cart__customer">
                <UserCircle2 size={20} />
                <select className="select" value={pos.customerId} onChange={(e) => pos.setCustomerId(e.target.value)}>
                    <option value="">Cliente: Público general</option>
                    {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                {customer && <span className={`tag tag--${customer.priceType || "special"}`}>{PRICE_TYPES[customer.priceType || "special"]?.label}</span>}
            </div>

            <div className="cart__lines">
                {empty ? (
                    <EmptyState icon={ShoppingBag} title="Orden vacía">
                        Toca un producto para agregarlo
                    </EmptyState>
                ) : (
                    order.lines.map((l) => (
                        <div className="line" key={l.lineId}>
                            <div className="line__info">
                                <div className="line__name">{l.name}</div>
                                <div className="line__meta">
                                    {formatCurrency(l.unit)} c/u
                                    {l.badge && <span className="line__badge">{l.badge}</span>}
                                </div>
                            </div>
                            <div className="stepper">
                                <button onClick={() => pos.changeQty(l.lineId, -1)} aria-label="Quitar uno">
                                    {l.cartQuantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                                </button>
                                <span>{l.cartQuantity}</span>
                                <button onClick={() => pos.changeQty(l.lineId, 1)} aria-label="Agregar uno">
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div className="line__total">{formatCurrency(l.subtotal)}</div>
                        </div>
                    ))
                )}
            </div>

            {!empty && (
                <>
                <div className="cart__pay">
                    <div className="cart__toggles">
                        {can("discounts") && !courtesy && <Toggle icon={Percent} label="Descuento" checked={order.hasCustom} onChange={(on) => pos.setCustomTotal(on ? String(order.subtotal) : null)} />}
                        {can("discounts") && <Toggle icon={Gift} label="Cortesía" checked={courtesy} onChange={setCourtesy} />}
                        {!courtesy && <Toggle icon={Split} label="Dividir" checked={split} onChange={setSplit} />}
                        <Toggle icon={StickyNote} label="Nota" checked={showNotes} onChange={setShowNotes} />
                    </div>

                    {order.hasCustom && can("discounts") && !courtesy && (
                        <div className="cart__row">
                            <span className="muted">Subtotal {formatCurrency(order.subtotal)} →</span>
                            <MoneyInput value={pos.customTotal} onChange={pos.setCustomTotal} />
                        </div>
                    )}

                    {showNotes && (
                        <input className="input" placeholder="Nota de la orden (ej: sin azúcar)" value={pos.notes} onChange={(e) => pos.setNotes(e.target.value)} />
                    )}

                    {courtesy ? (
                        <div className="note">
                            <Gift size={15} /> Cortesía o consumo interno: no se cobra ({formatCurrency(order.subtotal)} en productos) y el stock sí se descuenta. Queda registrado.
                        </div>
                    ) : split ? (
                        <SplitEditor methods={methods} rows={splitRows} onChange={setSplitRows} total={order.total} />
                    ) : (
                        <>
                            <MethodPicker methods={methods} value={method} onChange={selectMethod} compact />
                            {isCash && (
                                <div className="cash">
                                    <div className="cash__quick">
                                        <button className={`btn btn--soft btn--sm ${received === String(order.total) ? "is-active" : ""}`} onClick={() => setReceived(String(order.total))}>
                                            Exacto
                                        </button>
                                        {cashSuggestions(order.total).map((b) => (
                                            <button key={b} className={`btn btn--soft btn--sm ${received === String(b) ? "is-active" : ""}`} onClick={() => setReceived(String(b))}>
                                                {formatCurrency(b)}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="cash__row">
                                        <MoneyInput value={received} onChange={setReceived} placeholder="Recibido" />
                                        {change !== null && (
                                            <div className={`cash__change ${change >= 0 ? "is-ok" : "is-short"}`}>
                                                <span>{change >= 0 ? "Cambio" : "Faltan"}</span>
                                                <strong>{formatCurrency(Math.abs(change))}</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Siempre visible: total y acciones nunca quedan fuera de pantalla */}
                <div className="cart__footer">
                    <div className="cart__total">
                        <span>
                            Total{order.hasCustom && <s className="muted"> {formatCurrency(order.subtotal)}</s>}
                        </span>
                        <strong>{formatCurrency(order.total)}</strong>
                    </div>
                    <div className="cart__actions">
                        <button className="btn btn--ghost btn--xl cart__icon-action" onClick={printDraft} title="Imprimir cuenta" aria-label="Imprimir cuenta">
                            <Printer size={20} />
                            <span>Cuenta</span>
                        </button>
                        <button
                            className="btn btn--warn btn--xl cart__icon-action"
                            onClick={saveLoan}
                            title={customer ? `Fiar a ${customer.name}` : "Elige un cliente para fiar"}
                            aria-label="Fiar"
                        >
                            <Wallet size={20} />
                            <span>Fiar</span>
                        </button>
                        <button className="btn btn--primary btn--xl cart__checkout" onClick={checkout} disabled={needsVendor} title="Cobrar (Ctrl+Enter)">
                            <CheckCircle2 size={22} /> Cobrar
                        </button>
                    </div>
                </div>
                </>
            )}
        </aside>
    );
}

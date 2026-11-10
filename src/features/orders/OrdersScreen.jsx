import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Bike, ShoppingBag, CheckCircle2, Clock, MapPin, Phone, StickyNote, ChevronRight, AlertTriangle, PackageCheck, MessageCircle, History, CalendarDays, Loader2 } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { EmptyState, PageHeader, Toggle } from "../../components/ui";
import { formatCurrency } from "../../lib/format";
import { addDays } from "../../lib/dates";
import { ORDER_STATUS, dayKey, formatDueTime, groupOrdersByDay, keyToDate, orderMoney, prepList, sortOrders } from "../../lib/orders";
import { isValidPhone, whatsappLink } from "../../lib/whatsapp";
import OrderForm from "./OrderForm";

const DAYS_AHEAD = 7;
const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const OVERDUE = "overdue";

const dayLabel = (key, todayKey) => {
    if (key === todayKey) return "Hoy";
    if (key === dayKey(addDays(keyToDate(todayKey), 1))) return "Mañana";
    const d = keyToDate(key);
    return `${WEEKDAY[d.getDay()]} ${d.getDate()}`;
};
const longDay = (key) => keyToDate(key).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

/** Mensaje de «tu pedido está listo» (sin emojis: ver lib/whatsapp.js). */
const readyMessage = (o) => {
    const first = (o.customerName || "").trim().split(/\s+/)[0] || "";
    const { due } = orderMoney(o);
    const what = o.kind === "delivery" ? "ya va en camino" : "ya está listo para recoger";
    return [`Hola ${first}, te saludamos de Hemma Café.`, `Tu pedido ${what}.`, due > 0 ? `*Saldo a pagar: ${formatCurrency(due)}*` : "Ya está pagado.", "¡Gracias por tu preferencia!"].join("\n").replace(/ /g, " ");
};

export default function OrdersScreen({ onDeliver }) {
    const { orders, productsById, todayKey, actions } = useData();
    const { showToast } = useUi();
    const { can } = useAuth();
    const canManage = can("manageOrders");

    const [selected, setSelected] = useState(todayKey);
    const [form, setForm] = useState(null); // { order } | { defaultDate }
    const [showClosed, setShowClosed] = useState(false);
    const [closed, setClosed] = useState({ loading: false, rows: [] });

    const { overdue, byDay } = useMemo(() => groupOrdersByDay(orders, keyToDate(todayKey)), [orders, todayKey]);

    // Días de la fila: atrasados (si hay), hoy + 6 y cualquier otro día futuro con pedidos.
    const days = useMemo(() => {
        const keys = new Set();
        for (let i = 0; i < DAYS_AHEAD; i++) keys.add(dayKey(addDays(keyToDate(todayKey), i)));
        Object.keys(byDay).forEach((k) => keys.add(k));
        if (selected !== OVERDUE && selected >= todayKey) keys.add(selected);
        return [...keys].sort();
    }, [byDay, todayKey, selected]);

    // Si el día elegido quedó en el pasado (pasó la medianoche), volver a hoy.
    useEffect(() => {
        if (selected !== OVERDUE && selected < todayKey) setSelected(todayKey);
        if (selected === OVERDUE && overdue.length === 0) setSelected(todayKey);
    }, [selected, todayKey, overdue.length]);

    useEffect(() => {
        if (!showClosed) return;
        let cancelled = false;
        setClosed({ loading: true, rows: [] });
        actions
            .loadClosedOrders(dayKey(addDays(new Date(), -30)))
            .then((rows) => !cancelled && setClosed({ loading: false, rows: sortOrders(rows).reverse() }))
            .catch((err) => {
                console.error(err);
                if (!cancelled) setClosed({ loading: false, rows: [] });
                showToast("No se pudieron cargar los pedidos cerrados (¿sin internet?)", "warning");
            });
        return () => {
            cancelled = true;
        };
    }, [showClosed]); // eslint-disable-line react-hooks/exhaustive-deps

    const list = selected === OVERDUE ? overdue : byDay[selected] || [];
    const prep = useMemo(() => prepList(list, productsById), [list, productsById]);
    const prepTitle = selected === OVERDUE ? "Para entregar (atrasados)" : selected === todayKey ? "Para preparar hoy" : `Para preparar · ${dayLabel(selected, todayKey)}`;

    const toggleReady = (o) => {
        actions.setOrderStatus(o, o.status === "ready" ? "pending" : "ready");
        if (o.status !== "ready") showToast(`Pedido de ${o.customerName} marcado como listo`, "success");
    };
    const notify = (o) => {
        const text = readyMessage(o);
        window.open(whatsappLink(o.phone, text), "_blank");
        navigator.clipboard?.writeText(text).catch(() => {});
    };

    return (
        <div className="page orders">
            <PageHeader icon={ClipboardList} title="Pedidos" subtitle="Domicilios y encargos por día. Lo de hoy queda reservado en el inventario hasta entregarlo.">
                <Toggle icon={History} label="Ver cerrados" checked={showClosed} onChange={setShowClosed} />
                {canManage && (
                    <button className="btn btn--primary" onClick={() => setForm({ defaultDate: selected === OVERDUE ? todayKey : selected })}>
                        <Plus size={18} /> Nuevo pedido
                    </button>
                )}
            </PageHeader>

            {showClosed ? (
                <ClosedOrders state={closed} />
            ) : (
                <>
                    <div className="order-days" role="tablist" aria-label="Días">
                        {overdue.length > 0 && (
                            <button role="tab" aria-selected={selected === OVERDUE} className={`order-day order-day--late ${selected === OVERDUE ? "is-active" : ""}`} onClick={() => setSelected(OVERDUE)}>
                                <AlertTriangle size={16} />
                                <span className="order-day__label">Atrasados</span>
                                <span className="order-day__count">{overdue.length}</span>
                            </button>
                        )}
                        {days.map((k) => {
                            const n = byDay[k]?.length || 0;
                            return (
                                <button key={k} role="tab" aria-selected={selected === k} className={`order-day ${selected === k ? "is-active" : ""} ${n ? "has-orders" : ""}`} onClick={() => setSelected(k)}>
                                    <span className="order-day__label">{dayLabel(k, todayKey)}</span>
                                    <span className="order-day__count">{n || "—"}</span>
                                </button>
                            );
                        })}
                        <label className="order-day order-day--pick" title="Ir a otra fecha">
                            <CalendarDays size={16} />
                            <input type="date" min={todayKey} value={selected === OVERDUE ? "" : selected} onChange={(e) => e.target.value && setSelected(e.target.value)} aria-label="Ir a otra fecha" />
                        </label>
                    </div>

                    <div className="orders__body">
                        <section className="orders__list">
                            <h2 className="orders__heading">{selected === OVERDUE ? "Pedidos atrasados: siguen reservando hasta entregarlos o cancelarlos" : longDay(selected)}</h2>
                            {list.length === 0 ? (
                                <EmptyState icon={ClipboardList} title="Sin pedidos para este día">
                                    {canManage ? "Usa «Nuevo pedido» para agregar uno." : null}
                                </EmptyState>
                            ) : (
                                list.map((o) => (
                                    <OrderCard
                                        key={o.id}
                                        order={o}
                                        late={selected === OVERDUE}
                                        canManage={canManage}
                                        onOpen={() => canManage && setForm({ order: o })}
                                        onReady={() => toggleReady(o)}
                                        onDeliver={() => onDeliver(o)}
                                        onNotify={isValidPhone(o.phone) ? () => notify(o) : null}
                                    />
                                ))
                            )}
                        </section>

                        <aside className="orders__prep card">
                            <h2 className="orders__heading">{prepTitle}</h2>
                            {prep.length === 0 ? (
                                <p className="muted small">Nada por ahora.</p>
                            ) : (
                                <ul className="prep">
                                    {prep.map((p) => (
                                        <li key={p.id || p.name} className={p.missing ? "is-missing" : ""}>
                                            <span className="prep__name">{p.name}</span>
                                            <b className="prep__qty">{p.qty}</b>
                                            <span className="prep__state">{p.missing ? `faltan ${p.missing}` : <CheckCircle2 size={16} />}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <p className="muted small">
                                {selected === todayKey || selected === OVERDUE ? "Comparado con el stock actual. Lo que falta hay que prepararlo u hornearlo." : "Referencia con el stock de hoy: estos pedidos aún no reservan nada."}
                            </p>
                        </aside>
                    </div>
                </>
            )}

            {form && <OrderForm order={form.order || null} defaultDate={form.defaultDate} onClose={() => setForm(null)} />}
        </div>
    );
}

function OrderCard({ order: o, late, canManage, onOpen, onReady, onDeliver, onNotify }) {
    const money = orderMoney(o);
    const ready = o.status === "ready";
    const units = (o.items || []).reduce((s, i) => s + (i.cartQuantity || 0), 0);
    return (
        <article className={`order-card ${ready ? "is-ready" : ""} ${late ? "is-late" : ""}`}>
            <button type="button" className="order-card__main" onClick={onOpen} disabled={!canManage} title={canManage ? "Ver o editar el pedido" : undefined}>
                <div className="order-card__time">
                    <Clock size={15} />
                    {late ? keyToDate(o.dueDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : o.dueTime ? formatDueTime(o.dueTime) : "Sin hora"}
                    {late && o.dueTime ? ` · ${formatDueTime(o.dueTime)}` : ""}
                </div>
                <div className="order-card__head">
                    <b className="order-card__name">{o.customerName}</b>
                    <span className={`order-kind order-kind--${o.kind}`}>
                        {o.kind === "delivery" ? <Bike size={14} /> : <ShoppingBag size={14} />}
                        {o.kind === "delivery" ? "Domicilio" : "Recoger"}
                    </span>
                    {ready && (
                        <span className="order-status">
                            <PackageCheck size={14} /> {ORDER_STATUS.ready.label}
                        </span>
                    )}
                </div>
                <div className="order-card__items">
                    {(o.items || []).map((i) => `${i.cartQuantity} ${i.name}`).join(" · ")}
                    <span className="muted"> ({units} und.)</span>
                </div>
                <div className="order-card__meta">
                    {o.kind === "delivery" && o.address && (
                        <span>
                            <MapPin size={13} /> {o.address}
                        </span>
                    )}
                    {o.phone && (
                        <span>
                            <Phone size={13} /> {o.phone}
                        </span>
                    )}
                    {o.notes && (
                        <span className="order-card__note">
                            <StickyNote size={13} /> {o.notes}
                        </span>
                    )}
                </div>
            </button>
            <div className="order-card__side">
                <div className="order-card__money">
                    {money.prepaid > 0 && <span className="muted small">Abonó {formatCurrency(money.prepaid)}</span>}
                    <span className="small muted">{money.prepaid > 0 ? "Saldo" : "Total"}</span>
                    <b>{formatCurrency(money.due)}</b>
                </div>
                <div className="order-card__actions">
                    {onNotify && (
                        <button className="icon-btn" onClick={onNotify} title="Avisar por WhatsApp que está listo" aria-label="Avisar por WhatsApp">
                            <MessageCircle size={18} />
                        </button>
                    )}
                    {canManage && (
                        <button className={`btn btn--sm ${ready ? "btn--soft is-active" : "btn--ghost"}`} onClick={onReady} title={ready ? "Volver a pendiente" : "Marcar como listo"}>
                            <PackageCheck size={16} /> Listo
                        </button>
                    )}
                    <button className="btn btn--primary btn--sm" onClick={onDeliver} title="Llevar a la caja para cobrar o fiar">
                        Entregar <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </article>
    );
}

function ClosedOrders({ state }) {
    if (state.loading) {
        return (
            <div className="screen-loading">
                <Loader2 size={26} className="spin" />
            </div>
        );
    }
    if (state.rows.length === 0) return <EmptyState icon={History} title="No hay pedidos cerrados en los últimos 30 días" />;
    return (
        <div className="card card--flush">
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Entrega</th>
                            <th>Cliente</th>
                            <th>Productos</th>
                            <th className="r">Total</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.rows.map((o) => (
                            <tr key={o.id}>
                                <td className="nowrap">
                                    <b>{keyToDate(o.dueDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</b>
                                    {o.dueTime && <div className="muted">{formatDueTime(o.dueTime)}</div>}
                                </td>
                                <td>
                                    {o.customerName}
                                    <div className="muted">{o.kind === "delivery" ? "Domicilio" : "Recoger"}</div>
                                </td>
                                <td className="ellipsis">{(o.items || []).map((i) => `${i.cartQuantity} ${i.name}`).join(", ")}</td>
                                <td className="r">{formatCurrency(orderMoney(o).total)}</td>
                                <td>
                                    <span className={`tag ${o.status === "cancelled" ? "tag--danger" : "tag--general"}`}>
                                        {ORDER_STATUS[o.status]?.label}
                                        {o.status === "delivered" && o.loanId ? " · fiado" : ""}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

import { useEffect, useRef } from "react";
import { Lock, Bike, ShoppingBag } from "lucide-react";
import { dayKey, formatDueTime, keyToDate } from "../../lib/orders";

/**
 * Aviso MUY visible al vender algo que está apartado para pedidos de otros clientes.
 * «No vender» es la opción por defecto: Enter y Escape no venden.
 */
export default function ReserveWarningModal({ product, conflict, onCancel, onConfirm }) {
    const cancelRef = useRef(null);
    useEffect(() => {
        cancelRef.current?.focus();
        // Enter y Escape = «No vender», sin importar dónde esté el foco.
        const onKey = (e) => {
            if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
            }
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, [onCancel]);

    const today = dayKey();
    const { stock, reserved, available } = conflict;
    const headline = available <= 0 ? "Todo lo que queda está reservado" : `Solo ${available} disponible${available === 1 ? "" : "s"}: el resto está reservado`;

    return (
        <div className="modal-backdrop reserve-backdrop">
            <div className="modal modal--sm reserve" role="alertdialog" aria-labelledby="reserve-title" onMouseDown={(e) => e.stopPropagation()}>
                <div className="reserve__band">
                    <Lock size={30} />
                    <div>
                        <div className="reserve__product">{product.name}</div>
                        <h2 id="reserve-title" className="reserve__title">{headline}</h2>
                    </div>
                </div>
                <div className="reserve__body">
                    <p>
                        Hay <b>{stock}</b> en stock y <b>{reserved}</b> {reserved === 1 ? "está apartado" : "están apartados"} para {conflict.orders.length === 1 ? "este pedido" : "estos pedidos"}:
                    </p>
                    <ul className="reserve__orders">
                        {conflict.orders.map((o) => (
                            <li key={o.id}>
                                {o.kind === "delivery" ? <Bike size={16} /> : <ShoppingBag size={16} />}
                                <b>{o.customerName}</b>
                                <span className="muted">
                                    {o.dueDate < today ? `atrasado (${keyToDate(o.dueDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" })})` : "hoy"}
                                    {o.dueTime ? ` · ${formatDueTime(o.dueTime)}` : ""}
                                </span>
                                <span className="reserve__qty">{o.qty} und.</span>
                            </li>
                        ))}
                    </ul>
                    <p className="reserve__warn">Si lo vendes, puede faltar para esos clientes.</p>
                </div>
                <div className="modal__actions reserve__actions">
                    <button ref={cancelRef} className="btn btn--primary btn--lg" onClick={onCancel}>
                        No vender
                    </button>
                    <button className="btn btn--ghost btn--lg reserve__force" onClick={onConfirm}>
                        Vender igual
                    </button>
                </div>
            </div>
        </div>
    );
}

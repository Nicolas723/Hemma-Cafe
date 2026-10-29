import { useState } from "react";
import { ArrowUpFromLine, Save, Trash2 } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { ChipGroup, Field, Modal, MoneyInput } from "../../components/ui";
import { formatCurrency, formatTime } from "../../lib/format";

const CONCEPTS = ["Pago a proveedor", "Insumos", "Domicilio", "Retiro del dueño"].map((c) => ({ value: c, label: c }));

/** Registrar una salida de efectivo de la caja (gasto pagado con el dinero de la caja). */
export function CashOutForm({ onClose }) {
    const { actions } = useData();
    const { showToast } = useUi();
    const [amount, setAmount] = useState("");
    const [concept, setConcept] = useState("");
    const [detail, setDetail] = useState("");

    const submit = (e) => {
        e.preventDefault();
        const value = parseInt(amount, 10) || 0;
        const text = [concept, detail.trim()].filter(Boolean).join(" · ");
        if (value <= 0) return showToast("Escribe el valor que salió de la caja", "warning");
        if (!text) return showToast("Elige o escribe el motivo", "warning");
        actions.addCashOut({ amount: value, concept: text });
        showToast(`Salida de ${formatCurrency(value)} registrada`, "success");
        onClose();
    };

    return (
        <Modal title="Salida de caja" icon={ArrowUpFromLine} onClose={onClose} size="sm">
            <form className="stack" onSubmit={submit}>
                <Field label="¿Cuánto efectivo salió?">
                    <MoneyInput value={amount} onChange={setAmount} autoFocus />
                </Field>
                <Field label="Motivo">
                    <ChipGroup options={CONCEPTS} value={concept} onChange={(v) => setConcept(v === concept ? "" : v)} />
                </Field>
                <input className="input" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Detalle (ej: pan de la mañana, hielo)" />
                <p className="muted small">Se descuenta del efectivo esperado en el cierre y queda en el registro.</p>
                <div className="modal__actions">
                    <button type="button" className="btn btn--ghost btn--lg" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn--primary btn--lg">
                        <Save size={18} /> Registrar salida
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/** Salidas del periodo actual del cierre. */
export function CashOutList({ outs, total, onNew }) {
    const { actions } = useData();
    const { showConfirm } = useUi();
    const { isAdmin, can } = useAuth();
    return (
        <div className="cash-outs">
            <div className="cash-outs__head">
                <div>
                    <b>Salidas de caja</b>
                    <div className="muted small">{outs.length ? `${outs.length} · ${formatCurrency(total)} menos en efectivo` : "Efectivo que salió de la caja hoy (pagos, insumos…)"}</div>
                </div>
                {can("cashOut") && (
                    <button className="btn btn--soft" onClick={onNew}>
                        <ArrowUpFromLine size={18} /> Registrar salida
                    </button>
                )}
            </div>
            {outs.map((o) => (
                <div className="cash-outs__row" key={o.id}>
                    <span className="muted small">{formatTime(o.date)}</span>
                    <span className="cash-outs__concept">
                        {o.concept}
                        <span className="muted small"> · {o.registeredBy || "—"}</span>
                    </span>
                    <b>−{formatCurrency(o.amount)}</b>
                    {isAdmin && (
                        <button
                            className="icon-btn icon-btn--danger"
                            aria-label="Eliminar salida"
                            onClick={() => showConfirm(`¿Eliminar la salida de ${formatCurrency(o.amount)} (${o.concept})?`, { confirmLabel: "Eliminar" }).then((ok) => ok && actions.deleteCashOut(o))}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

import { Plus, X } from "lucide-react";
import { PaymentIcon } from "../lib/paymentIcons";
import { formatCurrency } from "../lib/format";
import { MoneyInput } from "./ui";

/** Métodos de pago como botones grandes: un solo toque (antes era un <select>). */
export function MethodPicker({ methods, value, onChange, compact }) {
    return (
        <div className={`methods ${compact ? "methods--compact" : ""}`} role="radiogroup">
            {methods.map((m) => (
                <button
                    key={m.id || m.name}
                    type="button"
                    role="radio"
                    aria-checked={value === m.name}
                    className={`method ${value === m.name ? "is-active" : ""}`}
                    onClick={() => onChange(m.name)}
                >
                    <PaymentIcon method={m} size={compact ? 16 : 20} />
                    <span>{m.name}</span>
                </button>
            ))}
        </div>
    );
}

let rowSeq = 0;
export const newSplitRow = (method = "Efectivo", amount = "") => ({ key: ++rowSeq, method, amount });

/** Editor de pago dividido entre varios métodos. */
export function SplitEditor({ methods, rows, onChange, total }) {
    const paid = rows.reduce((s, r) => s + (parseInt(r.amount, 10) || 0), 0);
    const remaining = total - paid;
    const update = (key, patch) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

    return (
        <div className="split">
            {rows.map((r, i) => (
                <div className="split__row" key={r.key}>
                    <select value={r.method} onChange={(e) => update(r.key, { method: e.target.value })}>
                        {methods.map((m) => (
                            <option key={m.id || m.name} value={m.name}>
                                {m.name}
                            </option>
                        ))}
                    </select>
                    <MoneyInput value={r.amount} onChange={(v) => update(r.key, { amount: v })} />
                    {remaining > 0 && (
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            title="Completar con lo que falta"
                            onClick={() => update(r.key, { amount: String((parseInt(r.amount, 10) || 0) + remaining) })}
                        >
                            Resto
                        </button>
                    )}
                    {rows.length > 1 && (
                        <button type="button" className="icon-btn icon-btn--danger" onClick={() => onChange(rows.filter((x) => x.key !== r.key))} aria-label={`Quitar pago ${i + 1}`}>
                            <X size={16} />
                        </button>
                    )}
                </div>
            ))}
            <div className="split__foot">
                <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                        const used = new Set(rows.map((r) => r.method));
                        const next = methods.find((m) => !used.has(m.name))?.name || methods[0]?.name || "Efectivo";
                        onChange([...rows, newSplitRow(next, remaining > 0 ? String(remaining) : "")]);
                    }}
                >
                    <Plus size={16} /> Otro método
                </button>
                <span className={`split__status ${remaining === 0 ? "is-ok" : remaining > 0 ? "is-pending" : "is-over"}`}>
                    {remaining === 0 ? "Cubierto" : remaining > 0 ? `Faltan ${formatCurrency(remaining)}` : `Sobran ${formatCurrency(-remaining)}`}
                </span>
            </div>
        </div>
    );
}

/** Convierte las filas del editor en el arreglo que se guarda en Firestore. */
export function splitRowsToPayments(rows, total) {
    const valid = rows.map((r) => ({ method: r.method, amount: parseInt(r.amount, 10) || 0 })).filter((p) => p.amount > 0);
    return valid.length ? valid : [{ method: rows[0]?.method || "Efectivo", amount: total }];
}

import { useState } from "react";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { ChipGroup, Modal } from "./ui";
import { DATE_PRESETS, fromInputDate, toInputDate } from "../lib/dates";

const CUSTOM = "custom";
const PRESET_OPTIONS = [...DATE_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: CUSTOM, label: "Elegir fechas" }];

/** Como Field pero sin <label>: tocar el título no debe activar el primer chip. */
export function Group({ label, hint, children }) {
    return (
        <div className="field">
            <span className="field__label">{label}</span>
            {children}
            {hint && <span className="field__hint">{hint}</span>}
        </div>
    );
}

/** Estado de un filtro de fechas: { preset, range }. */
export function useRangeFilter(initialPreset = "today", initialRange) {
    const [state, setState] = useState(() => ({
        preset: initialPreset,
        range: initialRange || DATE_PRESETS.find((p) => p.id === initialPreset)?.range() || [null, null],
    }));
    return [state, setState];
}

/**
 * Fechas rápidas + "Elegir fechas". Con `locked` (cajero sin permiso de ver días anteriores)
 * solo se puede descargar lo de hoy.
 */
export function RangeField({ value, onChange, locked = false, label = "Fechas" }) {
    if (locked) {
        return (
            <Group label={label}>
                <p className="muted small">Solo lo de hoy (tu usuario no ve días anteriores).</p>
            </Group>
        );
    }
    const choose = (preset) => {
        if (preset === CUSTOM) return onChange({ preset, range: value.range[0] || value.range[1] ? value.range : DATE_PRESETS[0].range() });
        onChange({ preset, range: DATE_PRESETS.find((p) => p.id === preset).range() });
    };
    const [start, end] = value.range;
    return (
        <Group label={label}>
            <ChipGroup options={PRESET_OPTIONS} value={value.preset} onChange={choose} className="chips--wrap" />
            {value.preset === CUSTOM && (
                <div className="filters__dates export__dates">
                    <input type="date" className="input" aria-label="Desde" value={toInputDate(start)} onChange={(e) => onChange({ preset: CUSTOM, range: [fromInputDate(e.target.value), end] })} />
                    <span className="muted">a</span>
                    <input type="date" className="input" aria-label="Hasta" value={toInputDate(end)} onChange={(e) => onChange({ preset: CUSTOM, range: [start, fromInputDate(e.target.value)] })} />
                </div>
            )}
        </Group>
    );
}

/**
 * Ventana "Descargar Excel": filtros (children), cuántas filas saldrán y el botón.
 * onDownload puede ser async; mientras corre, el botón queda deshabilitado.
 */
export default function ExportDialog({ title = "Descargar Excel", count, noun = ["registro", "registros"], loading = false, onDownload, onClose, children }) {
    const [busy, setBusy] = useState(false);
    const empty = !loading && count === 0;
    const download = async () => {
        setBusy(true);
        try {
            const ok = await onDownload();
            if (ok !== false) onClose();
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal
            title={title}
            icon={FileSpreadsheet}
            onClose={onClose}
            footer={
                <>
                    <span className={`export__count ${empty ? "is-empty" : ""}`}>
                        {loading ? (
                            <>
                                <Loader2 size={16} className="spin" /> Buscando…
                            </>
                        ) : empty ? (
                            "No hay datos con esos filtros"
                        ) : (
                            <>
                                Se descargarán <b>{count}</b> {count === 1 ? noun[0] : noun[1]}
                            </>
                        )}
                    </span>
                    <button className="btn btn--ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button className="btn btn--primary" onClick={download} disabled={busy || loading || empty}>
                        <Download size={18} /> {busy ? "Descargando…" : "Descargar"}
                    </button>
                </>
            }
        >
            <div className="export">{children}</div>
        </Modal>
    );
}

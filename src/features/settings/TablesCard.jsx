import { useState } from "react";
import { UtensilsCrossed, Plus, Trash2, Store } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { COUNTER, readTables, saveTables } from "../../lib/tables";
import { readJSON } from "../../lib/storage";

/** Mesas de este equipo: agregar, renombrar o quitar (el mostrador siempre queda). */
export default function TablesCard() {
    const { mode } = useData();
    const { showToast } = useUi();
    const [tables, setTables] = useState(() => readTables().filter((t) => t.id !== COUNTER.id));

    const persist = (next) => {
        setTables(next);
        saveTables(next);
    };

    const add = () => {
        const n = tables.length + 1;
        persist([...tables, { id: `mesa-${Date.now().toString(36)}`, label: `Mesa ${n}` }]);
    };

    const remove = (t) => {
        const open = readJSON(`pos_tables_state_${mode}`, {})[t.id] || [];
        if (open.length) return showToast(`«${t.label}» tiene una orden abierta: cóbrala o vacíala antes de quitarla`, "warning");
        persist(tables.filter((x) => x.id !== t.id));
    };

    return (
        <section className="card stack">
            <h2 className="card-title">
                <UtensilsCrossed size={20} /> Mesas de este equipo
            </h2>
            <p className="muted small">Cada punto de venta puede tener sus propias mesas. El mostrador siempre está disponible.</p>
            <div className="tables-config">
                <div className="tables-config__row is-fixed">
                    <Store size={18} />
                    <span>{COUNTER.label}</span>
                </div>
                {tables.map((t) => (
                    <div className="tables-config__row" key={t.id}>
                        <UtensilsCrossed size={18} />
                        <input
                            className="input"
                            value={t.label}
                            maxLength={20}
                            onChange={(e) => setTables(tables.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))}
                            onBlur={() => saveTables(tables)}
                            aria-label="Nombre de la mesa"
                        />
                        <button className="icon-btn icon-btn--danger" onClick={() => remove(t)} aria-label={`Quitar ${t.label}`}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
            <button className="btn btn--ghost" onClick={add} disabled={tables.length >= 20}>
                <Plus size={18} /> Agregar mesa
            </button>
        </section>
    );
}

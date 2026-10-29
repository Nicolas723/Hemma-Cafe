import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { PackagePlus, Truck, Minus, Plus, Trash2, Save } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { EmptyState, Field, Modal, SearchInput } from "../../components/ui";
import { formatDateTime, toDate } from "../../lib/format";
import { isFlexible } from "../../lib/pricing";
import { useDebounced } from "../../lib/hooks";

/** Registrar la llegada de mercancía (pan del día, proveedor…): suma stock y deja constancia. */
export function StockEntryForm({ onClose }) {
    const { products, actions } = useData();
    const { showToast } = useUi();
    const [search, setSearch] = useState("");
    const [lines, setLines] = useState([]); // [{ id, name, qty }]
    const [note, setNote] = useState("");
    const q = useDebounced(search.trim().toLowerCase(), 120);

    const matches = useMemo(
        () =>
            q
                ? products
                      .filter((p) => !isFlexible(p) && p.name?.toLowerCase().includes(q) && !lines.some((l) => l.id === p.id))
                      .slice(0, 8)
                : [],
        [products, q, lines]
    );

    const add = (p) => {
        setLines((ls) => [...ls, { id: p.id, name: p.name, qty: 1 }]);
        setSearch("");
    };
    const setQty = (id, qty) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, qty: Math.max(0, qty) } : l)));
    // Funcional: varios toques rápidos en +/− se suman todos.
    const bump = (id, delta) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l)));
    const total = lines.reduce((s, l) => s + l.qty, 0);

    const submit = (e) => {
        e.preventDefault();
        if (!actions.registerStockEntry({ lines, note: note.trim() })) return showToast("Agrega al menos un producto con cantidad", "warning");
        showToast(`Llegada registrada: +${total} unidades`, "success");
        onClose();
    };

    return (
        <Modal title="Registrar llegada de mercancía" icon={Truck} onClose={onClose} size="md">
            <form className="stack" onSubmit={submit}>
                <SearchInput value={search} onChange={setSearch} placeholder="Busca el producto que llegó…" autoFocus />
                {matches.length > 0 && (
                    <div className="entry-matches">
                        {matches.map((p) => (
                            <button type="button" key={p.id} className="entry-match" onClick={() => add(p)}>
                                <Plus size={16} /> {p.name} <span className="muted small">· hay {p.quantity || 0}</span>
                            </button>
                        ))}
                    </div>
                )}
                {lines.length === 0 ? (
                    <p className="muted small">Busca y toca cada producto que llegó; luego ajusta la cantidad.</p>
                ) : (
                    <div className="entry-lines">
                        {lines.map((l) => (
                            <div className="entry-line" key={l.id}>
                                <b>{l.name}</b>
                                <div className="stepper">
                                    <button type="button" onClick={() => bump(l.id, -1)} aria-label="Menos">
                                        <Minus size={16} />
                                    </button>
                                    <input inputMode="numeric" value={l.qty} onChange={(e) => setQty(l.id, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)} aria-label="Cantidad" />
                                    <button type="button" onClick={() => bump(l.id, 1)} aria-label="Más">
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <button type="button" className="icon-btn icon-btn--danger" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label="Quitar">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <Field label="Nota (opcional)">
                    <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: proveedor, factura, horneada de la mañana" />
                </Field>
                <div className="modal__actions">
                    <button type="button" className="btn btn--ghost btn--lg" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn--primary btn--lg" disabled={!total}>
                        <Save size={18} /> Sumar {total || ""} al stock
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/** Historial de llegadas de mercancía. */
export function StockEntriesPanel({ onNew }) {
    const { col } = useData();
    const [entries, setEntries] = useState(null);

    useEffect(
        () =>
            onSnapshot(
                query(col("stockEntries"), orderBy("date", "desc"), limit(100)),
                (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
                (err) => {
                    console.error(err);
                    setEntries([]);
                }
            ),
        [col]
    );

    return (
        <div className="card card--flush">
            <div className="section-head section-head--pad">
                <h2>Llegadas de mercancía</h2>
                <button className="btn btn--primary" onClick={onNew}>
                    <PackagePlus size={18} /> Registrar llegada
                </button>
            </div>
            {entries === null ? null : entries.length === 0 ? (
                <EmptyState icon={Truck} title="Aún no hay llegadas registradas">
                    Cada vez que llegue pan o mercancía, regístrala aquí: suma el stock y queda quién la recibió.
                </EmptyState>
            ) : (
                <div className="activity">
                    {entries.map((e) => (
                        <div className="activity__row" key={e.id}>
                            <span className="entry-units">+{e.units}</span>
                            <div className="activity__body">
                                <div>{(e.items || []).map((i) => `${i.name} +${i.qty}`).join(" · ")}</div>
                                <div className="muted small">
                                    {e.registeredBy || "—"}
                                    {e.note && ` · ${e.note}`}
                                </div>
                            </div>
                            <span className="muted small nowrap">{formatDateTime(toDate(e.date))}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

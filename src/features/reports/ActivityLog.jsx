import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { History } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { ChipGroup, EmptyState, SearchInput } from "../../components/ui";
import { AUDIT_COLLECTION, AUDIT_TYPES } from "../../lib/audit";
import { formatDateTime, initials, toDate } from "../../lib/format";
import { useDebounced } from "../../lib/hooks";

const TYPE_OPTIONS = [{ value: "", label: "Todo" }, ...Object.entries(AUDIT_TYPES).map(([value, t]) => ({ value, label: t.label }))];

/** Registro de actividad (solo administradores): quién hizo qué y cuándo. */
export default function ActivityLog() {
    const { col } = useData();
    const [entries, setEntries] = useState(null);
    const [type, setType] = useState("");
    const [search, setSearch] = useState("");
    const q = useDebounced(search.trim().toLowerCase(), 150);

    useEffect(
        () =>
            onSnapshot(
                query(col(AUDIT_COLLECTION), orderBy("at", "desc"), limit(300)),
                (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
                (err) => {
                    console.error(err);
                    setEntries([]);
                }
            ),
        [col]
    );

    const rows = useMemo(
        () =>
            (entries || []).filter(
                (e) => (!type || e.type === type) && (!q || `${e.userName} ${e.action} ${e.detail}`.toLowerCase().includes(q))
            ),
        [entries, type, q]
    );

    return (
        <>
            <div className="card filters">
                <div className="filters__row">
                    <SearchInput value={search} onChange={setSearch} placeholder="Buscar por persona, acción o detalle…" />
                </div>
                <ChipGroup options={TYPE_OPTIONS} value={type} onChange={setType} className="chips--scroll" />
            </div>
            <div className="card card--flush">
                {entries === null ? (
                    <EmptyState icon={History} title="Cargando…" />
                ) : rows.length === 0 ? (
                    <EmptyState icon={History} title="Sin actividad registrada">
                        Aquí aparecen ediciones y anulaciones de ventas, descuentos, ajustes de stock, cierres y cambios de usuarios.
                    </EmptyState>
                ) : (
                    <div className="activity">
                        {rows.map((e) => (
                            <div className="activity__row" key={e.id}>
                                <span className="avatar avatar--sm">{initials(e.userName)}</span>
                                <div className="activity__body">
                                    <div>
                                        <b>{e.userName}</b> {e.action.charAt(0).toLowerCase() + e.action.slice(1)}
                                    </div>
                                    {e.detail && <div className="muted small">{e.detail}</div>}
                                </div>
                                <span className={`tag activity__type activity__type--${AUDIT_TYPES[e.type]?.tone || "info"}`}>{AUDIT_TYPES[e.type]?.label || e.type}</span>
                                <span className="muted small nowrap">{formatDateTime(toDate(e.at))}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <p className="muted small">Se muestran los últimos 300 movimientos.</p>
        </>
    );
}

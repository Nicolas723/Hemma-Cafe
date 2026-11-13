import { useEffect, useMemo, useState } from "react";
import { Receipt, FileSpreadsheet, Printer, Pencil, ChevronDown, ChevronRight, StickyNote, TrendingUp, ShoppingBag, Hash, Coins, Loader2 } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { ChipGroup, EmptyState, PageHeader, SearchInput, StatCard, Toggle } from "../../components/ui";
import { PaymentIcon } from "../../lib/paymentIcons";
import { formatCurrency, formatDate, formatTime } from "../../lib/format";
import { DATE_PRESETS, fromInputDate, inRange, toInputDate } from "../../lib/dates";
import { useDebounced } from "../../lib/hooks";
import TransactionEditor from "./TransactionEditor";
import SalesExport from "./SalesExport";
import useSalesSource from "./useSalesSource";

const PAGE = 150;

const paymentsOf = (t) => (t.payments?.length ? t.payments : [{ method: t.paymentMethod || "Efectivo", amount: t.total || 0 }]);
const unitsOf = (t) => (t.items || []).reduce((s, i) => s + (i.partial ? 0 : i.cartQuantity || 1), 0);

export default function HistoryScreen({ initialRange, onConsumeRange }) {
    const { vendedores, paymentMethods } = useData();
    const { printReceipt } = useUi();
    const { can } = useAuth();
    // Sin este permiso (cajero) solo se ven las ventas de hoy.
    const pastSales = can("pastSales");

    const [preset, setPreset] = useState(initialRange && pastSales ? "custom" : "today");
    const [chosenRange, setRange] = useState(() => (pastSales && initialRange) || DATE_PRESETS[0].range());
    const range = useMemo(() => (pastSales ? chosenRange : DATE_PRESETS[0].range()), [pastSales, chosenRange]);
    const [search, setSearch] = useState("");
    const [vendedor, setVendedor] = useState("");
    const [method, setMethod] = useState("");
    const [onlyNotes, setOnlyNotes] = useState(false);
    const [expanded, setExpanded] = useState(null);
    const [editing, setEditing] = useState(null);
    const [limit, setLimit] = useState(PAGE);
    const [exporting, setExporting] = useState(false);
    const query = useDebounced(search.trim().toLowerCase(), 200);

    useEffect(() => {
        if (initialRange) onConsumeRange?.();
    }, [initialRange, onConsumeRange]);

    // Ventas en vivo + antiguas si el rango empieza antes de la ventana en vivo.
    const { source, loading: archiveLoading } = useSalesSource(range);

    const filtered = useMemo(
        () =>
            source.filter((t) => {
                if (!inRange(t.date, range)) return false;
                if (vendedor && t.vendedorName !== vendedor) return false;
                if (method && !paymentsOf(t).some((p) => p.method === method)) return false;
                if (onlyNotes && !t.notes) return false;
                if (query && !(t.items || []).some((i) => i.name?.toLowerCase().includes(query)) && !t.customerName?.toLowerCase().includes(query)) return false;
                return true;
            }),
        [source, range, vendedor, method, onlyNotes, query]
    );

    useEffect(() => setLimit(PAGE), [filtered]);

    const stats = useMemo(() => {
        const byMethod = {};
        let total = 0;
        let units = 0;
        for (const t of filtered) {
            total += t.total || 0;
            units += unitsOf(t);
            for (const p of paymentsOf(t)) byMethod[p.method] = (byMethod[p.method] || 0) + (p.amount || 0);
        }
        return { total, units, count: filtered.length, avg: filtered.length ? total / filtered.length : 0, byMethod };
    }, [filtered]);

    const choosePreset = (id) => {
        setPreset(id);
        const p = DATE_PRESETS.find((x) => x.id === id);
        if (p) setRange(p.range());
    };

    const presetOptions = [...DATE_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Elegir fechas" }];
    const methodNames = useMemo(() => {
        const set = new Set(paymentMethods.map((m) => m.name));
        Object.keys(stats.byMethod).forEach((m) => set.add(m));
        return [...set];
    }, [paymentMethods, stats.byMethod]);

    return (
        <div className="page">
            <PageHeader icon={Receipt} title="Ventas" subtitle="Historial, filtros y reimpresión de recibos">
                {can("exportData") && (
                    <button className="btn btn--ghost" onClick={() => setExporting(true)}>
                        <FileSpreadsheet size={18} /> Exportar Excel
                    </button>
                )}
            </PageHeader>

            <div className="card filters">
                {pastSales ? (
                    <ChipGroup options={presetOptions} value={preset} onChange={choosePreset} />
                ) : (
                    <p className="muted small">Mostrando solo las ventas de hoy.</p>
                )}
                {pastSales && preset === "custom" && (
                    <div className="filters__dates">
                        <input type="date" className="input" value={toInputDate(range[0])} onChange={(e) => setRange([fromInputDate(e.target.value), range[1]])} />
                        <span className="muted">a</span>
                        <input type="date" className="input" value={toInputDate(range[1])} onChange={(e) => setRange([range[0], fromInputDate(e.target.value)])} />
                    </div>
                )}
                <div className="filters__row">
                    <SearchInput value={search} onChange={setSearch} placeholder="Producto o cliente…" />
                    <select className="select" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
                        <option value="">Todos los vendedores</option>
                        {vendedores.map((v) => (
                            <option key={v.id} value={v.name}>
                                {v.name}
                            </option>
                        ))}
                    </select>
                    <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="">Todos los pagos</option>
                        {methodNames.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                    <Toggle icon={StickyNote} label="Con notas" checked={onlyNotes} onChange={setOnlyNotes} />
                </div>
            </div>

            <div className="stats">
                <StatCard icon={TrendingUp} label="Total vendido" value={formatCurrency(stats.total)} tone="brand" />
                <StatCard icon={Hash} label="Ventas" value={stats.count} />
                <StatCard icon={ShoppingBag} label="Productos" value={stats.units} />
                <StatCard icon={Coins} label="Ticket promedio" value={formatCurrency(stats.avg)} />
            </div>

            {Object.keys(stats.byMethod).length > 0 && (
                <div className="method-bars card">
                    {Object.entries(stats.byMethod)
                        .sort((a, b) => b[1] - a[1])
                        .map(([m, v]) => (
                            <button key={m} className={`method-bar ${method === m ? "is-active" : ""}`} onClick={() => setMethod(method === m ? "" : m)}>
                                <PaymentIcon method={m} size={18} />
                                <span className="method-bar__name">{m}</span>
                                <span className="method-bar__track">
                                    <span style={{ width: `${stats.total ? Math.max(3, (v / stats.total) * 100) : 0}%` }} />
                                </span>
                                <b>{formatCurrency(v)}</b>
                            </button>
                        ))}
                </div>
            )}

            <div className="card card--flush">
                {archiveLoading && (
                    <div className="loading-row">
                        <Loader2 size={18} className="spin" /> Cargando ventas antiguas…
                    </div>
                )}
                {filtered.length === 0 && !archiveLoading ? (
                    <EmptyState icon={Receipt} title="No hay ventas con estos filtros" />
                ) : (
                    <div className="tx-list">
                        {filtered.slice(0, limit).map((t) => {
                            const open = expanded === t.id;
                            return (
                                <div key={t.id} className={`tx ${open ? "is-open" : ""}`}>
                                    <button className="tx__row" onClick={() => setExpanded(open ? null : t.id)}>
                                        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        <span className="tx__when">
                                            <b>{formatTime(t.date)}</b>
                                            <span className="muted">{formatDate(t.date)}</span>
                                        </span>
                                        <span className="tx__who">
                                            <span>{t.customerName || "General"}</span>
                                            <span className="muted">{t.vendedorName || "—"}</span>
                                        </span>
                                        <span className="tx__items muted">
                                            {unitsOf(t)} und.
                                            {t.type === "abono" && <span className="tag tag--warn">Abono</span>}
                                            {t.type === "anticipo" && <span className="tag tag--warn">Anticipo</span>}
                                            {t.orderId && t.type !== "anticipo" && <span className="tag tag--general">Pedido</span>}
                                            {t.notes && <StickyNote size={14} />}
                                        </span>
                                        <span className="tx__pays">
                                            {paymentsOf(t).map((p, i) => (
                                                <span key={i} className="pay-pill" title={`${p.method} ${formatCurrency(p.amount)}`}>
                                                    <PaymentIcon method={p.method} size={14} /> {p.method}
                                                </span>
                                            ))}
                                        </span>
                                        <span className="tx__total">{formatCurrency(t.total)}</span>
                                    </button>
                                    {open && (
                                        <div className="tx__detail">
                                            <table className="table table--compact">
                                                <thead>
                                                    <tr>
                                                        <th>Producto</th>
                                                        <th className="c">Cant.</th>
                                                        <th className="r">Precio</th>
                                                        <th className="r">Descuento</th>
                                                        <th className="r">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(t.items || []).map((i, idx) => (
                                                        <tr key={idx}>
                                                            <td>{i.name}</td>
                                                            <td className="c">{i.partial ? "—" : i.cartQuantity || 1}</td>
                                                            <td className="r">{formatCurrency(i.originalPrice ?? i.price)}</td>
                                                            <td className="r text-danger">{i.discount > 0 ? `-${formatCurrency(i.discount)}` : "—"}</td>
                                                            <td className="r">
                                                                <b>{formatCurrency(i.subtotal ?? i.price * (i.cartQuantity || 1))}</b>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {paymentsOf(t).length > 1 && (
                                                <div className="note">Pago dividido: {paymentsOf(t).map((p) => `${p.method} ${formatCurrency(p.amount)}`).join(" + ")}</div>
                                            )}
                                            {t.notes && <div className="note">{t.notes}</div>}
                                            <div className="tx__actions">
                                                <button className="btn btn--ghost" onClick={() => printReceipt(t)}>
                                                    <Printer size={16} /> Reimprimir
                                                </button>
                                                {can("editSales") && t.type !== "anticipo" && (
                                                    <button className="btn btn--soft" onClick={() => setEditing(t)}>
                                                        <Pencil size={16} /> Editar
                                                    </button>
                                                )}
                                                {t.type === "anticipo" && <span className="muted small">El anticipo se maneja desde Pedidos (si se cancela, se registra la devolución).</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filtered.length > limit && (
                            <button className="btn btn--ghost btn--block" onClick={() => setLimit((l) => l + PAGE)}>
                                Ver {Math.min(PAGE, filtered.length - limit)} más (de {filtered.length - limit})
                            </button>
                        )}
                    </div>
                )}
            </div>

            {editing && <TransactionEditor transaction={editing} onClose={() => setEditing(null)} />}
            {exporting && (
                <SalesExport
                    locked={!pastSales}
                    initial={{ preset: pastSales ? preset : "today", range, vendedor, method, onlyNotes, query }}
                    onClose={() => setExporting(false)}
                />
            )}
        </div>
    );
}

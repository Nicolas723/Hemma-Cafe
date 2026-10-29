import { useEffect, useMemo, useState } from "react";
import { Receipt, FileSpreadsheet, Printer, Pencil, ChevronDown, ChevronRight, StickyNote, TrendingUp, ShoppingBag, Hash, Coins, Loader2 } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { ChipGroup, EmptyState, PageHeader, SearchInput, StatCard, Toggle } from "../../components/ui";
import { PaymentIcon } from "../../lib/paymentIcons";
import { formatCurrency, formatDate, formatTime, toDate } from "../../lib/format";
import { DATE_PRESETS, fromInputDate, inRange, startOfDay, toInputDate } from "../../lib/dates";
import { exportWorkbook, today } from "../../lib/excel";
import { useDebounced } from "../../lib/hooks";
import TransactionEditor from "./TransactionEditor";

const PAGE = 150;

const paymentsOf = (t) => (t.payments?.length ? t.payments : [{ method: t.paymentMethod || "Efectivo", amount: t.total || 0 }]);
const unitsOf = (t) => (t.items || []).reduce((s, i) => s + (i.partial ? 0 : i.cartQuantity || 1), 0);

export default function HistoryScreen({ initialRange, onConsumeRange }) {
    const { transactions, vendedores, paymentMethods, products, categories, liveSince, actions } = useData();
    const { showToast, printReceipt } = useUi();
    const { can } = useAuth();

    const [preset, setPreset] = useState(initialRange ? "custom" : "today");
    const [range, setRange] = useState(() => initialRange || DATE_PRESETS[0].range());
    const [search, setSearch] = useState("");
    const [vendedor, setVendedor] = useState("");
    const [method, setMethod] = useState("");
    const [onlyNotes, setOnlyNotes] = useState(false);
    const [expanded, setExpanded] = useState(null);
    const [editing, setEditing] = useState(null);
    const [limit, setLimit] = useState(PAGE);
    const [archive, setArchive] = useState({ key: null, loading: false, rows: [] });
    const query = useDebounced(search.trim().toLowerCase(), 200);

    useEffect(() => {
        if (initialRange) onConsumeRange?.();
    }, [initialRange, onConsumeRange]);

    // Si el rango empieza antes de la ventana en vivo, se consultan las ventas antiguas.
    const needsArchive = !range[0] || startOfDay(range[0]) < liveSince;
    const archiveKey = needsArchive ? `${range[0]?.getTime() || 0}-${range[1]?.getTime() || 0}` : null;
    useEffect(() => {
        if (!archiveKey || archive.key === archiveKey) return;
        let cancelled = false;
        setArchive({ key: archiveKey, loading: true, rows: [] });
        actions
            .loadTransactionsRange(range[0], range[1])
            .then((rows) => !cancelled && setArchive({ key: archiveKey, loading: false, rows }))
            .catch((err) => {
                console.error(err);
                if (!cancelled) setArchive({ key: archiveKey, loading: false, rows: [] });
                showToast("No se pudieron cargar las ventas antiguas (¿sin internet?)", "warning");
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [archiveKey]);

    const source = useMemo(() => {
        if (!needsArchive) return transactions;
        // Unir ventas en vivo + antiguas, sin duplicados.
        const byId = new Map(archive.rows.map((t) => [t.id, t]));
        transactions.forEach((t) => byId.set(t.id, t));
        return [...byId.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }, [needsArchive, transactions, archive.rows]);

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

    const exportExcel = async () => {
        try {
            const productById = Object.fromEntries(products.map((p) => [p.id, p]));
            const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
            const rows = [];
            filtered.forEach((t) => {
                const d = toDate(t.date);
                const pays = paymentsOf(t);
                (t.items || []).forEach((item, idx) =>
                    rows.push({
                        fecha: d.toLocaleDateString("es-CO"),
                        hora: formatTime(d),
                        tipo: t.type === "abono" ? "Abono crédito" : "Venta",
                        vendedor: t.vendedorName || "N/A",
                        cliente: t.customerName || "General",
                        producto: item.name,
                        categoria: catById[productById[item.id]?.categoryId] || "Sin categoría",
                        original: item.originalPrice ?? item.price,
                        cantidad: item.partial ? 0 : item.cartQuantity || 1,
                        descuento: item.discount || 0,
                        subtotal: item.subtotal ?? item.price * (item.cartQuantity || 1),
                        total: idx === 0 ? t.total : null,
                        pago1: pays[0]?.method || "",
                        pago2: pays[1]?.method || "",
                        notas: idx === 0 ? t.notes || "" : "",
                    })
                );
            });
            await exportWorkbook(`Ventas_${today()}.xlsx`, [
                {
                    name: "Ventas",
                    columns: [
                        { header: "Fecha", key: "fecha", width: 12 },
                        { header: "Hora", key: "hora", width: 9 },
                        { header: "Tipo", key: "tipo", width: 14 },
                        { header: "Vendedor", key: "vendedor", width: 16 },
                        { header: "Cliente", key: "cliente", width: 18 },
                        { header: "Producto", key: "producto", width: 26 },
                        { header: "Categoría", key: "categoria", width: 16 },
                        { header: "Precio original", key: "original", money: true },
                        { header: "Cantidad", key: "cantidad", width: 9 },
                        { header: "Descuento", key: "descuento", money: true },
                        { header: "Subtotal", key: "subtotal", money: true },
                        { header: "Total venta", key: "total", money: true },
                        { header: "Pago 1", key: "pago1", width: 12 },
                        { header: "Pago 2", key: "pago2", width: 12 },
                        { header: "Notas", key: "notas", width: 30 },
                    ],
                    rows,
                },
            ]);
            showToast("Excel de ventas descargado", "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo exportar el Excel", "error");
        }
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
                    <button className="btn btn--ghost" onClick={exportExcel} disabled={!filtered.length}>
                        <FileSpreadsheet size={18} /> Exportar Excel
                    </button>
                )}
            </PageHeader>

            <div className="card filters">
                <ChipGroup options={presetOptions} value={preset} onChange={choosePreset} />
                {preset === "custom" && (
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
                {archive.loading && (
                    <div className="loading-row">
                        <Loader2 size={18} className="spin" /> Cargando ventas antiguas…
                    </div>
                )}
                {filtered.length === 0 && !archive.loading ? (
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
                                                {can("editSales") && (
                                                    <button className="btn btn--soft" onClick={() => setEditing(t)}>
                                                        <Pencil size={16} /> Editar
                                                    </button>
                                                )}
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
        </div>
    );
}

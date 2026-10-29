import { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingUp, ShoppingBag, Receipt, Package, Clock, CreditCard, Users, History, Loader2, PiggyBank } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useAuth } from "../../context/AuthProvider";
import { ChipGroup, PageHeader } from "../../components/ui";
import { BarList, ColumnChart, Delta } from "../../components/Charts";
import { formatCurrency, formatDateLong } from "../../lib/format";
import { fromInputDate, toInputDate, endOfDay } from "../../lib/dates";
import { REPORT_PRESETS, bySeller, byPaymentMethod, incomeByTime, previousRange, salesByHour, summarize, topProducts } from "../../lib/reports";
import ActivityLog from "./ActivityLog";

/** $1,2 M · $350 mil · $8.500 */
function money(v, compact) {
    if (!compact || Math.abs(v) < 10000) return formatCurrency(v);
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
    return `$${Math.round(v / 1000).toLocaleString("es-CO")} mil`;
}
const count = (v) => `${Math.round(v)} venta${Math.round(v) === 1 ? "" : "s"}`;

const PRESET_OPTIONS = [...REPORT_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Elegir fechas" }];

export default function ReportsScreen() {
    const { transactions, liveSince, actions } = useData();
    const { isAdmin } = useAuth();
    const [tab, setTab] = useState("sales");
    const [preset, setPreset] = useState("week");
    const [custom, setCustom] = useState(() => [toInputDate(new Date()), toInputDate(new Date())]);
    const [productsBy, setProductsBy] = useState("revenue");
    const [older, setOlder] = useState(null); // ventas fuera de la ventana en vivo
    const [loading, setLoading] = useState(false);

    const range = useMemo(() => {
        if (preset === "custom") {
            const a = fromInputDate(custom[0]) || new Date();
            const b = fromInputDate(custom[1]) || a;
            return a <= b ? [a, endOfDay(b)] : [b, endOfDay(a)];
        }
        return REPORT_PRESETS.find((p) => p.id === preset).range();
    }, [preset, custom]);
    const prev = useMemo(() => previousRange(range), [range]);

    // Si el periodo (o el anterior, para comparar) es más viejo que lo sincronizado en vivo, se consulta aparte.
    const needsOlder = prev[0] < liveSince;
    useEffect(() => {
        if (!needsOlder) return setOlder(null);
        let cancelled = false;
        setLoading(true);
        actions
            .loadTransactionsRange(prev[0], range[1])
            .then((list) => !cancelled && setOlder(list))
            .catch((err) => console.error(err))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [needsOlder, prev, range, actions]);

    const source = needsOlder ? older || [] : transactions;
    const now = useMemo(() => summarize(source, range), [source, range]);
    const before = useMemo(() => summarize(source, prev), [source, prev]);
    const timeline = useMemo(() => incomeByTime(now.list, range), [now.list, range]);
    const hours = useMemo(() => salesByHour(now.list), [now.list]);
    const products = useMemo(() => topProducts(now.list, productsBy), [now.list, productsBy]);
    const methods = useMemo(() => byPaymentMethod(now.list), [now.list]);
    const sellers = useMemo(() => bySeller(now.list), [now.list]);
    const pct = (v) => (now.income ? `${Math.round((v / now.income) * 100)} %` : "");

    return (
        <div className="page">
            <PageHeader icon={BarChart3} title="Reportes" subtitle={`${formatDateLong(range[0])} – ${formatDateLong(range[1])}`}>
                {isAdmin && (
                    <ChipGroup
                        options={[
                            { value: "sales", label: "Ventas", icon: <TrendingUp size={16} /> },
                            { value: "activity", label: "Actividad", icon: <History size={16} /> },
                        ]}
                        value={tab}
                        onChange={setTab}
                        size="lg"
                    />
                )}
            </PageHeader>

            {tab === "activity" && isAdmin ? (
                <ActivityLog />
            ) : (
                <>
                    <div className="card filters">
                        <ChipGroup options={PRESET_OPTIONS} value={preset} onChange={setPreset} className="chips--scroll" />
                        {preset === "custom" && (
                            <div className="row-gap">
                                <input type="date" className="input input--date" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} />
                                <span className="muted">a</span>
                                <input type="date" className="input input--date" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} />
                            </div>
                        )}
                        {loading && (
                            <span className="muted small">
                                <Loader2 size={14} className="spin" /> Cargando ventas anteriores…
                            </span>
                        )}
                    </div>

                    <div className={`kpis ${isAdmin ? "kpis--5" : ""}`}>
                        <div className="kpi kpi--hero">
                            <span className="kpi__label">
                                <TrendingUp size={16} /> Ingresos
                            </span>
                            <strong className="kpi__value">{formatCurrency(now.income)}</strong>
                            <Delta current={now.income} previous={before.income} />
                            {now.abonosTotal > 0 && <span className="kpi__hint">Incluye {formatCurrency(now.abonosTotal)} en abonos a créditos</span>}
                        </div>
                        <div className="kpi">
                            <span className="kpi__label">
                                <Receipt size={16} /> Ventas
                            </span>
                            <strong className="kpi__value">{now.salesCount}</strong>
                            <Delta current={now.salesCount} previous={before.salesCount} />
                        </div>
                        <div className="kpi">
                            <span className="kpi__label">
                                <ShoppingBag size={16} /> Ticket promedio
                            </span>
                            <strong className="kpi__value">{formatCurrency(now.avgTicket)}</strong>
                            <Delta current={now.avgTicket} previous={before.avgTicket} />
                        </div>
                        <div className="kpi">
                            <span className="kpi__label">
                                <Package size={16} /> Productos vendidos
                            </span>
                            <strong className="kpi__value">{now.units}</strong>
                            <Delta current={now.units} previous={before.units} />
                        </div>
                        {isAdmin && (
                            <div className="kpi">
                                <span className="kpi__label">
                                    <PiggyBank size={16} /> Ganancia estimada
                                </span>
                                <strong className="kpi__value">{now.costCoverage ? formatCurrency(now.profit) : "—"}</strong>
                                {now.costCoverage ? (
                                    <>
                                        <Delta current={now.profit} previous={before.profit} />
                                        <span className="kpi__hint">
                                            Margen {now.margin} %{now.costCoverage < 100 && ` · solo el ${now.costCoverage} % de lo vendido tiene costo registrado`}
                                        </span>
                                    </>
                                ) : (
                                    <span className="kpi__hint">Registra el costo de los productos (Inventario → editar) para verla.</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="reports-grid">
                        <section className="card stack reports-grid__wide">
                            <h2 className="card-title">
                                <TrendingUp size={20} /> Ingresos por {timeline.byMonth ? "mes" : "día"}
                            </h2>
                            <ColumnChart
                                data={timeline.data}
                                format={money}
                                every={timeline.data.length > 16 ? Math.ceil(timeline.data.length / 12) : 1}
                                ariaLabel="Ingresos por día"
                                tableHeaders={[timeline.byMonth ? "Mes" : "Día", "Ingresos"]}
                            />
                        </section>

                        <section className="card stack">
                            <h2 className="card-title">
                                <Clock size={20} /> Horas pico
                            </h2>
                            <p className="muted small">Número de ventas según la hora del día.</p>
                            <ColumnChart data={hours} format={(v, compact) => (compact ? String(Math.round(v)) : count(v))} every={2} ariaLabel="Ventas por hora" tableHeaders={["Hora", "Ventas"]} />
                        </section>

                        <section className="card stack">
                            <div className="section-head" style={{ margin: 0 }}>
                                <h2 className="card-title">
                                    <Package size={20} /> Productos más vendidos
                                </h2>
                                <ChipGroup
                                    options={[
                                        { value: "revenue", label: "$" },
                                        { value: "units", label: "Und." },
                                        ...(isAdmin ? [{ value: "profit", label: "Ganancia" }] : []),
                                    ]}
                                    value={productsBy}
                                    onChange={setProductsBy}
                                />
                            </div>
                            <BarList
                                rows={products
                                    .filter((p) => productsBy !== "profit" || p.profit > 0)
                                    .map((p) => ({
                                        key: p.key,
                                        label: p.label,
                                        value: p[productsBy],
                                        sub:
                                            productsBy === "revenue"
                                                ? `${p.units} und.`
                                                : productsBy === "profit"
                                                ? `${Math.round((p.profit / p.revenue) * 100)} % de margen`
                                                : formatCurrency(p.revenue),
                                    }))}
                                format={productsBy === "units" ? (v) => `${v} und.` : formatCurrency}
                                empty={productsBy === "profit" ? "Registra el costo de los productos para ver cuáles dejan más ganancia" : undefined}
                            />
                        </section>

                        <section className="card stack">
                            <h2 className="card-title">
                                <CreditCard size={20} /> Por método de pago
                            </h2>
                            <BarList rows={methods.map((m) => ({ ...m, sub: pct(m.value) }))} format={formatCurrency} />
                        </section>

                        <section className="card stack">
                            <h2 className="card-title">
                                <Users size={20} /> Por vendedor
                            </h2>
                            <BarList rows={sellers.map((s) => ({ ...s, sub: count(s.count) }))} format={formatCurrency} />
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}

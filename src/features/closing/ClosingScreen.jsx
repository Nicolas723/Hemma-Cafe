import { useMemo, useState } from "react";
import { Calculator, CheckCheck, Save, FileSpreadsheet, Eye, Trash2, TrendingUp, Scale, ShoppingBag, Wallet, ClipboardCheck, Printer } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { ChipGroup, EmptyState, MoneyInput, PageHeader, StatCard } from "../../components/ui";
import { PaymentIcon } from "../../lib/paymentIcons";
import { formatCurrency, formatDate, toDate } from "../../lib/format";
import { DATE_PRESETS, inRange, isSameDay, startOfDay } from "../../lib/dates";
import { exportWorkbook, today } from "../../lib/excel";
import { readString, writeString } from "../../lib/storage";
import { closingMethods, closingPeriod, closingRows, isCash } from "../../lib/closing";
import { CashOutForm, CashOutList } from "./CashOut";

const signed = (n) => `${n > 0 ? "+" : ""}${formatCurrency(n)}`;
const tone = (n) => (n === 0 ? "ok" : n > 0 ? "over" : "short");

const CASH_BASE_KEY = "pos_cash_base";

export default function ClosingScreen({ onViewSales }) {
    const { transactions, performanceLogs, paymentMethods, cashOuts, actions } = useData();
    const { showToast, showConfirm, printClosing } = useUi();
    const { can, isAdmin, sessionUser } = useAuth();
    const [cashOutOpen, setCashOutOpen] = useState(false);
    const [counted, setCounted] = useState({});
    const [notes, setNotes] = useState("");
    const [preset, setPreset] = useState("month");
    // Base de caja: efectivo con que se abrió el día (se recuerda en este equipo).
    const [base, setBaseState] = useState(() => readString(CASH_BASE_KEY));
    const setBase = (v) => {
        setBaseState(v);
        writeString(CASH_BASE_KEY, v);
    };
    const baseValue = parseInt(base, 10) || 0;

    // Ventas y salidas desde el último cierre de hoy (o desde la medianoche). Cuentas en lib/closing.js.
    const current = useMemo(() => {
        const lastToday = performanceLogs.filter((l) => isSameDay(l.date, new Date())).sort((a, b) => toDate(b.date) - toDate(a.date))[0];
        const since = lastToday ? toDate(lastToday.date) : startOfDay();
        return { since, hadClosure: Boolean(lastToday), ...closingPeriod({ transactions, cashOuts, since }) };
    }, [transactions, cashOuts, performanceLogs]);

    const methods = useMemo(() => closingMethods(paymentMethods.map((m) => m.name), current.byMethod), [paymentMethods, current.byMethod]);
    const { rows, realTotal, difference, withDiff } = closingRows({
        methods,
        byMethod: current.byMethod,
        base: baseValue,
        outsTotal: current.outsTotal,
        counted,
        expectedTotal: current.expected,
    });

    const save = () => {
        const perMethodStats = Object.fromEntries(rows.map((r) => [r.method, { expected: r.expected, real: r.real, diff: r.diff }]));
        const result = actions.savePerformance({
            expectedTotal: current.expected,
            realTotal,
            difference,
            diffMethod: withDiff.length === 0 ? null : withDiff.length === 1 ? withDiff[0].method : "Varios",
            productsSold: current.units,
            paymentMethodTotals: current.byMethod,
            perMethodStats,
            cashBase: baseValue,
            cashOutsTotal: current.outsTotal,
            cashOuts: current.outs.map((o) => ({ concept: o.concept, amount: o.amount })),
            closedBy: sessionUser?.displayName || "",
            notes,
        });
        const printable = {
            date: new Date(),
            since: current.since,
            closedBy: sessionUser?.displayName || "",
            expectedTotal: current.expected,
            realTotal,
            difference,
            productsSold: current.units,
            perMethodStats,
            cashBase: baseValue,
            cashOuts: current.outs.map((o) => ({ concept: o.concept, amount: o.amount })),
            notes,
        };
        setCounted({});
        setNotes("");
        showToast(result === "merged" ? "Cierre del día actualizado" : "Cierre de caja guardado", "success", { label: "Imprimir", onClick: () => printClosing(printable) });
    };

    const presetOptions = DATE_PRESETS.filter((p) => p.id !== "today" && p.id !== "yesterday").map((p) => ({ value: p.id, label: p.label }));
    const range = DATE_PRESETS.find((p) => p.id === preset)?.range() || [null, null];
    const logs = performanceLogs.filter((l) => inRange(l.date, range));

    const exportExcel = async () => {
        try {
            const methodNames = new Set(paymentMethods.map((m) => m.name));
            performanceLogs.forEach((l) => Object.keys(l.perMethodStats || l.paymentMethodTotals || {}).forEach((m) => methodNames.add(m)));
            const list = [...methodNames];
            await exportWorkbook(`Cierres_${today()}.xlsx`, [
                {
                    name: "Cierres",
                    columns: [
                        { header: "Fecha", key: "fecha", width: 12 },
                        { header: "Productos", key: "productos", width: 10 },
                        { header: "Esperado", key: "esperado", money: true },
                        { header: "Real", key: "real", money: true },
                        { header: "Diferencia", key: "dif", money: true },
                        ...list.map((m) => ({ header: m, key: `m_${m}`, money: true })),
                        { header: "Diferencia en", key: "difm", width: 14 },
                        { header: "Notas", key: "notas", width: 30 },
                    ],
                    rows: performanceLogs.map((l) => ({
                        fecha: toDate(l.date).toLocaleDateString("es-CO"),
                        productos: l.productsSold || 0,
                        esperado: l.expectedTotal || 0,
                        real: l.realTotal || 0,
                        dif: l.difference || 0,
                        difm: l.diffMethod || "",
                        notas: l.notes || "",
                        ...Object.fromEntries(list.map((m) => [`m_${m}`, l.perMethodStats?.[m]?.real ?? l.paymentMethodTotals?.[m] ?? 0])),
                    })),
                },
            ]);
            showToast("Excel de cierres descargado", "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo exportar el Excel", "error");
        }
    };

    return (
        <div className="page">
            <PageHeader
                icon={Calculator}
                title="Cierre de caja"
                subtitle={current.hadClosure ? `Ventas desde el último cierre (${current.since.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })})` : "Ventas de hoy"}
            />

            <div className="stats">
                <StatCard icon={TrendingUp} label="Esperado en sistema" value={formatCurrency(current.expected)} hint={`${current.count} venta${current.count === 1 ? "" : "s"}`} tone="brand" />
                <StatCard
                    icon={Wallet}
                    label="Contado"
                    value={formatCurrency(realTotal)}
                    hint={baseValue || current.outsTotal ? `Sin base${current.outsTotal ? " y con las salidas" : ""}` : undefined}
                />
                <StatCard
                    icon={Scale}
                    label="Diferencia"
                    value={signed(difference)}
                    hint={difference === 0 ? "Cuadre perfecto" : difference > 0 ? "Sobrante" : "Faltante"}
                    tone={tone(difference)}
                />
                <StatCard icon={ShoppingBag} label="Productos vendidos" value={current.units} />
            </div>

            <div className="card">
                <div className="section-head">
                    <h2>Cuenta el dinero por método</h2>
                    <button className="btn btn--soft" onClick={() => setCounted({})} title="Rellena todo con lo esperado">
                        <CheckCheck size={18} /> Todo cuadra
                    </button>
                </div>
                <div className="cash-base">
                    <div>
                        <b>Base de caja</b>
                        <div className="muted small">Efectivo con que se abrió la caja hoy. Se suma a lo esperado en efectivo.</div>
                    </div>
                    <MoneyInput value={base} onChange={setBase} />
                </div>
                <CashOutList outs={current.outs} total={current.outsTotal} onNew={() => setCashOutOpen(true)} />
                <div className="count-grid">
                    {rows.map((r) => (
                        <div key={r.method} className={`count count--${tone(r.diff)}`}>
                            <div className="count__head">
                                <span className="count__icon">
                                    <PaymentIcon method={paymentMethods.find((p) => p.name === r.method) || r.method} size={20} />
                                </span>
                                <b>{r.method}</b>
                                <span className="muted count__exp">
                                    Esperado {formatCurrency(r.expected)}
                                    {isCash(r.method) && (baseValue > 0 || current.outsTotal > 0) && ` (${[baseValue > 0 && "con base", current.outsTotal > 0 && "menos salidas"].filter(Boolean).join(", ")})`}
                                </span>
                            </div>
                            <MoneyInput value={counted[r.method] ?? String(r.expected)} onChange={(v) => setCounted((c) => ({ ...c, [r.method]: v }))} />
                            <div className="count__diff">{r.diff === 0 ? "✓ Cuadra" : signed(r.diff)}</div>
                        </div>
                    ))}
                </div>
                <textarea className="input" rows={2} placeholder="Novedades del día (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <button className="btn btn--primary btn--xl btn--block" onClick={save} disabled={current.count === 0 && realTotal === 0}>
                    <Save size={20} /> Guardar cierre {difference !== 0 && `(${signed(difference)})`}
                </button>
            </div>

            <div className="card card--flush">
                <div className="section-head section-head--pad">
                    <h2>Cierres anteriores</h2>
                    <div className="row-gap">
                        <ChipGroup options={presetOptions} value={preset} onChange={setPreset} />
                        {can("exportData") && (
                            <button className="btn btn--ghost" onClick={exportExcel} disabled={!performanceLogs.length}>
                                <FileSpreadsheet size={18} /> Excel
                            </button>
                        )}
                    </div>
                </div>
                {logs.length === 0 ? (
                    <EmptyState icon={ClipboardCheck} title="No hay cierres en este periodo" />
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th className="r">Esperado</th>
                                    <th className="r">Real</th>
                                    <th className="r">Diferencia</th>
                                    <th>Desglose</th>
                                    <th>Notas</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((l) => (
                                    <tr key={l.id}>
                                        <td>
                                            <b>{formatDate(l.date)}</b>
                                            <div className="muted">{l.productsSold || 0} prod.</div>
                                        </td>
                                        <td className="r">{formatCurrency(l.expectedTotal)}</td>
                                        <td className="r">{formatCurrency(l.realTotal)}</td>
                                        <td className={`r diff diff--${tone(l.difference || 0)}`}>
                                            {signed(l.difference || 0)}
                                            {l.difference !== 0 && l.diffMethod && <div className="muted">{l.diffMethod}</div>}
                                        </td>
                                        <td>
                                            <div className="pills">
                                                {Object.entries(l.perMethodStats || l.paymentMethodTotals || {}).map(([m, s]) => {
                                                    const real = typeof s === "number" ? s : s.real;
                                                    const diff = typeof s === "number" ? 0 : s.diff || 0;
                                                    return (
                                                        <span key={m} className={`pay-pill pay-pill--${tone(diff)}`}>
                                                            <PaymentIcon method={m} size={13} /> {formatCurrency(real)}
                                                            {diff !== 0 && ` (${signed(diff)})`}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="ellipsis" title={l.notes}>
                                            {l.notes || "—"}
                                        </td>
                                        <td className="r nowrap">
                                            <button className="icon-btn" title="Ver ventas de ese día" onClick={() => onViewSales(l.date)}>
                                                <Eye size={18} />
                                            </button>
                                            <button className="icon-btn" title="Imprimir cierre" onClick={() => printClosing(l)}>
                                                <Printer size={18} />
                                            </button>
                                            {isAdmin && (
                                            <button
                                                className="icon-btn icon-btn--danger"
                                                title="Eliminar cierre"
                                                onClick={() =>
                                                    showConfirm("¿Eliminar este cierre de caja?", { confirmLabel: "Eliminar" }).then((ok) => {
                                                        if (!ok) return;
                                                        actions.deletePerformanceLog(l.id);
                                                        showToast("Cierre eliminado", "success");
                                                    })
                                                }
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {cashOutOpen && <CashOutForm onClose={() => setCashOutOpen(false)} />}
        </div>
    );
}

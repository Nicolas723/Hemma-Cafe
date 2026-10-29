import { useMemo, useState } from "react";
import { ChefHat } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { ChipGroup, EmptyState } from "../../components/ui";
import { WEEKDAYS, productionSuggestion } from "../../lib/production";

const WEEKS = 6;

/** Qué hornear o pedir: promedio de ese día de la semana en las últimas semanas menos el stock. */
export default function ProductionPanel() {
    const { transactions, products } = useData();
    const tomorrow = (new Date().getDay() + 1) % 7;
    const [weekday, setWeekday] = useState(tomorrow);
    const [onlyNeeded, setOnlyNeeded] = useState(true);

    const rows = useMemo(() => productionSuggestion({ transactions, products, weekday, weeks: WEEKS }), [transactions, products, weekday]);
    const shown = onlyNeeded ? rows.filter((r) => r.suggested > 0) : rows;
    const options = WEEKDAYS.map((label, i) => ({ value: i, label: i === tomorrow ? `Mañana (${label.toLowerCase()})` : label })).sort(
        (a, b) => ((a.value - tomorrow + 7) % 7) - ((b.value - tomorrow + 7) % 7)
    );

    return (
        <>
            <div className="card filters">
                <ChipGroup options={options} value={weekday} onChange={setWeekday} className="chips--scroll" />
                <ChipGroup
                    options={[
                        { value: true, label: "Solo lo que falta" },
                        { value: false, label: "Todos" },
                    ]}
                    value={onlyNeeded}
                    onChange={setOnlyNeeded}
                />
                <p className="muted small">
                    Promedio de lo vendido los {WEEKDAYS[weekday].toLowerCase()} de las últimas {WEEKS} semanas, más un 10 % de margen, menos lo que hay en stock.
                </p>
            </div>
            <div className="card card--flush">
                {shown.length === 0 ? (
                    <EmptyState icon={ChefHat} title={rows.length ? "Hay stock suficiente para ese día" : "Aún no hay ventas suficientes de ese día"}>
                        {rows.length ? "Toca «Todos» para ver el detalle." : "La sugerencia aparece cuando haya ventas de ese día de la semana."}
                    </EmptyState>
                ) : (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th className="r">Se venden (prom.)</th>
                                    <th className="r">Hay</th>
                                    <th className="r">Preparar / pedir</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <b>{r.name}</b>
                                        </td>
                                        <td className="r tabular">{r.avg}</td>
                                        <td className="r tabular">{r.stock}</td>
                                        <td className="r">{r.suggested > 0 ? <span className="suggest">+{r.suggested}</span> : <span className="muted">Alcanza</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}

import { useState } from "react";
import { Table2, BarChart3 } from "lucide-react";

/**
 * Gráficos livianos en HTML/CSS (sin librerías: rápidos en Windows 7).
 * Una sola serie por gráfico, en el verde de la marca: no necesitan leyenda.
 * Se etiqueta solo el valor más alto; el resto se ve al pasar el mouse o tocar
 * la barra (tooltip) y en la vista de tabla.
 */

/** Escala "bonita": 0, ½ y el tope redondeado. */
function niceMax(max) {
    if (max <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max) || 10;
    return step * pow;
}

/** Columnas verticales (ventas por día, por hora). data: [{ key, label, value, tip }] */
export function ColumnChart({ data, format, ariaLabel, tableHeaders = ["", "Valor"], every = 1 }) {
    const [asTable, setAsTable] = useState(false);
    const max = Math.max(0, ...data.map((d) => d.value));
    const top = niceMax(max);
    const peak = data.findIndex((d) => d.value === max && max > 0);

    return (
        <div className="chart">
            <button className="chart__view icon-btn" onClick={() => setAsTable((v) => !v)} title={asTable ? "Ver gráfico" : "Ver como tabla"} aria-label={asTable ? "Ver gráfico" : "Ver como tabla"}>
                {asTable ? <BarChart3 size={16} /> : <Table2 size={16} />}
            </button>
            {asTable ? (
                <div className="chart__table">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{tableHeaders[0]}</th>
                                <th className="r">{tableHeaders[1]}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((d) => (
                                <tr key={d.key}>
                                    <td>{d.tip || d.label}</td>
                                    <td className="r tabular">{format(d.value)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="cols" role="img" aria-label={ariaLabel}>
                    <div className="cols__grid">
                        {[top, top / 2, 0].map((v) => (
                            <div key={v} className="cols__gridline">
                                <span>{format(v, true)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="cols__plot">
                        {data.map((d, i) => (
                            <div key={d.key} className="cols__slot" tabIndex={0}>
                                <div className="cols__bar" style={{ height: `${(d.value / top) * 100}%` }}>
                                    {i === peak && <span className="cols__peak">{format(d.value, true)}</span>}
                                </div>
                                <span className="cols__tip">
                                    <b>{d.tip || d.label}</b>
                                    {format(d.value)}
                                </span>
                                <span className="cols__label">{i % every === 0 ? d.label : ""}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Barras horizontales con etiqueta y valor (top productos, métodos, vendedores). rows: [{ key, label, value, sub }] */
export function BarList({ rows, format, empty = "Sin datos en este periodo" }) {
    if (!rows.length) return <p className="muted small">{empty}</p>;
    const max = Math.max(...rows.map((r) => r.value), 1);
    return (
        <div className="barlist">
            {rows.map((r) => (
                <div key={r.key} className="barlist__row">
                    <div className="barlist__text">
                        <span className="barlist__label">{r.label}</span>
                        <span className="barlist__value tabular">
                            {format(r.value)}
                            {r.sub && <small>{r.sub}</small>}
                        </span>
                    </div>
                    <div className="barlist__track">
                        <div className="barlist__bar" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Variación contra el periodo anterior: ▲ 12 % / ▼ 5 %. Ícono + texto, no solo color. */
export function Delta({ current, previous, upIsGood = true }) {
    if (!previous) return <span className="delta delta--flat">sin datos del periodo anterior</span>;
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return <span className="delta delta--flat">= igual que el periodo anterior</span>;
    const good = pct > 0 === upIsGood;
    return (
        <span className={`delta ${good ? "delta--good" : "delta--bad"}`}>
            {pct > 0 ? "▲" : "▼"} {Math.abs(pct)} % vs periodo anterior
        </span>
    );
}

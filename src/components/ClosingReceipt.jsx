import { formatCurrency, toDate } from "../lib/format";

const signed = (n) => `${n > 0 ? "+" : ""}${formatCurrency(n)}`;

/** Resumen del cierre para la impresora de recibos (80 mm). */
export default function ClosingReceipt({ closing }) {
    if (!closing) return null;
    const stats = closing.perMethodStats || {};
    const outs = closing.cashOuts || [];
    return (
        <div className="receipt">
            <div className="receipt__center">
                <div className="receipt__brand">HEMMA CAFÉ</div>
                <div>CIERRE DE CAJA</div>
            </div>
            <div className="receipt__sep" />
            <div>
                <b>Fecha:</b> {toDate(closing.date).toLocaleString("es-CO")}
            </div>
            {closing.since && (
                <div>
                    <b>Desde:</b> {toDate(closing.since).toLocaleString("es-CO")}
                </div>
            )}
            {closing.closedBy && (
                <div>
                    <b>Cerró:</b> {closing.closedBy}
                </div>
            )}
            <div>
                <b>Productos vendidos:</b> {closing.productsSold || 0}
            </div>
            <div className="receipt__sep" />
            <table className="receipt__table">
                <thead>
                    <tr>
                        <th>Método</th>
                        <th className="r">Esperado</th>
                        <th className="r">Contado</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(stats).map(([m, s]) => (
                        <tr key={m}>
                            <td>
                                {m}
                                {s.diff ? <div>({signed(s.diff)})</div> : null}
                            </td>
                            <td className="r">{formatCurrency(s.expected)}</td>
                            <td className="r">{formatCurrency(s.real)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {(closing.cashBase > 0 || outs.length > 0) && <div className="receipt__sep" />}
            {closing.cashBase > 0 && (
                <div className="receipt__row">
                    <span>Base de caja</span>
                    <span>{formatCurrency(closing.cashBase)}</span>
                </div>
            )}
            {outs.map((o, i) => (
                <div className="receipt__row" key={i}>
                    <span>Salida: {o.concept}</span>
                    <span>−{formatCurrency(o.amount)}</span>
                </div>
            ))}
            <div className="receipt__sep" />
            <div className="receipt__row">
                <span>Vendido</span>
                <span>{formatCurrency(closing.expectedTotal)}</span>
            </div>
            <div className="receipt__row">
                <span>Contado (ventas)</span>
                <span>{formatCurrency(closing.realTotal)}</span>
            </div>
            <div className="receipt__total">
                <span>DIFERENCIA</span>
                <span>{closing.difference === 0 ? "CUADRA" : signed(closing.difference)}</span>
            </div>
            {closing.notes ? (
                <div>
                    <b>Notas:</b> {closing.notes}
                </div>
            ) : null}
            <div className="receipt__sep" />
            <div className="receipt__sign">Firma: ______________________</div>
        </div>
    );
}

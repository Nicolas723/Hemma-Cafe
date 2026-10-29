import { formatCurrency, toDate } from "../lib/format";

/** Recibo de 80 mm. Solo es visible al imprimir (ver styles/print.css). */
export default function Receipt({ transaction }) {
    if (!transaction) return null;
    const { date, customerName, vendedorName, items = [], total, paymentMethod, payments, notes } = transaction;
    const methods =
        payments && payments.length > 1
            ? payments.map((p) => `${p.method} ${formatCurrency(p.amount)}`).join(" + ")
            : paymentMethod || "Efectivo";

    return (
        <div className="receipt">
            <div className="receipt__center">
                <div className="receipt__brand">HEMMA CAFÉ</div>
                <div>Café especial + Panadería artesanal</div>
            </div>
            <div className="receipt__sep" />
            <div>
                <b>Fecha:</b> {toDate(date).toLocaleString("es-CO")}
            </div>
            <div>
                <b>Atendió:</b> {vendedorName || "N/A"}
            </div>
            <div>
                <b>Cliente:</b> {customerName || "General"}
            </div>
            <div className="receipt__sep" />
            <table className="receipt__table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th className="c">Cant</th>
                        <th className="r">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => (
                        <tr key={i}>
                            <td>{item.name}</td>
                            <td className="c">{item.partial ? "—" : item.cartQuantity}</td>
                            <td className="r">{formatCurrency(item.subtotal)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="receipt__sep" />
            <div className="receipt__total">
                <span>TOTAL</span>
                <span>{formatCurrency(total)}</span>
            </div>
            <div>
                <b>Pago:</b> {methods}
            </div>
            {notes ? (
                <div>
                    <b>Nota:</b> {notes}
                </div>
            ) : null}
            <div className="receipt__center receipt__thanks">¡Gracias por tu compra!</div>
        </div>
    );
}

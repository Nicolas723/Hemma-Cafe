import { useMemo, useState } from "react";
import { Pencil, Minus, Plus, Trash2, Save, Split } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { Modal, SearchInput, Toggle } from "../../components/ui";
import { MethodPicker, SplitEditor, newSplitRow, splitRowsToPayments } from "../../components/PaymentMethods";
import { DEFAULT_PAYMENT_METHODS } from "../../lib/paymentIcons";
import { formatCurrency, formatDateTime } from "../../lib/format";

/** Precio efectivo por unidad (conserva el descuento original al cambiar cantidades). */
const effectiveUnit = (i) => (i.cartQuantity ? (i.subtotal ?? i.price * i.cartQuantity) / i.cartQuantity : i.price || 0);

export default function TransactionEditor({ transaction, onClose }) {
    const { products, paymentMethods, actions } = useData();
    const { showConfirm } = useUi();
    const methods = paymentMethods.length ? paymentMethods : DEFAULT_PAYMENT_METHODS;
    const originalPays = transaction.payments?.length ? transaction.payments : [{ method: transaction.paymentMethod || "Efectivo", amount: transaction.total }];

    const [items, setItems] = useState(() => (transaction.items || []).map((i) => ({ ...i, unit: effectiveUnit(i) })));
    const [search, setSearch] = useState("");
    const [split, setSplit] = useState(originalPays.length > 1);
    const [method, setMethod] = useState(originalPays[0].method);
    const [rows, setRows] = useState(() => originalPays.map((p) => newSplitRow(p.method, String(p.amount))));

    const total = items.reduce((s, i) => s + i.subtotal, 0);
    const matches = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6) : [];
    }, [search, products]);

    const setQty = (idx, qty) =>
        setItems((prev) =>
            qty <= 0 ? prev.filter((_, i) => i !== idx) : prev.map((it, i) => (i === idx ? { ...it, cartQuantity: qty, subtotal: Math.round(it.unit * qty) } : it))
        );

    const addProduct = (p) => {
        const idx = items.findIndex((i) => i.id === p.id);
        if (idx >= 0) setQty(idx, items[idx].cartQuantity + 1);
        else setItems((prev) => [...prev, { id: p.id, name: p.name, price: p.price, originalPrice: p.price, discount: 0, cartQuantity: 1, subtotal: p.price, unit: p.price }]);
        setSearch("");
    };

    const clean = (list) => list.map(({ unit, ...i }) => ({ ...i, discount: Math.max(0, (i.originalPrice ?? i.price) * i.cartQuantity - i.subtotal) }));

    const save = () => {
        const payments = split ? splitRowsToPayments(rows, total) : [{ method, amount: total }];
        actions.updateTransaction(transaction, clean(items), payments);
        onClose();
    };

    const remove = () =>
        showConfirm("¿Eliminar esta venta por completo? El stock se devuelve al inventario.", { confirmLabel: "Eliminar venta" }).then((ok) => {
            if (!ok) return;
            actions.updateTransaction(transaction, [], []);
            onClose();
        });

    const splitPaid = rows.reduce((s, r) => s + (parseInt(r.amount, 10) || 0), 0);
    const splitInvalid = split && splitPaid !== total;

    return (
        <Modal
            title={`Editar venta · ${formatDateTime(transaction.date)}`}
            icon={Pencil}
            onClose={onClose}
            size="lg"
            footer={
                <>
                    <button className="btn btn--danger-ghost" onClick={remove}>
                        <Trash2 size={18} /> Eliminar venta
                    </button>
                    <span className="spacer" />
                    <button className="btn btn--ghost btn--lg" onClick={onClose}>
                        Cancelar
                    </button>
                    <button className="btn btn--primary btn--lg" onClick={save} disabled={splitInvalid || items.length === 0} title={splitInvalid ? "El pago dividido debe sumar el total" : ""}>
                        <Save size={18} /> Guardar
                    </button>
                </>
            }
        >
            <div className="editor-lines">
                {items.map((i, idx) => (
                    <div className="line" key={`${i.id}-${idx}`}>
                        <div className="line__info">
                            <div className="line__name">{i.name}</div>
                            <div className="line__meta">{formatCurrency(i.unit)} c/u</div>
                        </div>
                        <div className="stepper">
                            <button onClick={() => setQty(idx, i.cartQuantity - 1)} aria-label="Menos">
                                {i.cartQuantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                            </button>
                            <span>{i.cartQuantity}</span>
                            <button onClick={() => setQty(idx, i.cartQuantity + 1)} aria-label="Más">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="line__total">{formatCurrency(i.subtotal)}</div>
                    </div>
                ))}
            </div>

            {transaction.type !== "abono" && (
                <div className="editor-add">
                    <SearchInput value={search} onChange={setSearch} placeholder="Agregar producto a la venta…" />
                    {matches.length > 0 && (
                        <div className="dropdown">
                            {matches.map((p) => (
                                <button key={p.id} className="dropdown__item" onClick={() => addProduct(p)}>
                                    <span>{p.name}</span>
                                    <span className="muted">{formatCurrency(p.price)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="cart__total">
                <span>Nuevo total</span>
                <strong>{formatCurrency(total)}</strong>
            </div>

            <Toggle icon={Split} label="Pago dividido" checked={split} onChange={setSplit} />
            {split ? <SplitEditor methods={methods} rows={rows} onChange={setRows} total={total} /> : <MethodPicker methods={methods} value={method} onChange={setMethod} compact />}
        </Modal>
    );
}

import { useMemo, useState } from "react";
import { BadgePercent, Plus, Trash2, Package, Layers } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { ChipGroup, EmptyState, Field, MoneyInput, SearchInput } from "../../components/ui";
import { formatCurrency } from "../../lib/format";

const TYPES = [
    { value: "pack", label: "Pack (ej: 2 por $5.000)", icon: <Package size={14} /> },
    { value: "bulk", label: "Por volumen (ej: 3+ a $2.000 c/u)", icon: <Layers size={14} /> },
];

const describe = (p) =>
    p.type === "bulk" ? `Desde ${p.quantity} unidades a ${formatCurrency(p.price)} c/u` : `${p.quantity} unidades por ${formatCurrency(p.price)}`;

export default function PromotionsPanel() {
    const { promotions, products, productsById, actions } = useData();
    const { showToast, showConfirm } = useUi();
    const [search, setSearch] = useState("");
    const [productId, setProductId] = useState("");
    const [type, setType] = useState("pack");
    const [quantity, setQuantity] = useState("2");
    const [price, setPrice] = useState("");

    const matches = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q && !productId ? products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8) : [];
    }, [search, products, productId]);

    const active = promotions.filter((p) => productsById[p.productId]);

    const add = (e) => {
        e.preventDefault();
        const q = parseInt(quantity, 10);
        const pr = parseFloat(price);
        if (!productId || !(q > 0) || !(pr > 0)) {
            showToast("Elige un producto, la cantidad y el precio", "warning");
            return;
        }
        if (promotions.some((p) => p.productId === productId)) {
            showToast("Ese producto ya tiene una promoción; elimínala primero", "warning");
            return;
        }
        actions.addPromotion({ productId, quantity: q, price: pr, type });
        showToast("Promoción activada", "success");
        setSearch("");
        setProductId("");
        setPrice("");
    };

    return (
        <div className="two-col">
            <form className="card stack" onSubmit={add}>
                <h2>Nueva promoción</h2>
                <Field label="Producto">
                    <div className="editor-add">
                        <SearchInput
                            value={search}
                            onChange={(v) => {
                                setSearch(v);
                                setProductId("");
                            }}
                            placeholder="Buscar producto…"
                        />
                        {matches.length > 0 && (
                            <div className="dropdown">
                                {matches.map((p) => (
                                    <button
                                        type="button"
                                        key={p.id}
                                        className="dropdown__item"
                                        onClick={() => {
                                            setProductId(p.id);
                                            setSearch(p.name);
                                        }}
                                    >
                                        <span>{p.name}</span>
                                        <span className="muted">{formatCurrency(p.price)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </Field>
                <Field label="Tipo">
                    <ChipGroup options={TYPES} value={type} onChange={setType} />
                </Field>
                <div className="form-grid">
                    <Field label={type === "bulk" ? "Desde (unidades)" : "Unidades del pack"}>
                        <input className="input" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
                    </Field>
                    <Field label={type === "bulk" ? "Precio por unidad" : "Precio del pack"}>
                        <MoneyInput value={price} onChange={setPrice} />
                    </Field>
                </div>
                <button className="btn btn--primary btn--lg btn--block" type="submit">
                    <Plus size={18} /> Activar promoción
                </button>
            </form>

            <div className="card">
                <h2>Promociones activas</h2>
                {active.length === 0 ? (
                    <EmptyState icon={BadgePercent} title="No hay promociones activas" />
                ) : (
                    <div className="list">
                        {active.map((p) => (
                            <div className="list__item" key={p.id}>
                                <BadgePercent size={20} className="text-brand" />
                                <div className="list__body">
                                    <b>{productsById[p.productId].name}</b>
                                    <span className="muted">{describe(p)}</span>
                                </div>
                                <button
                                    className="icon-btn icon-btn--danger"
                                    aria-label="Eliminar promoción"
                                    onClick={() => showConfirm("¿Eliminar esta promoción?", { confirmLabel: "Eliminar" }).then((ok) => ok && actions.deletePromotion(p.id))}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

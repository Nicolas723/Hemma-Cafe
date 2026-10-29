import { memo } from "react";
import { PackageSearch, Pencil, Tag } from "lucide-react";
import { EmptyState } from "../../components/ui";
import { formatCurrency, colorFor, initials } from "../../lib/format";
import { useData } from "../../context/DataProvider";
import { isFlexible, unitPrice } from "../../lib/pricing";
import { useShowPhotos } from "../../lib/hooks";

function ProductTile({ product, qty, priceType, promo, category, color, showPhotos, onPick }) {
    const flex = isFlexible(product);
    const stock = product.quantity || 0;
    const out = !flex && stock <= 0;
    const exhausted = !flex && qty >= stock;
    const price = unitPrice(product, priceType);
    const discounted = !flex && price < (product.price || 0);

    const activate = () => !out && !exhausted && onPick(product);

    const promoTag = promo && !out && (
        <span className="tile__promo">
            <Tag size={12} /> {promo.type === "bulk" ? `${promo.quantity}+` : `${promo.quantity}x`}
        </span>
    );

    // <div role="button"> en vez de <button>: Chromium 108 calcula mal la altura
    // de un <button> flex dentro de un grid y recorta el contenido.
    return (
        <div
            role="button"
            tabIndex={out ? -1 : 0}
            aria-disabled={out || exhausted}
            className={`tile ${showPhotos ? "" : "tile--text"} ${qty ? "is-in-cart" : ""} ${out ? "is-out" : ""}`}
            style={showPhotos ? undefined : { "--cat": color }}
            onClick={activate}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    activate();
                }
            }}
            title={exhausted && !out ? "Ya agregaste todo el stock disponible" : product.name}
        >
            {showPhotos && (
                <div className="tile__media" style={product.image ? undefined : { background: colorFor(product.name) }}>
                    {product.image ? (
                        <img src={product.image} alt="" loading="lazy" decoding="async" />
                    ) : flex ? (
                        <Pencil size={30} />
                    ) : (
                        <span className="tile__initials">{initials(product.name)}</span>
                    )}
                    {out && <span className="tile__out">Agotado</span>}
                    {promoTag}
                </div>
            )}
            {qty > 0 && <span className="tile__qty">{qty}</span>}
            <div className="tile__body">
                {!showPhotos && (category || promoTag || out || flex) && (
                    <div className="tile__tags">
                        {category && <span className="tile__cat">{category}</span>}
                        {flex && <Pencil size={13} className="muted" />}
                        {promoTag}
                        {out && <span className="tile__out">Agotado</span>}
                    </div>
                )}
                <div className="tile__name">{product.name}</div>
                {showPhotos && category && <div className="tile__cat">{category}</div>}
                <div className="tile__foot">
                    <span className="tile__price">
                        {flex ? "Precio libre" : formatCurrency(price)}
                        {discounted && <s>{formatCurrency(product.price)}</s>}
                    </span>
                    {!flex && <span className={`tile__stock ${stock <= 5 ? "is-low" : ""}`}>{stock}</span>}
                </div>
            </div>
        </div>
    );
}

const MemoTile = memo(ProductTile);

export default function ProductGrid({ products, inCart, priceType, promos, categoriesById, onPick }) {
    const [showPhotos] = useShowPhotos();
    const { categoryColor } = useData();
    if (products.length === 0) {
        return (
            <EmptyState icon={PackageSearch} title="No hay productos">
                Prueba con otra búsqueda o categoría.
            </EmptyState>
        );
    }
    return (
        <div className={`grid-products ${showPhotos ? "" : "grid-products--text"}`}>
            {products.map((p) => (
                <MemoTile
                    key={p.id}
                    product={p}
                    qty={inCart[p.id] || 0}
                    priceType={priceType}
                    promo={promos[p.id]}
                    category={categoriesById[p.categoryId]}
                    color={categoryColor(p.categoryId)}
                    showPhotos={showPhotos}
                    onPick={onPick}
                />
            ))}
        </div>
    );
}

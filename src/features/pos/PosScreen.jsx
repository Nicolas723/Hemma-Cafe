import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Store, UtensilsCrossed, ShoppingCart, LayoutGrid, Star, ArrowUpDown, ArrowUpFromLine } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { CashOutForm } from "../closing/CashOut";
import { SearchInput, ChipGroup } from "../../components/ui";
import { computeOrder, isFlexible, promoMap } from "../../lib/pricing";
import { formatCurrency } from "../../lib/format";
import { useDebounced, useMediaQuery } from "../../lib/hooks";
import { usePosState } from "./usePosState";
import { readTables } from "../../lib/tables";
import ProductGrid from "./ProductGrid";
import CartPanel from "./CartPanel";
import FlexiblePriceModal from "./FlexiblePriceModal";

const SORTS = [
    { value: "mostSold", label: "Más vendidos", icon: <Star size={14} /> },
    { value: "name", label: "A-Z", icon: <ArrowUpDown size={14} /> },
];

export default function PosScreen() {
    const { mode, products, productsById, categories, categoryColor, customers, promotions, transactions } = useData();
    const { showToast } = useUi();
    const pos = usePosState(mode, productsById, showToast);
    const { can } = useAuth();
    const [cashOutOpen, setCashOutOpen] = useState(false);
    // Mesas de este equipo (se leen al abrir la caja; se editan en Ajustes).
    const TABLES = useMemo(readTables, []);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [sort, setSort] = useState("mostSold");
    const [flexProduct, setFlexProduct] = useState(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const searchRef = useRef(null);
    const isNarrow = useMediaQuery("(max-width: 900px)");
    const query = useDebounced(search.trim().toLowerCase(), 120);

    const promos = useMemo(() => promoMap(promotions), [promotions]);
    const customer = customers.find((c) => c.id === pos.customerId) || null;
    const priceType = customer ? customer.priceType || "special" : null;

    const salesCount = useMemo(() => {
        const counts = {};
        for (const t of transactions) for (const i of t.items || []) counts[i.id] = (counts[i.id] || 0) + (i.cartQuantity || 0);
        return counts;
    }, [transactions]);

    const visible = useMemo(() => {
        const list = products.filter(
            (p) => (!category || p.categoryId === category) && (!query || p.name?.toLowerCase().includes(query))
        );
        if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name, "es"));
        return list.sort((a, b) => (salesCount[b.id] || 0) - (salesCount[a.id] || 0) || a.name.localeCompare(b.name, "es"));
    }, [products, category, query, sort, salesCount]);

    const inCart = useMemo(() => {
        const map = {};
        for (const l of pos.cart) map[l.id] = (map[l.id] || 0) + l.cartQuantity;
        return map;
    }, [pos.cart]);

    const order = useMemo(
        () => computeOrder({ cart: pos.cart, productsById, promos, priceType, customTotal: pos.customTotal }),
        [pos.cart, productsById, promos, priceType, pos.customTotal]
    );

    const tableSummaries = useMemo(
        () =>
            Object.fromEntries(
                TABLES.map((t) => {
                    const cart = pos.tables[t.id] || [];
                    return [t.id, cart.reduce((s, l) => s + l.cartQuantity, 0)];
                })
            ),
        [pos.tables, TABLES]
    );

    const { addProduct } = pos;
    const pick = useCallback(
        (product) => {
            if (isFlexible(product)) setFlexProduct(product);
            else addProduct(product);
        },
        [addProduct]
    );
    const categoriesById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

    // "/" o F3 enfocan la búsqueda desde cualquier parte de la caja.
    useEffect(() => {
        const onKey = (e) => {
            const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
            if ((e.key === "/" && !typing) || e.key === "F3") {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const onSearchKey = (e) => {
        if (e.key === "Enter" && visible[0]) {
            const available = visible.find((p) => isFlexible(p) || (p.quantity || 0) > (inCart[p.id] || 0));
            if (available) {
                pick(available);
                setSearch("");
            }
        }
        if (e.key === "Escape") setSearch("");
    };

    const categoryOptions = useMemo(
        () => [{ value: "", label: "Todo", icon: <LayoutGrid size={14} /> }, ...categories.map((c) => ({ value: c.id, label: c.name, icon: <span className="cat-dot" style={{ background: categoryColor(c.id) }} /> }))],
        [categories, categoryColor]
    );

    const cartPanel = (
        <CartPanel
            pos={pos}
            order={order}
            customer={customer}
            onClose={isNarrow ? () => setSheetOpen(false) : null}
        />
    );

    return (
        <div className="pos">
            <section className="pos__catalog">
                <div className="tables" role="tablist" aria-label="Mesas">
                    {TABLES.map((t) => {
                        const count = tableSummaries[t.id];
                        const Icon = t.id === "mostrador" ? Store : UtensilsCrossed;
                        return (
                            <button
                                key={t.id}
                                role="tab"
                                aria-selected={pos.activeTable === t.id}
                                className={`table-chip ${pos.activeTable === t.id ? "is-active" : ""} ${count ? "is-busy" : ""}`}
                                onClick={() => pos.setActiveTable(t.id)}
                            >
                                <Icon size={18} />
                                <span className="table-chip__label">{t.label}</span>
                                <span className="table-chip__status">{count ? `${count} und.` : "Libre"}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="pos__tools">
                    <SearchInput
                        inputRef={searchRef}
                        value={search}
                        onChange={setSearch}
                        onKeyDown={onSearchKey}
                        placeholder="Buscar producto…  (Enter agrega el primero)"
                        className="search--lg"
                    />
                    <ChipGroup options={SORTS} value={sort} onChange={setSort} />
                    {can("cashOut") && (
                        <button className="btn btn--ghost" onClick={() => setCashOutOpen(true)} title="Registrar efectivo que sale de la caja (pagos, insumos…)">
                            <ArrowUpFromLine size={18} /> Salida
                        </button>
                    )}
                </div>

                <ChipGroup options={categoryOptions} value={category} onChange={setCategory} className="chips--scroll" />

                <ProductGrid
                    products={visible}
                    inCart={inCart}
                    priceType={priceType}
                    promos={promos}
                    categoriesById={categoriesById}
                    onPick={pick}
                />
            </section>

            {!isNarrow && cartPanel}

            {isNarrow && (
                <>
                    <button className="cart-fab" onClick={() => setSheetOpen(true)}>
                        <ShoppingCart size={20} />
                        <span>{order.units} und.</span>
                        <strong>{formatCurrency(order.total)}</strong>
                    </button>
                    {sheetOpen && (
                        <div className="sheet-backdrop" onMouseDown={() => setSheetOpen(false)}>
                            <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
                                {cartPanel}
                            </div>
                        </div>
                    )}
                </>
            )}

            {flexProduct && (
                <FlexiblePriceModal
                    product={flexProduct}
                    onClose={() => setFlexProduct(null)}
                    onConfirm={(price) => {
                        pos.addProduct(flexProduct, price);
                        setFlexProduct(null);
                    }}
                />
            )}
            {cashOutOpen && <CashOutForm onClose={() => setCashOutOpen(false)} />}
        </div>
    );
}

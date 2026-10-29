import { useMemo, useRef, useState } from "react";
import { Package, Plus, Upload, Download, FileSpreadsheet, Pencil, Trash2, Minus, Tags, BadgePercent, AlertTriangle, ArrowUpDown, PackageSearch, Truck, ChefHat } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useAuth } from "../../context/AuthProvider";
import { ChipGroup, EmptyState, PageHeader, SearchInput, Toggle } from "../../components/ui";
import { formatCurrency, colorFor, initials } from "../../lib/format";
import { exportWorkbook, readWorkbook, today, PRODUCT_COLUMNS } from "../../lib/excel";
import { isFlexible } from "../../lib/pricing";
import { useDebounced, useShowPhotos } from "../../lib/hooks";
import ProductForm from "./ProductForm";
import CategoriesPanel from "./CategoriesPanel";
import PromotionsPanel from "./PromotionsPanel";
import { StockEntriesPanel, StockEntryForm } from "./StockEntry";
import ProductionPanel from "./ProductionPanel";

import { LOW_STOCK } from "../../lib/inventory";

const TABS = [
    { value: "products", label: "Productos", icon: <Package size={16} /> },
    { value: "production", label: "Qué preparar", icon: <ChefHat size={16} /> },
    { value: "entries", label: "Llegadas", icon: <Truck size={16} />, perm: "stock" },
    { value: "categories", label: "Categorías", icon: <Tags size={16} />, perm: "edit" },
    { value: "promotions", label: "Promociones", icon: <BadgePercent size={16} />, perm: "edit" },
];

const COLUMNS = [
    { key: "name", label: "Producto" },
    { key: "category", label: "Categoría" },
    { key: "quantity", label: "Stock", className: "c" },
    { key: "price", label: "Precio", className: "r" },
    { key: "specialPrice", label: "Especial", className: "r" },
    { key: "wholesalePrice", label: "Mayorista", className: "r" },
];

export default function InventoryScreen() {
    const { products, categories, categoryColor, actions } = useData();
    const { showToast, showConfirm } = useUi();
    const { can, isAdmin } = useAuth();
    // El costo es información sensible: solo el administrador lo ve y lo exporta.
    const productColumns = isAdmin ? PRODUCT_COLUMNS : PRODUCT_COLUMNS.filter((c) => c.key !== "Costo");
    const canEdit = can("manageProducts");
    const canStock = can("adjustStock");
    const [showPhotos] = useShowPhotos();
    const [tab, setTab] = useState("products");
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [lowOnly, setLowOnly] = useState(false);
    const [sort, setSort] = useState({ key: "name", dir: 1 });
    const [editing, setEditing] = useState(null); // null | {} (nuevo) | producto
    const [importing, setImporting] = useState(false);
    const [receiving, setReceiving] = useState(false);
    const tabs = TABS.filter((t) => !t.perm || (t.perm === "edit" ? canEdit : canStock));
    const fileRef = useRef(null);
    const query = useDebounced(search.trim().toLowerCase(), 150);

    const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
    const lowCount = products.filter((p) => !isFlexible(p) && (p.quantity || 0) <= LOW_STOCK).length;

    const rows = useMemo(() => {
        const list = products.filter(
            (p) =>
                (!query || p.name?.toLowerCase().includes(query)) &&
                (!category || p.categoryId === category) &&
                (!lowOnly || (!isFlexible(p) && (p.quantity || 0) <= LOW_STOCK))
        );
        const val = (p) => (sort.key === "category" ? catName[p.categoryId] || "" : p[sort.key] ?? "");
        return list.sort((a, b) => {
            const x = val(a);
            const y = val(b);
            if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y), "es") * sort.dir;
            return ((x || 0) - (y || 0)) * sort.dir;
        });
    }, [products, query, category, lowOnly, sort, catName]);

    const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));

    const downloadInventory = async () => {
        try {
            await exportWorkbook(`Inventario_${today()}.xlsx`, [
                {
                    name: "Inventario",
                    columns: productColumns,
                    rows: products
                        .filter((p) => !isFlexible(p))
                        .map((p) => ({
                            Nombre: p.name,
                            Categoría: catName[p.categoryId] || "General",
                            Precio: p.price,
                            Cantidad: p.quantity,
                            "Precio Especial": p.specialPrice || "",
                            "Precio Mayorista": p.wholesalePrice || "",
                            ...(isAdmin ? { Costo: p.cost || "" } : {}),
                        })),
                },
            ]);
            showToast("Inventario descargado", "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo exportar el inventario", "error");
        }
    };

    const downloadTemplate = async () => {
        try {
            await exportWorkbook("Plantilla_Productos_Hemma.xlsx", [
                {
                    name: "Productos",
                    columns: productColumns,
                    rows: [{ Nombre: "Producto ejemplo", Categoría: "General", Precio: 5000, Cantidad: 10, "Precio Especial": 4500, "Precio Mayorista": 4000, ...(isAdmin ? { Costo: 2500 } : {}) }],
                },
            ]);
        } catch (err) {
            console.error(err);
            showToast("No se pudo crear la plantilla", "error");
        }
    };

    const importFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setImporting(true);
        try {
            const data = await readWorkbook(file);
            if (!data.length) {
                showToast("El archivo está vacío o no tiene el formato de la plantilla", "warning");
                return;
            }
            const ok = await showConfirm(`Se importarán ${data.length} filas. Los productos con el mismo nombre se actualizan (precio y stock se reemplazan). ¿Continuar?`, {
                confirmLabel: "Importar",
                danger: false,
            });
            if (!ok) return;
            const { created, updated } = await actions.importProducts(data);
            showToast(`Importación lista: ${created} nuevos, ${updated} actualizados`, "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo leer o importar el archivo", "error");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="page">
            <PageHeader icon={Package} title="Inventario" subtitle={`${products.length} productos · ${categories.length} categorías`}>
                {tabs.length > 1 && <ChipGroup options={tabs} value={tab} onChange={setTab} size="lg" />}
            </PageHeader>

            {(tab === "products" || !tabs.some((t) => t.value === tab)) && (
                <>
                    <div className="card filters">
                        <div className="filters__row">
                            <SearchInput value={search} onChange={setSearch} placeholder="Buscar producto…" />
                            <Toggle icon={AlertTriangle} label={`Stock bajo (${lowCount})`} checked={lowOnly} onChange={setLowOnly} />
                            <span className="spacer" />
                            {canEdit && (
                                <>
                                    <button className="btn btn--ghost" onClick={downloadTemplate} title="Plantilla de Excel para importar">
                                        <FileSpreadsheet size={18} /> Plantilla
                                    </button>
                                    <button className="btn btn--ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
                                        <Upload size={18} /> {importing ? "Importando…" : "Importar"}
                                    </button>
                                    <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={importFile} />
                                </>
                            )}
                            {can("exportData") && (
                                <button className="btn btn--ghost" onClick={downloadInventory}>
                                    <Download size={18} /> Descargar
                                </button>
                            )}
                            {canStock && (
                                <button className="btn btn--soft" onClick={() => setReceiving(true)} title="Sumar al stock lo que llegó y dejar registro">
                                    <Truck size={18} /> Llegó mercancía
                                </button>
                            )}
                            {canEdit && (
                                <button className="btn btn--primary" onClick={() => setEditing({})}>
                                    <Plus size={18} /> Nuevo producto
                                </button>
                            )}
                        </div>
                        <ChipGroup
                            options={[{ value: "", label: "Todas" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                            value={category}
                            onChange={setCategory}
                            className="chips--scroll"
                        />
                    </div>

                    <div className="card card--flush">
                        {rows.length === 0 ? (
                            <EmptyState icon={PackageSearch} title="No hay productos con estos filtros" />
                        ) : (
                            <div className="table-wrap">
                                <table className="table table--hover">
                                    <thead>
                                        <tr>
                                            {showPhotos && <th style={{ width: 56 }} />}
                                            {COLUMNS.map((c) => (
                                                <th key={c.key} className={`sortable ${c.className || ""}`} onClick={() => toggleSort(c.key)}>
                                                    {c.label} {sort.key === c.key ? (sort.dir > 0 ? "↑" : "↓") : <ArrowUpDown size={12} className="muted" />}
                                                </th>
                                            ))}
                                            {canEdit && <th />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((p) => {
                                            const flex = isFlexible(p);
                                            const low = !flex && (p.quantity || 0) <= LOW_STOCK;
                                            return (
                                                <tr key={p.id} onDoubleClick={canEdit ? () => setEditing(p) : undefined}>
                                                    {showPhotos && (
                                                        <td>
                                                            {p.image ? (
                                                                <img className="thumb" src={p.image} alt="" loading="lazy" />
                                                            ) : (
                                                                <span className="thumb thumb--empty" style={{ background: colorFor(p.name) }}>
                                                                    {initials(p.name)}
                                                                </span>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td>
                                                        <span className="cat-dot" style={{ background: categoryColor(p.categoryId) }} />
                                                        <b>{p.name}</b>
                                                    </td>
                                                    <td className="muted">{catName[p.categoryId] || "—"}</td>
                                                    <td className="c">
                                                        {flex ? (
                                                            <span className="muted">∞</span>
                                                        ) : !canStock ? (
                                                            <span className={`stock-num ${low ? "is-low" : ""}`}>{p.quantity || 0}</span>
                                                        ) : (
                                                            <div className={`stepper stepper--sm ${low ? "is-low" : ""}`}>
                                                                <button onClick={() => actions.adjustProductStock(p.id, -1)} disabled={(p.quantity || 0) <= 0} aria-label="Restar stock">
                                                                    <Minus size={14} />
                                                                </button>
                                                                <span>{p.quantity || 0}</span>
                                                                <button onClick={() => actions.adjustProductStock(p.id, 1)} aria-label="Sumar stock">
                                                                    <Plus size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="r">{flex ? "Libre" : formatCurrency(p.price)}</td>
                                                    <td className="r">{p.specialPrice ? formatCurrency(p.specialPrice) : "—"}</td>
                                                    <td className="r">{p.wholesalePrice ? formatCurrency(p.wholesalePrice) : "—"}</td>
                                                    {canEdit && (
                                                    <td className="r nowrap">
                                                        <button className="icon-btn" title="Editar" onClick={() => setEditing(p)}>
                                                            <Pencil size={18} />
                                                        </button>
                                                        {!flex && (
                                                            <button
                                                                className="icon-btn icon-btn--danger"
                                                                title="Eliminar"
                                                                onClick={() =>
                                                                    showConfirm(`¿Eliminar "${p.name}"? También se borran sus promociones.`, { confirmLabel: "Eliminar" }).then(
                                                                        (ok) => ok && actions.deleteProduct(p.id)
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {tab === "production" && <ProductionPanel />}
            {canStock && tab === "entries" && <StockEntriesPanel onNew={() => setReceiving(true)} />}
            {canEdit && tab === "categories" && <CategoriesPanel />}
            {canEdit && tab === "promotions" && <PromotionsPanel />}

            {receiving && <StockEntryForm onClose={() => setReceiving(false)} />}
            {canEdit && editing && <ProductForm product={editing.id ? editing : null} onClose={() => setEditing(null)} />}
        </div>
    );
}

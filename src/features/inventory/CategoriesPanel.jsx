import { useState } from "react";
import { Plus, Tags, X } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { EmptyState } from "../../components/ui";

export default function CategoriesPanel() {
    const { categories, products, actions } = useData();
    const { showToast, showConfirm } = useUi();
    const [name, setName] = useState("");

    const countBy = products.reduce((acc, p) => ((acc[p.categoryId] = (acc[p.categoryId] || 0) + 1), acc), {});

    const add = (e) => {
        e.preventDefault();
        const clean = name.trim();
        if (!clean) return;
        if (categories.some((c) => c.name.trim().toLowerCase() === clean.toLowerCase())) {
            showToast("Esa categoría ya existe", "warning");
            return;
        }
        actions.addCategory(clean);
        setName("");
    };

    return (
        <div className="card">
            <form className="inline-form" onSubmit={add}>
                <input className="input input--lg" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría (ej: Bebidas calientes)" />
                <button className="btn btn--primary btn--lg" type="submit" disabled={!name.trim()}>
                    <Plus size={18} /> Agregar
                </button>
            </form>
            {categories.length === 0 ? (
                <EmptyState icon={Tags} title="Aún no hay categorías" />
            ) : (
                <div className="tag-cloud">
                    {categories.map((c) => (
                        <span key={c.id} className="tag-item">
                            <b>{c.name}</b>
                            <span className="muted">{countBy[c.id] || 0}</span>
                            <button
                                className="icon-btn icon-btn--danger icon-btn--xs"
                                aria-label={`Eliminar ${c.name}`}
                                onClick={() =>
                                    showConfirm(
                                        countBy[c.id]
                                            ? `"${c.name}" tiene ${countBy[c.id]} productos; quedarán sin categoría. ¿Eliminar?`
                                            : `¿Eliminar la categoría "${c.name}"?`,
                                        { confirmLabel: "Eliminar" }
                                    ).then((ok) => ok && actions.deleteCategory(c.id))
                                }
                            >
                                <X size={14} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

import { useState } from "react";
import { PackagePlus, Pencil, ImageOff, Save, X } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { ChipGroup, Field, Modal, MoneyInput } from "../../components/ui";
import { useShowPhotos } from "../../lib/hooks";
import { useAuth } from "../../context/AuthProvider";
import { formatCurrency } from "../../lib/format";

const toForm = (p) => ({
    name: p?.name || "",
    categoryId: p?.categoryId || "",
    price: p?.price != null ? String(p.price) : "",
    specialPrice: p?.specialPrice ? String(p.specialPrice) : "",
    wholesalePrice: p?.wholesalePrice ? String(p.wholesalePrice) : "",
    quantity: p?.quantity != null ? String(p.quantity) : "",
    cost: p?.cost ? String(p.cost) : "",
    image: p?.image || "",
});

export default function ProductForm({ product, onClose }) {
    const { categories, categoryColor, products, actions } = useData();
    const { showToast } = useUi();
    const [form, setForm] = useState(() => toForm(product));
    const [showPhotos] = useShowPhotos();
    const { isAdmin } = useAuth();
    const price = parseFloat(form.price) || 0;
    const cost = parseFloat(form.cost) || 0;
    const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
    const isEdit = Boolean(product);

    const submit = (e) => {
        e.preventDefault();
        const name = form.name.trim();
        if (!name || form.price === "" || form.quantity === "") {
            showToast("Completa nombre, precio y stock", "warning");
            return;
        }
        const duplicate = products.find((p) => p.id !== product?.id && p.name.trim().toLowerCase() === name.toLowerCase());
        if (duplicate) {
            showToast(`Ya existe un producto llamado "${duplicate.name}"`, "warning");
            return;
        }
        const data = {
            name,
            categoryId: form.categoryId,
            price: parseFloat(form.price) || 0,
            specialPrice: form.specialPrice ? parseFloat(form.specialPrice) : null,
            wholesalePrice: form.wholesalePrice ? parseFloat(form.wholesalePrice) : null,
            quantity: parseInt(form.quantity, 10) || 0,
            image: form.image,
            // El cajero no ve el costo: si edita, se conserva el que había.
            ...(isAdmin ? { cost: cost > 0 ? cost : null } : {}),
        };
        if (isEdit) actions.updateProduct(product.id, data);
        else actions.addProduct(data);
        showToast(isEdit ? "Producto actualizado" : "Producto creado", "success");
        onClose();
    };

    return (
        <Modal title={isEdit ? "Editar producto" : "Nuevo producto"} icon={isEdit ? Pencil : PackagePlus} onClose={onClose} size={showPhotos ? "lg" : "md"}>
            <form className={`product-form ${showPhotos ? "" : "product-form--noimg"}`} onSubmit={submit}>
                {showPhotos && (
                    <div className="image-preview" style={form.image ? { backgroundImage: `url(${form.image})` } : undefined}>
                        {!form.image && (
                            <>
                                <ImageOff size={30} />
                                <span>Sin foto</span>
                            </>
                        )}
                        {form.image && (
                            <button type="button" className="image-drop__remove" onClick={() => set("image")("")} aria-label="Quitar foto">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                )}

                <div className="product-form__fields">
                    <Field label="Nombre *">
                        <input className="input input--lg" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Ej: Café americano" autoFocus />
                    </Field>
                    <Field label="Categoría">
                        <ChipGroup
                            options={[
                                { value: "", label: "Sin categoría" },
                                ...categories.map((c) => ({ value: c.id, label: c.name, icon: <span className="cat-dot" style={{ background: categoryColor(c.id) }} /> })),
                            ]}
                            value={form.categoryId}
                            onChange={set("categoryId")}
                        />
                    </Field>
                    <div className="form-grid">
                        <Field label="Precio *">
                            <MoneyInput value={form.price} onChange={set("price")} />
                        </Field>
                        <Field label="Precio especial" hint="Clientes frecuentes">
                            <MoneyInput value={form.specialPrice} onChange={set("specialPrice")} />
                        </Field>
                        <Field label="Precio mayorista">
                            <MoneyInput value={form.wholesalePrice} onChange={set("wholesalePrice")} />
                        </Field>
                        {isAdmin && (
                            <Field label="Costo" hint={cost > 0 && price > 0 ? `Ganancia ${formatCurrency(price - cost)} (${Math.round(((price - cost) / price) * 100)} %)` : "Solo lo ve el administrador"}>
                                <MoneyInput value={form.cost} onChange={set("cost")} />
                            </Field>
                        )}
                        <Field label="Stock *">
                            <input className="input" inputMode="numeric" value={form.quantity} onChange={(e) => set("quantity")(e.target.value.replace(/[^\d-]/g, ""))} placeholder="0" />
                        </Field>
                    </div>
                    {showPhotos && (
                        <Field label="Foto (opcional)" hint="Pega el enlace de una imagen (https://…)">
                            <input className="input" value={form.image} onChange={(e) => set("image")(e.target.value.trim())} placeholder="https://…" inputMode="url" />
                        </Field>
                    )}
                    <div className="modal__actions">
                        <button type="button" className="btn btn--ghost btn--lg" onClick={onClose}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn--primary btn--lg">
                            <Save size={18} /> {isEdit ? "Guardar cambios" : "Crear producto"}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

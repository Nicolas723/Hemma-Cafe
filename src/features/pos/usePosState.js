import { useCallback, useEffect, useState } from "react";
import { readJSON, readString, writeJSON, writeString } from "../../lib/storage";
import { isFlexible } from "../../lib/pricing";

// Las mesas se configuran por equipo en Ajustes (ver lib/tables.js).

/** Las órdenes guardadas por la versión anterior no tenían lineId. */
const normalizeTables = (saved) => {
    const out = {};
    Object.entries(saved || {}).forEach(([table, lines]) => {
        out[table] = (Array.isArray(lines) ? lines : []).map((l) => ({ ...l, lineId: l.lineId || l.id }));
    });
    return out;
};

const pickLine = (p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    specialPrice: p.specialPrice ?? null,
    wholesalePrice: p.wholesalePrice ?? null,
    isPriceFlexible: Boolean(p.isPriceFlexible),
    image: p.image || "",
});

/**
 * Estado de las mesas abiertas. Se guarda en localStorage (mismas claves que
 * la versión anterior) para no perder órdenes si se cierra la app o se va la luz.
 */
export function usePosState(mode, productsById, notify) {
    const k = (name) => `${name}_${mode}`;
    const [activeTable, setActiveTable] = useState("mostrador");
    const [tables, setTables] = useState(() => normalizeTables(readJSON(k("pos_tables_state"), null)));
    const [customers, setCustomers] = useState(() => (readJSON(k("pos_customers_state"), {})));
    const [customTotals, setCustomTotals] = useState(() => (readJSON(k("pos_custom_totals"), {})));
    const [notes, setNotes] = useState(() => (readJSON(k("pos_notes_state"), {})));
    const [vendedor, setVendedor] = useState(() => readString(k("selectedVendedor")));

    useEffect(() => writeJSON(k("pos_tables_state"), tables), [tables]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => writeJSON(k("pos_customers_state"), customers), [customers]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => writeJSON(k("pos_custom_totals"), customTotals), [customTotals]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => writeJSON(k("pos_notes_state"), notes), [notes]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => writeString(k("selectedVendedor"), vendedor), [vendedor]); // eslint-disable-line react-hooks/exhaustive-deps

    const stockOf = useCallback((id) => productsById[id]?.quantity ?? 0, [productsById]);

    const addProduct = useCallback(
        (product, customPrice) => {
            setTables((prev) => {
                const cart = prev[activeTable] || [];
                if (isFlexible(product)) {
                    // Cada "Otro" es una línea propia (antes se fusionaban con el primer precio).
                    const line = { ...pickLine(product), price: customPrice, lineId: `${product.id}:${Date.now()}`, cartQuantity: 1 };
                    return { ...prev, [activeTable]: [...cart, line] };
                }
                const inCart = cart.filter((l) => l.id === product.id).reduce((s, l) => s + l.cartQuantity, 0);
                if (inCart + 1 > stockOf(product.id)) {
                    notify(`No hay más "${product.name}" en stock`, "warning");
                    return prev;
                }
                const existing = cart.find((l) => l.lineId === product.id);
                const next = existing
                    ? cart.map((l) => (l === existing ? { ...l, cartQuantity: l.cartQuantity + 1 } : l))
                    : [...cart, { ...pickLine(product), lineId: product.id, cartQuantity: 1 }];
                return { ...prev, [activeTable]: next };
            });
        },
        [activeTable, stockOf, notify]
    );

    const changeQty = useCallback(
        (lineId, delta) => {
            setTables((prev) => {
                const cart = prev[activeTable] || [];
                const line = cart.find((l) => l.lineId === lineId);
                if (!line) return prev;
                const qty = line.cartQuantity + delta;
                if (qty <= 0) return { ...prev, [activeTable]: cart.filter((l) => l !== line) };
                if (delta > 0 && !isFlexible(line)) {
                    const inCart = cart.filter((l) => l.id === line.id).reduce((s, l) => s + l.cartQuantity, 0);
                    if (inCart + delta > stockOf(line.id)) {
                        notify(`No hay más "${line.name}" en stock`, "warning");
                        return prev;
                    }
                }
                return { ...prev, [activeTable]: cart.map((l) => (l === line ? { ...l, cartQuantity: qty } : l)) };
            });
        },
        [activeTable, stockOf, notify]
    );

    const removeLine = useCallback(
        (lineId) => setTables((prev) => ({ ...prev, [activeTable]: (prev[activeTable] || []).filter((l) => l.lineId !== lineId) })),
        [activeTable]
    );

    const clearTable = useCallback((tableId) => {
        setTables((prev) => ({ ...prev, [tableId]: [] }));
        setCustomers((prev) => ({ ...prev, [tableId]: "" }));
        setCustomTotals((prev) => ({ ...prev, [tableId]: null }));
        setNotes((prev) => ({ ...prev, [tableId]: "" }));
    }, []);

    const setFor = (setter) => (value) => setter((prev) => ({ ...prev, [activeTable]: value }));

    return {
        activeTable,
        setActiveTable,
        tables,
        cart: tables[activeTable] || [],
        customerId: customers[activeTable] || "",
        setCustomerId: setFor(setCustomers),
        customTotal: customTotals[activeTable] ?? null,
        setCustomTotal: setFor(setCustomTotals),
        notes: notes[activeTable] || "",
        setNotes: setFor(setNotes),
        vendedor,
        setVendedor,
        addProduct,
        changeQty,
        removeLine,
        clearTable,
    };
}

/**
 * Única fuente de verdad para precios. Antes esta lógica estaba copiada en
 * cinco lugares distintos (carrito, catálogo, cobro, crédito y recibo).
 */

export const PRICE_TYPES = {
    special: { label: "Especial", short: "Esp." },
    wholesale: { label: "Mayorista", short: "May." },
    general: { label: "General", short: "Gen." },
};

/** Producto de precio libre ("Otro"): el precio se digita al venderlo. */
export const isFlexible = (p) => Boolean(p?.isPriceFlexible) || p?.name?.trim().toLowerCase() === "otro";

/**
 * Precio unitario según el tipo de cliente.
 * @param {object} item producto o línea del carrito
 * @param {string|null} priceType tipo de precio del cliente; null = público general
 */
export function unitPrice(item, priceType) {
    if (!priceType || isFlexible(item)) return Number(item.price) || 0;
    if (priceType === "wholesale" && item.wholesalePrice) return Number(item.wholesalePrice);
    if (priceType === "special" && item.specialPrice) return Number(item.specialPrice);
    return Number(item.price) || 0;
}

/** Subtotal de una línea aplicando la promoción del producto si corresponde. */
export function lineSubtotal(item, priceType, promo) {
    const qty = item.cartQuantity || 0;
    const base = unitPrice(item, priceType);
    if (promo && qty >= promo.quantity && promo.quantity > 0) {
        if (promo.type === "bulk") return promo.price * qty;
        const packs = Math.floor(qty / promo.quantity);
        return packs * promo.price + (qty % promo.quantity) * base;
    }
    return base * qty;
}

/** Etiqueta corta que explica por qué el precio es distinto. */
export function lineBadge(item, priceType, promo) {
    const qty = item.cartQuantity || 0;
    if (promo && qty >= promo.quantity) {
        return promo.type === "bulk" ? `Promo ${promo.quantity}+` : `Pack ${promo.quantity}x`;
    }
    if (priceType && !isFlexible(item)) {
        if (priceType === "wholesale" && item.wholesalePrice) return "Mayorista";
        if (priceType === "special" && item.specialPrice) return "Especial";
    }
    return null;
}

export const promoMap = (promotions) => {
    const map = {};
    for (const p of promotions) if (!map[p.productId]) map[p.productId] = p;
    return map;
};

/**
 * Combina la línea guardada en el carrito con los datos actuales del producto,
 * así un cambio de precio en inventario se refleja en las mesas abiertas.
 */
export function liveLine(line, productsById) {
    const live = productsById[line.id];
    if (!live || isFlexible(line)) return line;
    return {
        ...line,
        name: live.name,
        price: live.price,
        specialPrice: live.specialPrice,
        wholesalePrice: live.wholesalePrice,
    };
}

/**
 * Calcula todas las cifras de una orden.
 * customTotal: total acordado (descuento manual) o null.
 */
export function computeOrder({ cart, productsById, promos, priceType, customTotal }) {
    const lines = cart.map((raw) => {
        const line = liveLine(raw, productsById);
        const promo = promos[line.id];
        const subtotal = lineSubtotal(line, priceType, promo);
        return { ...line, unit: unitPrice(line, priceType), subtotal, badge: lineBadge(line, priceType, promo) };
    });
    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const hasCustom = customTotal !== null && customTotal !== undefined && customTotal !== "";
    const total = hasCustom ? Math.max(0, parseFloat(customTotal) || 0) : subtotal;
    const units = lines.reduce((s, l) => s + (l.cartQuantity || 0), 0);
    return { lines, subtotal, total, hasCustom, units };
}

/** Líneas listas para guardar en la transacción, con el descuento global prorrateado. */
export function transactionItems(order, productsById) {
    const ratio = order.subtotal > 0 ? order.total / order.subtotal : 0;
    return order.lines.map((l) => {
        const originalPrice = productsById[l.id]?.price ?? l.price;
        const subtotal = Math.round(l.subtotal * ratio);
        const cost = productsById[l.id]?.cost;
        return {
            id: l.id,
            name: l.name,
            // Costo al momento de la venta (para la ganancia en Reportes); solo si está registrado.
            ...(typeof cost === "number" && cost > 0 ? { cost } : {}),
            originalPrice,
            price: l.unit,
            cartQuantity: l.cartQuantity,
            discount: originalPrice * l.cartQuantity - subtotal,
            subtotal,
        };
    });
}

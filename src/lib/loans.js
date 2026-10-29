/**
 * Cálculos de créditos (fiados). Cada producto fiado puede tener `paid`: dinero
 * ya abonado a ese producto sin alcanzar a pagarlo completo (abono por monto).
 *
 * Un "plan" describe cómo queda un crédito tras un abono:
 *   { loan, remaining: [items que se siguen debiendo], paidItems: [lo que se cobra] }
 */

export const itemOutstanding = (item) => Math.max(0, (item.price || 0) * (item.cartQuantity || 0) - (item.paid || 0));
export const loanOutstanding = (loan) => (loan.items || []).reduce((s, i) => s + itemOutstanding(i), 0);

/** Lo que cuesta pagar `qty` unidades de un producto: el abono previo se descuenta primero. */
export function pickCost(item, qty) {
    return Math.max(0, (item.price || 0) * qty - (item.paid || 0));
}

/** Abono por productos: picks = { índice: cantidad }. */
export function planFromPicks(loan, picks) {
    const remaining = [];
    const paidItems = [];
    (loan.items || []).forEach((item, idx) => {
        const qty = Math.min(picks[idx] || 0, item.cartQuantity || 0);
        if (qty <= 0) return remaining.push(item);
        const price = item.price || 0;
        const credit = item.paid || 0;
        const charged = pickCost(item, qty);
        paidItems.push({ ...item, paid: undefined, cartQuantity: qty, subtotal: charged });
        const left = item.cartQuantity - qty;
        if (left > 0) remaining.push({ ...item, cartQuantity: left, paid: Math.max(0, credit - price * qty) || undefined });
    });
    return { loan, remaining: remaining.map(clean), paidItems: paidItems.map(clean) };
}

/**
 * Abono por monto: reparte `amount` empezando por la compra más antigua y, dentro
 * de ella, en el orden de los productos. Lo que no alcanza para un producto
 * completo queda como abono parcial en ese producto.
 */
export function planFromAmount(loans, amount) {
    let left = Math.max(0, Math.round(amount || 0));
    const oldestFirst = [...loans].sort((a, b) => (a.dateObj || 0) - (b.dateObj || 0));
    const plans = [];
    for (const loan of oldestFirst) {
        if (left <= 0) break;
        const remaining = [];
        const paidItems = [];
        for (const item of loan.items || []) {
            const owed = itemOutstanding(item);
            if (left <= 0 || owed <= 0) {
                if (owed > 0) remaining.push(item);
                continue;
            }
            if (left >= owed) {
                paidItems.push({ ...item, paid: undefined, subtotal: owed });
                left -= owed;
            } else {
                paidItems.push({ id: item.id, name: `Abono a ${item.name}`, price: left, cartQuantity: 0, subtotal: left, partial: true });
                remaining.push({ ...item, paid: (item.paid || 0) + left });
                left = 0;
            }
        }
        if (paidItems.length) plans.push({ loan, remaining: remaining.map(clean), paidItems: paidItems.map(clean) });
    }
    return plans;
}

export const planTotal = (plans) => plans.reduce((s, p) => s + p.paidItems.reduce((t, i) => t + (i.subtotal || 0), 0), 0);

// Firestore no acepta `undefined`.
function clean(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

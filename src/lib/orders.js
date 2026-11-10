/**
 * Pedidos (domicilios, encargos y preventas). Funciones puras para poder probarlas.
 * Diseño: docs/superpowers/specs/2026-11-09-pedidos-design.md
 *
 * Lo reservado NO se guarda en el producto: se calcula a partir de los pedidos
 * abiertos de hoy y los atrasados, así nunca se descuadra entre equipos.
 */

export const OPEN_STATUSES = ["pending", "ready"];
export const ORDER_STATUS = {
    pending: { label: "Pendiente" },
    ready: { label: "Listo" },
    delivered: { label: "Entregado" },
    cancelled: { label: "Cancelado" },
};
export const ORDER_KINDS = {
    delivery: { label: "Domicilio" },
    pickup: { label: "Recoger" },
};
/** Línea de la caja para el valor del domicilio (no es un producto: no toca stock). */
export const DELIVERY_LINE_ID = "__domicilio";
/** Tipo de transacción del anticipo (dinero que entra sin ser venta todavía). */
export const DEPOSIT_TX_TYPE = "anticipo";

export const isOpenOrder = (o) => OPEN_STATUSES.includes(o?.status);

const pad = (n) => String(n).padStart(2, "0");
/** "AAAA-MM-DD" en hora local. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Date local (00:00) a partir de "AAAA-MM-DD". */
export const keyToDate = (key) => {
    const [y, m, d] = String(key).split("-").map(Number);
    return new Date(y, m - 1, d);
};

/** Totales de un pedido: productos + domicilio − anticipos. */
export function orderMoney(order) {
    const itemsTotal = (order.items || []).reduce((s, i) => s + (i.subtotal ?? (i.price || 0) * (i.cartQuantity || 0)), 0);
    const deliveryFee = Number(order.deliveryFee) || 0;
    const prepaid = (order.deposits || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const total = itemsTotal + deliveryFee;
    return { itemsTotal, deliveryFee, total, prepaid, due: total - prepaid };
}

/** ¿Este pedido aparta stock hoy? (abierto y para hoy o atrasado). */
export const reservesToday = (order, today = new Date()) => isOpenOrder(order) && order.dueDate <= dayKey(today);

/**
 * Unidades reservadas por producto: { [productId]: { qty, orders: [{ id, customerName, dueDate, dueTime, kind, qty }] } }.
 * `excludeIds`: pedidos que no cuentan (el que se está cobrando en la caja).
 */
export function reservedByProduct(orders, today = new Date(), excludeIds = []) {
    const skip = new Set(excludeIds);
    const out = {};
    for (const o of orders) {
        if (skip.has(o.id) || !reservesToday(o, today)) continue;
        for (const i of o.items || []) {
            if (!i.id || i.id === DELIVERY_LINE_ID || !(i.cartQuantity > 0)) continue;
            const entry = (out[i.id] ||= { qty: 0, orders: [] });
            entry.qty += i.cartQuantity;
            const existing = entry.orders.find((x) => x.id === o.id);
            if (existing) existing.qty += i.cartQuantity;
            else entry.orders.push({ id: o.id, customerName: o.customerName, dueDate: o.dueDate, dueTime: o.dueTime || "", kind: o.kind, qty: i.cartQuantity });
        }
    }
    return out;
}

/**
 * ¿Agregar una unidad más invade lo reservado? Devuelve null si no, o el detalle para el aviso.
 * `inCart`: unidades de ese producto que ya están en la mesa.
 */
export function reservationConflicts({ productId, stock, inCart, reserved }) {
    const r = reserved[productId];
    if (!r || !r.qty) return null;
    const available = (stock || 0) - r.qty;
    if (inCart + 1 <= available) return null;
    return { available, reserved: r.qty, stock: stock || 0, orders: r.orders };
}

/** Orden: por fecha, luego por hora; los sin hora al final de su día. */
export function sortOrders(orders) {
    return [...orders].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "") || (a.dueTime || "99:99").localeCompare(b.dueTime || "99:99") || (a.customerName || "").localeCompare(b.customerName || "", "es"));
}

/** Agenda: atrasados (antes de hoy) y un grupo por día desde hoy. */
export function groupOrdersByDay(orders, today = new Date()) {
    const todayKey = dayKey(today);
    const overdue = [];
    const byDay = {};
    for (const o of sortOrders(orders)) {
        if (o.dueDate < todayKey) overdue.push(o);
        else (byDay[o.dueDate] ||= []).push(o);
    }
    return { overdue, byDay };
}

/** Lo que hay que tener listo: total por producto vs stock actual. */
export function prepList(orders, productsById) {
    const map = new Map();
    for (const o of orders) {
        for (const i of o.items || []) {
            if (!(i.cartQuantity > 0) || i.id === DELIVERY_LINE_ID) continue;
            const key = i.id || `name:${i.name}`;
            const cur = map.get(key) || { id: i.id || null, name: productsById[i.id]?.name || i.name, qty: 0 };
            cur.qty += i.cartQuantity;
            map.set(key, cur);
        }
    }
    return [...map.values()]
        .map((x) => {
            const p = productsById[x.id];
            // Sin producto (o de precio libre, ej. una torta especial): todo es "por preparar".
            const stock = p && !p.isPriceFlexible ? p.quantity || 0 : 0;
            return { ...x, stock, missing: Math.max(0, x.qty - stock) };
        })
        .sort((a, b) => b.missing - a.missing || b.qty - a.qty || a.name.localeCompare(b.name, "es"));
}

/**
 * Líneas para la caja: precio acordado fijo (isPriceFlexible) y sin límite de stock (fromOrder).
 * El domicilio entra como una línea más que no descuenta inventario.
 */
export function orderCartLines(order) {
    const lines = (order.items || []).map((i, idx) => ({
        id: i.id || `__pedido_${idx}`,
        name: i.name,
        price: i.cartQuantity > 0 && i.subtotal !== undefined ? i.subtotal / i.cartQuantity : Number(i.price) || 0,
        specialPrice: null,
        wholesalePrice: null,
        isPriceFlexible: true,
        fromOrder: true,
        image: "",
        lineId: `${order.id}:${idx}`,
        cartQuantity: i.cartQuantity || 1,
    }));
    const fee = Number(order.deliveryFee) || 0;
    if (fee > 0) {
        lines.push({ id: DELIVERY_LINE_ID, name: "Domicilio", price: fee, specialPrice: null, wholesalePrice: null, isPriceFlexible: true, fromOrder: true, image: "", lineId: `${order.id}:domicilio`, cartQuantity: 1 });
    }
    return lines;
}

/** Texto corto de la hora: "3:00 p. m." o "" */
export function formatDueTime(time) {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const d = new Date(2000, 0, 1, h, m);
    return d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

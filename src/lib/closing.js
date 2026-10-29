import { toDate } from "./format";

/**
 * Cuentas del cierre de caja (puras, para poder probarlas).
 *
 * En efectivo se espera: ventas en efectivo + base con que se abrió − salidas de caja.
 * `realTotal` es el dinero de las ventas (lo contado sin la base y sumando lo que salió),
 * para compararlo con `expectedTotal` (lo vendido).
 */
export const isCash = (method) => /efectivo/i.test(method || "");
export const COURTESY_METHOD = "Servicio";

/** Ventas y salidas desde `since`. */
export function closingPeriod({ transactions, cashOuts = [], since }) {
    const list = transactions.filter((t) => toDate(t.date) > since);
    const outs = cashOuts.filter((o) => toDate(o.date) > since);
    const byMethod = {};
    let expected = 0;
    let units = 0;
    for (const t of list) {
        expected += t.total || 0;
        units += (t.items || []).reduce((s, i) => s + (i.partial ? 0 : i.cartQuantity || 1), 0); // un abono parcial no es un producto entregado
        const pays = t.payments?.length ? t.payments : [{ method: t.paymentMethod || "Efectivo", amount: t.total || 0 }];
        for (const p of pays) byMethod[p.method || "Otro"] = (byMethod[p.method || "Otro"] || 0) + (p.amount || 0);
    }
    const outsTotal = outs.reduce((s, o) => s + (o.amount || 0), 0);
    return { list, count: list.length, expected, units, byMethod, outs, outsTotal };
}

/** Métodos a contar: los configurados + los usados; sin cortesías; siempre con efectivo. */
export function closingMethods(paymentMethodNames, byMethod) {
    const names = new Set(paymentMethodNames);
    Object.keys(byMethod).forEach((m) => names.add(m));
    names.delete(COURTESY_METHOD);
    if (![...names].some(isCash)) names.add("Efectivo");
    return [...names];
}

/**
 * Filas del conteo. `counted[m]` vacío = se asume que cuadra (lo contado es lo esperado).
 * Devuelve también los totales que se guardan en el cierre.
 */
export function closingRows({ methods, byMethod, base = 0, outsTotal = 0, counted = {}, expectedTotal = 0 }) {
    const rows = methods.map((m) => {
        const expected = (byMethod[m] || 0) + (isCash(m) ? base - outsTotal : 0);
        const raw = counted[m];
        const real = raw !== undefined && raw !== "" ? parseInt(raw, 10) || 0 : expected;
        return { method: m, expected, real, diff: real - expected };
    });
    const countedTotal = rows.reduce((s, r) => s + r.real, 0);
    const realTotal = countedTotal - base + outsTotal;
    return { rows, realTotal, difference: realTotal - expectedTotal, withDiff: rows.filter((r) => r.diff !== 0) };
}

import { toDate } from "./format";
import { addDays, endOfDay, startOfDay } from "./dates";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export const REPORT_PRESETS = [
    { id: "today", label: "Hoy", range: () => [startOfDay(), endOfDay()] },
    { id: "yesterday", label: "Ayer", range: () => [startOfDay(addDays(new Date(), -1)), endOfDay(addDays(new Date(), -1))] },
    { id: "week", label: "7 días", range: () => [startOfDay(addDays(new Date(), -6)), endOfDay()] },
    { id: "30", label: "30 días", range: () => [startOfDay(addDays(new Date(), -29)), endOfDay()] },
    { id: "month", label: "Este mes", range: () => [new Date(new Date().getFullYear(), new Date().getMonth(), 1), endOfDay()] },
    {
        id: "lastMonth",
        label: "Mes pasado",
        range: () => {
            const n = new Date();
            return [new Date(n.getFullYear(), n.getMonth() - 1, 1), endOfDay(new Date(n.getFullYear(), n.getMonth(), 0))];
        },
    },
    { id: "year", label: "Este año", range: () => [new Date(new Date().getFullYear(), 0, 1), endOfDay()] },
];

/** Periodo anterior de la misma duración (para comparar). */
export function previousRange([start, end]) {
    const len = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    return [new Date(prevEnd.getTime() - len), prevEnd];
}

const isAbono = (t) => t.type === "abono";
const itemRevenue = (i) => i.subtotal ?? (i.price || 0) * (i.cartQuantity || 1);
const paymentsOf = (t) => (t.payments?.length ? t.payments : [{ method: t.paymentMethod || "Efectivo", amount: t.total || 0 }]);

/** Resumen de un periodo. Los abonos cuentan como ingreso, no como venta nueva. */
export function summarize(transactions, [start, end]) {
    const list = transactions.filter((t) => {
        const d = toDate(t.date);
        return d >= start && d <= end;
    });
    const sales = list.filter((t) => !isAbono(t));
    const income = list.reduce((s, t) => s + (t.total || 0), 0);
    const salesTotal = sales.reduce((s, t) => s + (t.total || 0), 0);
    const units = list.reduce((s, t) => s + (t.items || []).reduce((u, i) => u + (i.partial ? 0 : i.cartQuantity || 1), 0), 0);
    // Ganancia estimada: solo de los productos con costo registrado.
    let profit = 0;
    let costedRevenue = 0;
    let itemsRevenue = 0;
    list.forEach((t) =>
        (t.items || []).forEach((i) => {
            const revenue = itemRevenue(i);
            itemsRevenue += revenue;
            if (i.partial || !(i.cost > 0)) return;
            costedRevenue += revenue;
            profit += revenue - i.cost * (i.cartQuantity || 1);
        })
    );
    return {
        profit: Math.round(profit),
        margin: costedRevenue ? Math.round((profit / costedRevenue) * 100) : 0,
        costCoverage: itemsRevenue ? Math.round((costedRevenue / itemsRevenue) * 100) : 0,
        list,
        income,
        salesCount: sales.length,
        abonosTotal: income - salesTotal,
        avgTicket: sales.length ? Math.round(salesTotal / sales.length) : 0,
        units,
    };
}

/** Ingresos por día (o por mes si el periodo es largo). */
export function incomeByTime(list, [start, end]) {
    const days = Math.round((startOfDay(end) - startOfDay(start)) / 864e5) + 1;
    const byMonth = days > 62;
    const buckets = new Map();
    if (byMonth) {
        for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
            buckets.set(`${d.getFullYear()}-${d.getMonth()}`, { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()], tip: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, value: 0 });
        }
    } else {
        for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
            const k = d.toDateString();
            buckets.set(k, { key: k, label: days <= 7 ? DAYS[d.getDay()] : String(d.getDate()), tip: `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`, value: 0 });
        }
    }
    list.forEach((t) => {
        const d = toDate(t.date);
        const k = byMonth ? `${d.getFullYear()}-${d.getMonth()}` : startOfDay(d).toDateString();
        const b = buckets.get(k);
        if (b) b.value += t.total || 0;
    });
    return { byMonth, data: [...buckets.values()] };
}

/** Número de ventas por hora del día (horas pico). */
export function salesByHour(list) {
    const counts = new Array(24).fill(0);
    list.filter((t) => !isAbono(t)).forEach((t) => counts[toDate(t.date).getHours()]++);
    const used = counts.map((c, h) => (c ? h : -1)).filter((h) => h >= 0);
    const from = Math.min(6, ...used);
    const to = Math.max(21, ...used);
    const out = [];
    for (let h = from; h <= to; h++) {
        const label = h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
        out.push({ key: String(h), label, tip: `${label}m (${h}:00 – ${h}:59)`, value: counts[h] });
    }
    return out;
}

export function topProducts(list, by = "revenue", limit = 10) {
    const map = new Map();
    list.forEach((t) =>
        (t.items || []).forEach((i) => {
            if (i.partial) return;
            const k = i.name || i.id;
            const e = map.get(k) || { key: k, label: i.name || "Producto", units: 0, revenue: 0, profit: 0 };
            e.units += i.cartQuantity || 1;
            e.revenue += itemRevenue(i);
            if (i.cost > 0) e.profit += itemRevenue(i) - i.cost * (i.cartQuantity || 1);
            map.set(k, e);
        })
    );
    return [...map.values()].sort((a, b) => b[by] - a[by]).slice(0, limit);
}

export function byPaymentMethod(list) {
    const map = new Map();
    list.forEach((t) => paymentsOf(t).forEach((p) => map.set(p.method || "Otro", (map.get(p.method || "Otro") || 0) + (p.amount || 0))));
    return [...map.entries()].filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, label: k, value: v })).sort((a, b) => b.value - a.value);
}

export function bySeller(list) {
    const map = new Map();
    list.forEach((t) => {
        const k = t.vendedorName || "Sin asignar";
        const e = map.get(k) || { key: k, label: k, value: 0, count: 0 };
        e.value += t.total || 0;
        if (!isAbono(t)) e.count++;
        map.set(k, e);
    });
    return [...map.values()].sort((a, b) => b.value - a.value);
}

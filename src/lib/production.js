import { toDate } from "./format";
import { addDays, startOfDay } from "./dates";

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Sugerencia de producción / pedido para un día de la semana:
 * promedio de unidades vendidas ese mismo día en las últimas `weeks` semanas,
 * con un margen de seguridad, menos lo que ya hay en stock.
 */
export function productionSuggestion({ transactions, products, weekday, weeks = 6, margin = 0.1, today = new Date() }) {
    const from = startOfDay(addDays(today, -weeks * 7));
    const to = startOfDay(today); // solo días completos
    // Cuántos de esos días hubo en el periodo (para promediar bien aunque algún día no se vendiera nada).
    let days = 0;
    for (let d = new Date(from); d < to; d = addDays(d, 1)) if (d.getDay() === weekday) days++;
    if (!days) return [];

    const sold = new Map();
    for (const t of transactions) {
        const d = toDate(t.date);
        if (d < from || d >= to || d.getDay() !== weekday) continue;
        for (const i of t.items || []) {
            if (i.partial || !i.id) continue;
            sold.set(i.id, (sold.get(i.id) || 0) + (i.cartQuantity || 0));
        }
    }

    return products
        .filter((p) => !p.isPriceFlexible && sold.get(p.id))
        .map((p) => {
            const avg = sold.get(p.id) / days;
            const target = Math.ceil(avg * (1 + margin));
            const stock = p.quantity || 0;
            return { id: p.id, name: p.name, avg: Math.round(avg * 10) / 10, target, stock, suggested: Math.max(0, target - stock) };
        })
        .sort((a, b) => b.suggested - a.suggested || b.avg - a.avg);
}

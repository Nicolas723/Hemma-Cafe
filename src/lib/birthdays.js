/**
 * Cumpleaños de clientes: se guarda solo día y mes como "MM-DD" (sin año).
 */
const pad = (n) => String(n).padStart(2, "0");

export const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** "MM-DD" válido o "" (para borrar). */
export function toBirthday(day, month) {
    const d = Number(day);
    const m = Number(month);
    if (!d || !m || m < 1 || m > 12) return "";
    const max = new Date(2024, m, 0).getDate(); // 2024 es bisiesto: admite el 29 de febrero
    if (d < 1 || d > max) return "";
    return `${pad(m)}-${pad(d)}`;
}

export function parseBirthday(value) {
    const m = /^(\d{2})-(\d{2})$/.exec(value || "");
    return m ? { month: Number(m[1]), day: Number(m[2]) } : null;
}

/** "13 de noviembre" */
export function formatBirthday(value) {
    const b = parseBirthday(value);
    return b ? `${b.day} de ${MONTHS[b.month - 1].toLowerCase()}` : "";
}

/** Próxima fecha del cumpleaños desde `today` (el 29 de febrero cae el 28 en años no bisiestos). */
function nextOccurrence({ month, day }, today) {
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const at = (year) => {
        const last = new Date(year, month, 0).getDate();
        return new Date(year, month - 1, Math.min(day, last));
    };
    let date = at(base.getFullYear());
    if (date < base) date = at(base.getFullYear() + 1);
    return { date, daysAway: Math.round((date - base) / 864e5) };
}

/** Clientes que cumplen años hoy o en los próximos `days` días, del más cercano al más lejano. */
export function upcomingBirthdays(customers, today = new Date(), days = 7) {
    return customers
        .map((customer) => {
            const b = parseBirthday(customer.birthday);
            return b ? { customer, ...nextOccurrence(b, today) } : null;
        })
        .filter((x) => x && x.daysAway <= days)
        .sort((a, b) => a.daysAway - b.daysAway || (a.customer.name || "").localeCompare(b.customer.name || "", "es"));
}

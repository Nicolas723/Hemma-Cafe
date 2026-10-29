import { toDate } from "./format";

export const startOfDay = (d = new Date()) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

export const endOfDay = (d = new Date()) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
};

export const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
};

export const isSameDay = (a, b) => startOfDay(toDate(a)).getTime() === startOfDay(toDate(b)).getTime();

/** yyyy-mm-dd para <input type="date"> en hora local. */
export const toInputDate = (d) => {
    if (!d) return "";
    const x = toDate(d);
    const pad = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

export const fromInputDate = (s) => {
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
};

export const DATE_PRESETS = [
    { id: "today", label: "Hoy", range: () => [startOfDay(), endOfDay()] },
    { id: "yesterday", label: "Ayer", range: () => [startOfDay(addDays(new Date(), -1)), endOfDay(addDays(new Date(), -1))] },
    { id: "week", label: "7 días", range: () => [startOfDay(addDays(new Date(), -6)), endOfDay()] },
    {
        id: "month",
        label: "Este mes",
        range: () => {
            const now = new Date();
            return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay()];
        },
    },
    { id: "all", label: "Todo", range: () => [null, null] },
];

export function inRange(value, [start, end]) {
    const d = toDate(value);
    if (Number.isNaN(d.getTime())) return true;
    if (start && d < startOfDay(start)) return false;
    if (end && d > endOfDay(end)) return false;
    return true;
}

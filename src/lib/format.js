const currencyFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

export function formatCurrency(amount) {
    const n = Number(amount);
    return currencyFormatter.format(Number.isFinite(n) ? n : 0);
}

const dateFormatter = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const dateLongFormatter = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });

export const formatDate = (d) => (d ? dateFormatter.format(toDate(d)) : "-");
export const formatDateLong = (d) => (d ? dateLongFormatter.format(toDate(d)) : "-");
export const formatTime = (d) => (d ? timeFormatter.format(toDate(d)) : "");
export const formatDateTime = (d) => (d ? `${formatDate(d)} · ${formatTime(d)}` : "-");

/** Acepta Timestamp de Firestore, {seconds}, string ISO, número o Date. */
export function toDate(value) {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    return new Date(value);
}

export const toNumber = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

export const initials = (name = "") =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("") || "?";

/** Color estable por texto (para avatares de productos sin imagen). */
const AVATAR_COLORS = ["#7a9a15", "#5b7410", "#9cbf1f", "#3f520c", "#8aab1a", "#6b8a12"];
export function colorFor(text = "") {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/**
 * Colores de acento por categoría (franja de las tarjetas sin foto). Verde de marca
 * primero, luego tonos que contrastan con él. Se asignan por orden de categoría
 * (ver DataProvider → categoryColor), así dos categorías no comparten color.
 */
export const CATEGORY_COLORS = ["#7a9a15", "#c0812a", "#2f8f83", "#4f6fae", "#a34e6b", "#8d5a3b", "#5b7410", "#d06a3a"];
export const NO_CATEGORY_COLOR = "#b8bfa8";

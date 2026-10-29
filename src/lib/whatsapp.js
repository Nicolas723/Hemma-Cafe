import { formatCurrency, toDate } from "./format";
import { itemOutstanding } from "./loans";

const shortDate = (d) => toDate(d).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

/** Número para wa.me: solo dígitos; celulares colombianos de 10 dígitos llevan el 57. */
export function normalizePhone(phone = "") {
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
    return digits;
}

export const isValidPhone = (phone) => normalizePhone(phone).length >= 10;

/**
 * Mensaje de recordatorio con el detalle de lo que debe.
 * Sin emojis: la redirección de WhatsApp en computador los dañaba (llegaban como «�»)
 * y Windows 7 tampoco los muestra. Solo texto, tildes y *negrita* de WhatsApp.
 */
export function reminderMessage(name, loans) {
    const first = (name || "").trim().split(/\s+/)[0] || "";
    const lines = [];
    let total = 0;
    for (const loan of loans) {
        for (const item of loan.items || []) {
            const owed = itemOutstanding(item);
            if (owed <= 0) continue;
            total += owed;
            lines.push(`- ${item.cartQuantity} ${item.name} (${shortDate(loan.date || loan.createdAt)}): ${formatCurrency(owed)}${item.paid ? " (ya abonaste una parte)" : ""}`);
        }
    }
    // formatCurrency usa un espacio no separable ("$ 3.000"): se cambia por uno normal para WhatsApp.
    return [`Hola ${first}, te saludamos de Hemma Café.`, `Te compartimos el detalle de tu cuenta pendiente:`, ...lines, `*Total: ${formatCurrency(total)}*`, `¡Gracias por tu preferencia!`]
        .join("\n")
        .replace(/\u00a0/g, " ");
}

export const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(globalThis.navigator?.userAgent || "");

/**
 * En celular abre la app de WhatsApp (wa.me). En computador va directo a WhatsApp Web:
 * wa.me mostraba una página intermedia y WhatsApp de escritorio ya no funciona en Windows 7.
 */
export function whatsappLink(phone, text, mobile = isMobileDevice()) {
    const number = normalizePhone(phone);
    const msg = encodeURIComponent(text);
    return mobile ? `https://wa.me/${number}?text=${msg}` : `https://web.whatsapp.com/send?phone=${number}&text=${msg}`;
}

import { addDoc, collection } from "firebase/firestore";

/**
 * Registro de actividad: quién hizo qué y cuándo (colección `auditLog`).
 * Solo para acciones sensibles: ediciones, anulaciones, descuentos, ajustes de
 * stock, cierres, usuarios y permisos. Lo consulta el administrador en Reportes.
 */
export const AUDIT_COLLECTION = "auditLog";

export const AUDIT_TYPES = {
    sale: { label: "Ventas", tone: "brand" },
    stock: { label: "Inventario", tone: "info" },
    loan: { label: "Créditos", tone: "warn" },
    closing: { label: "Cierres", tone: "brand" },
    users: { label: "Usuarios", tone: "danger" },
    settings: { label: "Ajustes", tone: "info" },
};

/** Escribe una entrada sin bloquear la UI (funciona offline: se sincroniza después). */
export function logAudit(db, user, type, action, detail = "") {
    if (!db) return;
    addDoc(collection(db, AUDIT_COLLECTION), {
        at: new Date(),
        type,
        action,
        detail,
        userId: user?.id || "",
        userName: user?.displayName || "Sistema",
    }).catch((err) => console.error("No se pudo registrar la actividad:", err));
}

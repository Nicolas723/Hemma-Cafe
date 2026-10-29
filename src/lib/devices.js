/**
 * Aprobación de equipos. Cada equipo tiene una sesión anónima de Firebase (uid) y
 * un documento `devices/{uid}` con estado "pending" o "approved". Las reglas de
 * Firestore solo dejan leer y escribir datos a los equipos aprobados, así que una
 * copia del instalador descargada por alguien más no puede ver nada.
 *
 * Antes de publicar las reglas, cada equipo que abre la app con internet se aprueba
 * solo (para no tener que aprobar uno por uno los que ya se usan).
 */
export const DEVICES_COLLECTION = "devices";

/** Código corto para reconocer el equipo al aprobarlo (ej. «4F7K»). */
export const deviceCode = (uid = "") => uid.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase() || "----";

/** Nombre sugerido según el tipo de equipo (el administrador lo puede cambiar). */
export function guessDeviceName() {
    const ua = navigator.userAgent || "";
    if (window.electron?.isDesktop) return "Caja (app de escritorio)";
    if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
    if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Celular Android" : "Tablet Android";
    if (/Windows/i.test(ua)) return "PC con Windows (navegador)";
    if (/Mac OS/i.test(ua)) return "Mac (navegador)";
    return "Equipo";
}

export const deviceInfo = (uid) => ({ code: deviceCode(uid), name: guessDeviceName() });

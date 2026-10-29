/**
 * Acceso seguro a localStorage (no revienta si el JSON guardado está dañado).
 *
 * Modo efímero (demo): mientras está activo, TODO se lee y escribe en memoria;
 * al salir de la demo se descarta y localStorage nunca se toca.
 */
let memory = null;

export function setEphemeral(on) {
    memory = on ? new Map() : null;
}

const backend = {
    get: (key) => (memory ? (memory.has(key) ? memory.get(key) : null) : localStorage.getItem(key)),
    set: (key, value) => (memory ? memory.set(key, value) : localStorage.setItem(key, value)),
    remove: (key) => (memory ? memory.delete(key) : localStorage.removeItem(key)),
};

export function readJSON(key, fallback) {
    try {
        const raw = backend.get(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export function writeJSON(key, value) {
    try {
        backend.set(key, JSON.stringify(value));
    } catch (err) {
        console.warn("No se pudo guardar en localStorage:", key, err);
    }
}

export function readString(key, fallback = "") {
    try {
        return backend.get(key) ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeString(key, value) {
    try {
        if (value === null || value === undefined || value === "") backend.remove(key);
        else backend.set(key, String(value));
    } catch {
        /* sin espacio o bloqueado */
    }
}

/** Sesión que dura solo mientras la app está abierta (se borra al cerrarla). */
export function readSessionJSON(key, fallback) {
    try {
        const raw = memory ? null : sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export function writeSessionJSON(key, value) {
    if (memory) return;
    try {
        if (value === null || value === undefined) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* bloqueado */
    }
}

/** Borra restos de la demo de versiones anteriores (claves terminadas en _demo). */
export function purgeDemoLeftovers() {
    try {
        Object.keys(localStorage)
            .filter((k) => k.endsWith("_demo") || k === "pos_mode")
            .forEach((k) => localStorage.removeItem(k));
    } catch {
        /* bloqueado */
    }
}

/**
 * Contraseñas del personal: se guardan como hash PBKDF2-SHA256 con sal aleatoria
 * (nunca en texto plano). La verificación es local, por eso el ingreso funciona
 * aunque no haya internet. WebCrypto está disponible en Chromium 108 (Electron 22).
 */
const ITERATIONS = 100000;
const encoder = new TextEncoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
    return new Uint8Array(bits);
}

/** Devuelve los campos a guardar en el documento del usuario. */
export async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt, ITERATIONS);
    return { passwordHash: toB64(hash), salt: toB64(salt), iterations: ITERATIONS };
}

export async function verifyPassword(password, user) {
    if (!user?.passwordHash || !user?.salt) return false;
    const hash = await derive(password, fromB64(user.salt), user.iterations || ITERATIONS);
    const expected = fromB64(user.passwordHash);
    if (hash.length !== expected.length) return false;
    // Comparación en tiempo constante.
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i];
    return diff === 0;
}

export const MIN_PASSWORD = 4;

/** Mensaje de error o null si la contraseña es válida. */
export function passwordProblem(password, confirm) {
    if (!password || password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
    if (confirm !== undefined && password !== confirm) return "Las contraseñas no coinciden";
    return null;
}

/** Usuario normalizado: minúsculas, sin espacios ni tildes. */
export const normalizeUsername = (s = "") =>
    s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9._-]/g, "");

export const ROLES = {
    admin: { label: "Administrador", hint: "Acceso total, gestiona usuarios" },
    cajero: { label: "Cajero", hint: "Vende y cobra; lo demás según «Permisos del cajero»" },
};

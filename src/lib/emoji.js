/**
 * Windows 7 no trae fuente de emojis a color: muchos se ven como cuadros.
 * Detecta si un emoji se dibuja de verdad comparando sus píxeles contra un
 * carácter que ninguna fuente tiene. El resultado se guarda en caché.
 */
const cache = new Map();
let ctx = null;
let reference = null;

function hash(text) {
    ctx.clearRect(0, 0, 24, 24);
    ctx.fillText(text, 0, 16);
    const { data } = ctx.getImageData(0, 0, 24, 24);
    let h = 0;
    for (let i = 3; i < data.length; i += 4) h = (h * 31 + data[i]) & 0xffffffff;
    return h;
}

export function isEmojiSupported(emoji) {
    if (!emoji) return false;
    if (typeof document === "undefined") return true;
    if (cache.has(emoji)) return cache.get(emoji);
    if (!ctx) {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.font = "16px sans-serif";
        reference = hash("\u{100000}");
    }
    const h = hash(emoji);
    const ok = h !== 0 && h !== reference;
    cache.set(emoji, ok);
    return ok;
}

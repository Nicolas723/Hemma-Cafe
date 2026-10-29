import { getDocs, Timestamp } from "firebase/firestore";
import { buildWorkbook, downloadFile } from "./excel";
import { toDate } from "./format";
import { readString, writeString } from "./storage";

/**
 * Copia de seguridad de TODOS los datos:
 *  - .json completo (sirve para restaurar si algo se pierde).
 *  - .xlsx legible (ventas, productos, créditos, cierres, clientes, entradas).
 * En la app de escritorio se guarda sola en Documentos\Hemma POS\Copias de seguridad
 * (las 10 más recientes); en el navegador se descarga.
 */
export const BACKUP_COLLECTIONS = [
    "products",
    "categories",
    "customers",
    "promotions",
    "vendedores",
    "loans",
    "paymentMethods",
    "dailyPerformance",
    "transactions",
    "stockEntries",
    "cashOuts",
    "users",
    "config",
    "auditLog",
];
export const LAST_BACKUP_KEY = "pos_last_backup";
export const AUTO_BACKUP_DAYS = 7;

const iso = (v) => {
    const d = toDate(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};
const fmtDate = (v) => {
    const d = toDate(v);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("es-CO");
};

/**
 * En el .json las fechas de Firestore se guardan como { "__ts": "ISO" } para poder
 * restaurarlas exactamente como Timestamp (y no como texto).
 */
export function encodeValue(value) {
    if (value && typeof value.toDate === "function") return { __ts: value.toDate().toISOString() };
    if (value instanceof Date) return { __ts: value.toISOString() };
    if (Array.isArray(value)) return value.map(encodeValue);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeValue(v)]));
    return value;
}

export function decodeValue(value) {
    if (Array.isArray(value)) return value.map(decodeValue);
    if (value && typeof value === "object") {
        if (typeof value.__ts === "string" && Object.keys(value).length === 1) return Timestamp.fromDate(new Date(value.__ts));
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeValue(v)]));
    }
    return value;
}

async function collectAll(col) {
    const out = {};
    for (const name of BACKUP_COLLECTIONS) {
        const snap = await getDocs(col(name));
        out[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return out;
}

const itemsText = (items = []) => items.map((i) => (i.partial ? i.name : `${i.cartQuantity}× ${i.name}`)).join(", ");
const money = (width = 14) => ({ width, money: true });

function workbookSheets(data) {
    const cat = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
    return [
        {
            name: "Ventas",
            columns: [
                { header: "Fecha", key: "fecha", width: 20 },
                { header: "Tipo", key: "tipo", width: 10 },
                { header: "Cliente", key: "cliente", width: 22 },
                { header: "Vendedor", key: "vendedor", width: 16 },
                { header: "Registró", key: "registro", width: 16 },
                { header: "Método", key: "metodo", width: 14 },
                { header: "Total", key: "total", ...money() },
                { header: "Productos", key: "productos", width: 60 },
                { header: "Notas", key: "notas", width: 30 },
            ],
            rows: [...data.transactions]
                .sort((a, b) => iso(b.date).localeCompare(iso(a.date)))
                .map((t) => ({
                    fecha: fmtDate(t.date),
                    tipo: t.type === "abono" ? "Abono" : "Venta",
                    cliente: t.customerName,
                    vendedor: t.vendedorName,
                    registro: t.registeredBy || "",
                    metodo: (t.payments?.length ? t.payments.map((p) => p.method).join(" + ") : t.paymentMethod) || "",
                    total: t.total || 0,
                    productos: itemsText(t.items),
                    notas: t.notes || "",
                })),
        },
        {
            name: "Productos",
            columns: [
                { header: "Nombre", key: "nombre", width: 30 },
                { header: "Categoría", key: "categoria", width: 18 },
                { header: "Precio", key: "precio", ...money() },
                { header: "Especial", key: "especial", ...money() },
                { header: "Mayorista", key: "mayorista", ...money() },
                { header: "Stock", key: "stock", width: 10 },
            ],
            rows: data.products
                .filter((p) => !p.isPriceFlexible)
                .map((p) => ({ nombre: p.name, categoria: cat[p.categoryId] || "", precio: p.price, especial: p.specialPrice || "", mayorista: p.wholesalePrice || "", stock: p.quantity })),
        },
        {
            name: "Créditos",
            columns: [
                { header: "Cliente", key: "cliente", width: 24 },
                { header: "Fecha", key: "fecha", width: 20 },
                { header: "Producto", key: "producto", width: 30 },
                { header: "Cantidad", key: "cantidad", width: 10 },
                { header: "Precio", key: "precio", ...money() },
                { header: "Abonado", key: "abonado", ...money() },
            ],
            rows: data.loans.flatMap((l) =>
                (l.items || []).map((i) => ({ cliente: l.customerName, fecha: fmtDate(l.date), producto: i.name, cantidad: i.cartQuantity, precio: i.price, abonado: i.paid || 0 }))
            ),
        },
        {
            name: "Cierres",
            columns: [
                { header: "Fecha", key: "fecha", width: 20 },
                { header: "Esperado", key: "esperado", ...money() },
                { header: "Contado", key: "contado", ...money() },
                { header: "Diferencia", key: "diferencia", ...money() },
                { header: "Base de caja", key: "base", ...money() },
                { header: "Salidas", key: "salidas", ...money() },
                { header: "Cerró", key: "cerro", width: 16 },
                { header: "Notas", key: "notas", width: 40 },
            ],
            rows: data.dailyPerformance.map((l) => ({
                fecha: fmtDate(l.date),
                esperado: l.expectedTotal || 0,
                contado: l.realTotal || 0,
                diferencia: l.difference || 0,
                base: l.cashBase || 0,
                salidas: l.cashOutsTotal || 0,
                cerro: l.closedBy || "",
                notas: l.notes || "",
            })),
        },
        {
            name: "Salidas de caja",
            columns: [
                { header: "Fecha", key: "fecha", width: 20 },
                { header: "Motivo", key: "motivo", width: 40 },
                { header: "Valor", key: "valor", ...money() },
                { header: "Registró", key: "registro", width: 16 },
            ],
            rows: data.cashOuts.map((o) => ({ fecha: fmtDate(o.date), motivo: o.concept, valor: o.amount || 0, registro: o.registeredBy || "" })),
        },
        {
            name: "Clientes",
            columns: [
                { header: "Nombre", key: "nombre", width: 28 },
                { header: "Teléfono", key: "telefono", width: 16 },
                { header: "Tipo de precio", key: "tipo", width: 16 },
            ],
            rows: data.customers.map((c) => ({ nombre: c.name, telefono: c.phone || "", tipo: c.priceType || "" })),
        },
        {
            name: "Entradas de mercancía",
            columns: [
                { header: "Fecha", key: "fecha", width: 20 },
                { header: "Registró", key: "registro", width: 16 },
                { header: "Productos", key: "productos", width: 60 },
                { header: "Nota", key: "nota", width: 30 },
            ],
            rows: data.stockEntries.map((e) => ({ fecha: fmtDate(e.date), registro: e.registeredBy || "", productos: (e.items || []).map((i) => `${i.name} +${i.qty}`).join(", "), nota: e.note || "" })),
        },
    ];
}

const stamp = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

/** Crea la copia y la guarda. Devuelve { folder?, counts }. */
export async function runBackup(col) {
    const data = await collectAll(col);
    const json = JSON.stringify({ app: "Hemma POS", format: 2, createdAt: new Date().toISOString(), data: encodeValue(data) }, null, 1);
    // En el Excel no van los hashes de contraseñas.
    const xlsx = await buildWorkbook(workbookSheets(data));
    const base = `Hemma-copia_${stamp()}`;
    let folder = "";
    if (window.electron?.saveBackup) {
        folder = await window.electron.saveBackup([
            { name: `${base}.json`, data: new TextEncoder().encode(json) },
            { name: `${base}.xlsx`, data: new Uint8Array(xlsx) },
        ]);
    } else {
        await downloadFile(`${base}.xlsx`, xlsx);
        await downloadFile(`${base}.json`, json, "application/json");
    }
    writeString(LAST_BACKUP_KEY, new Date().toISOString());
    return { folder, counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) };
}

export const lastBackupDate = () => {
    const s = readString(LAST_BACKUP_KEY);
    return s ? new Date(s) : null;
};

export const backupIsDue = () => {
    const last = lastBackupDate();
    return !last || Date.now() - last.getTime() > AUTO_BACKUP_DAYS * 864e5;
};

/**
 * Lee un .json de copia. Devuelve { createdAt, data, counts } o lanza un error claro.
 * Acepta también el formato 1 (fechas como texto): se convierten las fechas conocidas.
 */
export async function readBackupFile(file) {
    let parsed;
    try {
        parsed = JSON.parse(await file.text());
    } catch {
        throw new Error("El archivo no es una copia válida (.json de Hemma POS)");
    }
    if (parsed?.app !== "Hemma POS" || !parsed.data || typeof parsed.data !== "object") throw new Error("El archivo no es una copia de Hemma POS");
    const DATE_KEYS = ["date", "createdAt", "lastUpdated", "updatedAt", "at"];
    const data = {};
    for (const name of BACKUP_COLLECTIONS) {
        const docs = Array.isArray(parsed.data[name]) ? parsed.data[name] : [];
        data[name] = docs
            .filter((d) => d && typeof d.id === "string" && d.id)
            .map((d) => {
                const doc = decodeValue(d);
                if ((parsed.format || 1) < 2) DATE_KEYS.forEach((k) => typeof doc[k] === "string" && !Number.isNaN(Date.parse(doc[k])) && (doc[k] = Timestamp.fromDate(new Date(doc[k]))));
                return doc;
            });
    }
    return { createdAt: parsed.createdAt ? new Date(parsed.createdAt) : null, data, counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])) };
}

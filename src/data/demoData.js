import { DEFAULT_PAYMENT_METHODS } from "../lib/paymentIcons";
import { OTRO_PRODUCT } from "./actions";

/**
 * Datos de muestra de la DEMO. Se generan al entrar y viven solo en memoria:
 * al salir de la demo (como administrador o cajero) se descartan por completo.
 */
const CATEGORIES = [
    { id: "cafe", name: "Café" },
    { id: "panaderia", name: "Panadería" },
    { id: "frias", name: "Bebidas frías" },
    { id: "postres", name: "Postres" },
];

// [id, nombre, categoría, precio, especial, mayorista, stock]
const PRODUCTS = [
    ["americano", "Café americano", "cafe", 4500, 4000, null, 80],
    ["capuchino", "Capuchino", "cafe", 7500, 6800, null, 60],
    ["latte", "Latte de vainilla", "cafe", 8500, 7800, null, 45],
    ["tinto", "Tinto campesino", "cafe", 2500, 2200, 2000, 120],
    ["filtrado", "Café filtrado de origen", "cafe", 9000, 8200, null, 30],
    ["croissant", "Croissant de mantequilla", "panaderia", 6000, 5200, 4500, 24],
    ["pandebono", "Pandebono", "panaderia", 2500, 2200, 1800, 40],
    ["almojabana", "Almojábana", "panaderia", 2800, 2500, 2000, 4],
    ["masamadre", "Pan de masa madre", "panaderia", 16000, 14500, 13000, 8],
    ["limonada", "Limonada de coco", "frias", 9000, 8000, null, 25],
    ["jugo", "Jugo de naranja natural", "frias", 7000, 6200, null, 3],
    ["frappe", "Frappé de café", "frias", 11000, 10000, null, 20],
    ["torta", "Torta de chocolate", "postres", 9500, 8500, null, 12],
    ["cheesecake", "Cheesecake de frutos rojos", "postres", 11000, 10000, null, 0],
];

// Costo aproximado (≈ 35-45 % del precio) para que la demo muestre la ganancia.
const COST_RATIO = { cafe: 0.3, panaderia: 0.4, frias: 0.35, postres: 0.45 };
const costOf = (id) => {
    const p = PRODUCTS.find((x) => x[0] === id);
    return Math.round((p[3] * COST_RATIO[p[2]]) / 100) * 100;
};

const daysAgo = (d, hour, minute = 0) => {
    const date = new Date();
    date.setDate(date.getDate() - d);
    date.setHours(hour, minute, 0, 0);
    return date;
};

const byId = Object.fromEntries(PRODUCTS.map(([id, name, , price]) => [id, { name, price }]));
const item = (id, qty) => ({ id, name: byId[id].name, cost: costOf(id), originalPrice: byId[id].price, price: byId[id].price, cartQuantity: qty, discount: 0, subtotal: byId[id].price * qty });

// [días atrás, hora, minuto, vendedor, método, cliente, [[producto, cantidad]…]]
const SALES = [
    [0, 7, 40, "Laura", "Efectivo", "General", [["tinto", 2], ["pandebono", 2]]],
    [0, 8, 15, "Laura", "Nequi", "General", [["capuchino", 1], ["croissant", 1]]],
    [0, 9, 5, "Andrés", "Tarjeta", "General", [["latte", 2], ["torta", 1]]],
    [0, 10, 30, "Andrés", "Efectivo", "Doña Marta", [["americano", 1], ["almojabana", 2]]],
    [1, 8, 0, "Laura", "Efectivo", "General", [["tinto", 3], ["pandebono", 3]]],
    [1, 11, 20, "Andrés", "Bre-B", "General", [["frappe", 2], ["cheesecake", 1]]],
    [1, 16, 45, "Laura", "Tarjeta", "General", [["filtrado", 1], ["torta", 2]]],
    [2, 9, 10, "Laura", "Nequi", "General", [["capuchino", 2], ["croissant", 2]]],
    [2, 15, 0, "Andrés", "Efectivo", "Oficina Calle 10", [["masamadre", 2], ["pandebono", 10]]],
    [3, 10, 0, "Laura", "Daviplata", "General", [["limonada", 2], ["jugo", 1]]],
    [4, 8, 30, "Andrés", "Efectivo", "General", [["tinto", 4], ["almojabana", 4]]],
    [5, 17, 15, "Laura", "Tarjeta", "General", [["latte", 1], ["cheesecake", 2]]],
];

// Historial de las 6 semanas anteriores (determinístico: siempre igual) para que
// los reportes, las comparaciones y «Qué preparar» tengan datos en la demo.
function rng(seed) {
    let x = seed;
    return () => (x = (x * 16807) % 2147483647) / 2147483647;
}
const BASKETS = [
    [["tinto", 2], ["pandebono", 2]],
    [["capuchino", 1], ["croissant", 1]],
    [["americano", 1], ["almojabana", 1]],
    [["latte", 1], ["torta", 1]],
    [["pandebono", 4]],
    [["masamadre", 1]],
    [["limonada", 1], ["croissant", 1]],
    [["frappe", 1], ["cheesecake", 1]],
    [["tinto", 1], ["almojabana", 2]],
];
const METHODS = ["Efectivo", "Efectivo", "Nequi", "Tarjeta", "Bre-B"];
function history() {
    const rand = rng(20261028);
    const out = [];
    for (let d = 6; d <= 42; d++) {
        const weekend = [0, 6].includes(daysAgo(d, 12).getDay());
        const count = (weekend ? 3 : 2) + Math.floor(rand() * 2);
        for (let n = 0; n < count; n++) {
            const items = BASKETS[Math.floor(rand() * BASKETS.length)].map(([id, q]) => item(id, q));
            const total = items.reduce((t, i) => t + i.subtotal, 0);
            const method = METHODS[Math.floor(rand() * METHODS.length)];
            const hour = 7 + Math.floor(rand() * 12);
            out.push({ date: daysAgo(d, hour, Math.floor(rand() * 60)), customerName: "General", vendedorName: rand() > 0.5 ? "Laura" : "Andrés", paymentMethod: method, payments: [{ method, amount: total }], notes: "", total, items });
        }
    }
    return out;
}

function closing(d, transactions) {
    const day = transactions.filter((t) => t.date.toDateString() === daysAgo(d, 12).toDateString());
    const byMethod = {};
    day.forEach((t) => (byMethod[t.paymentMethod] = (byMethod[t.paymentMethod] || 0) + t.total));
    const expected = day.reduce((s, t) => s + t.total, 0);
    const short = d === 2 ? 2000 : 0; // un faltante pequeño para que se vea el resaltado
    const perMethodStats = Object.fromEntries(
        Object.entries(byMethod).map(([m, v]) => [m, { expected: v, real: m === "Efectivo" ? v - short : v, diff: m === "Efectivo" ? -short : 0 }])
    );
    return {
        date: daysAgo(d, 20),
        expectedTotal: expected,
        realTotal: expected - short,
        difference: -short,
        diffMethod: short ? "Efectivo" : null,
        productsSold: day.reduce((s, t) => s + t.items.reduce((u, i) => u + i.cartQuantity, 0), 0),
        paymentMethodTotals: byMethod,
        perMethodStats,
        notes: short ? "Faltó cambio en la mañana" : "",
    };
}

export function buildDemoDataset() {
    const recent = SALES.map(([d, h, m, vendedorName, method, customerName, lines]) => {
        const items = lines.map(([id, q]) => item(id, q));
        const total = items.reduce((s, i) => s + i.subtotal, 0);
        return { date: daysAgo(d, h, m), customerName, vendedorName, paymentMethod: method, payments: [{ method, amount: total }], notes: "", total, items };
    });
    const transactions = [...recent, ...history()];
    const loanItems = (lines, d) => lines.map(([id, q]) => ({ ...item(id, q), dateAdded: daysAgo(d, 9).toISOString() }));

    return {
        categories: CATEGORIES.map((c) => ({ ...c, createdAt: daysAgo(30, 8) })),
        products: [
            ...PRODUCTS.map(([id, name, categoryId, price, specialPrice, wholesalePrice, quantity]) => ({ id, name, categoryId, price, specialPrice, wholesalePrice, quantity, cost: costOf(id), image: "", createdAt: daysAgo(30, 8) })),
            { id: "otro", ...OTRO_PRODUCT },
        ],
        paymentMethods: DEFAULT_PAYMENT_METHODS,
        vendedores: [{ name: "Laura" }, { name: "Andrés" }],
        customers: [
            { id: "marta", name: "Doña Marta", priceType: "special", phone: "3001234567" },
            { id: "oficina", name: "Oficina Calle 10", priceType: "wholesale" },
            { id: "julian", name: "Julián Ríos", priceType: "special" },
        ],
        promotions: [{ productId: "pandebono", quantity: 5, price: 2000, type: "bulk" }, { productId: "croissant", quantity: 2, price: 11000, type: "pack" }],
        transactions,
        loans: [
            { customerId: "julian", customerName: "Julián Ríos", vendedorName: "Laura", items: loanItems([["capuchino", 2], ["croissant", 1]], 1), notes: "", date: daysAgo(1, 9), createdAt: daysAgo(1, 9), lastUpdated: daysAgo(1, 9), status: "pending" },
            { customerId: "oficina", customerName: "Oficina Calle 10", vendedorName: "Andrés", items: loanItems([["pandebono", 20], ["tinto", 10]], 3), notes: "Paga los viernes", date: daysAgo(3, 9), createdAt: daysAgo(3, 9), lastUpdated: daysAgo(3, 9), status: "pending" },
        ],
        dailyPerformance: [1, 2, 3, 4, 5].map((d) => closing(d, transactions)),
        cashOuts: [{ date: daysAgo(0, 9, 15), amount: 8000, concept: "Insumos · bolsa de hielo", registeredBy: "Andrés" }],
        stockEntries: [
            { date: daysAgo(0, 6, 30), items: [{ id: "pandebono", name: "Pandebono", qty: 30 }, { id: "almojabana", name: "Almojábana", qty: 12 }], units: 42, note: "Horneada de la mañana", registeredBy: "Laura" },
            { date: daysAgo(2, 10), items: [{ id: "masamadre", name: "Pan de masa madre", qty: 6 }], units: 6, note: "Panadería La Espiga · factura 1043", registeredBy: "Andrés" },
        ],
    };
}

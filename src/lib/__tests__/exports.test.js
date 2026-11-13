import { describe, expect, it } from "vitest";
import { DATE_PRESETS } from "../dates";
import { closingSheet, filterClosings, filterInventory, filterLoans, filterSales, loanCustomers, rangeTag, safeFileName, saleKind, salesSummarySheet } from "../exports";

const d = (day, h = 10) => new Date(2026, 10, day, h);

describe("descargas: rango y nombre de archivo", () => {
    it("arma la parte del nombre según el rango", () => {
        expect(rangeTag([d(1), d(12)])).toBe("2026-11-01_a_2026-11-12");
        expect(rangeTag([d(12, 0), d(12, 23)])).toBe("2026-11-12");
        expect(rangeTag([null, null])).toBe("todo");
    });

    it("quita caracteres que Windows no acepta", () => {
        expect(safeFileName('Créditos_Ana/Pérez: "x".xlsx')).toBe("Créditos_AnaPérez_x.xlsx");
    });

    it("«Mes pasado» va del 1 al último día del mes anterior", () => {
        const [a, b] = DATE_PRESETS.find((p) => p.id === "lastMonth").range();
        const now = new Date();
        expect(a.getDate()).toBe(1);
        expect(a.getMonth()).toBe((now.getMonth() + 11) % 12);
        expect(b.getMonth()).toBe(a.getMonth());
        expect(new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1).getDate()).toBe(1);
    });
});

describe("descargas: cierres", () => {
    const logs = [
        { date: d(3), difference: 0, expectedTotal: 100, realTotal: 100, perMethodStats: { Efectivo: { real: 100 } } },
        { date: d(5), difference: -2000, expectedTotal: 50, realTotal: 48, perMethodStats: { Nequi: { real: 48 } } },
        { date: d(20), difference: 500 },
    ];

    it("filtra por fechas y solo con descuadre", () => {
        expect(filterClosings(logs, { range: [d(1), d(10)] })).toHaveLength(2);
        expect(filterClosings(logs, { range: [d(1), d(10)], onlyDiff: true }).map((l) => l.difference)).toEqual([-2000]);
        expect(filterClosings(logs, { range: [null, null], onlyDiff: true })).toHaveLength(2);
    });

    it("una columna por método, incluidos los que solo aparecen en los cierres", () => {
        const sheet = closingSheet(logs.slice(0, 2), ["Efectivo", "Tarjeta"]);
        const headers = sheet.columns.map((c) => c.header);
        expect(headers).toEqual(expect.arrayContaining(["Efectivo", "Tarjeta", "Nequi"]));
        expect(sheet.rows[1].m_Nequi).toBe(48);
        expect(sheet.rows[1].m_Efectivo).toBe(0);
    });
});

describe("descargas: ventas", () => {
    const txs = [
        { id: 1, date: d(2), total: 10000, vendedorName: "Ana", paymentMethod: "Efectivo", items: [{ name: "Capuchino", cartQuantity: 2 }] },
        { id: 2, date: d(2), total: 8000, vendedorName: "Luis", orderId: "o1", payments: [{ method: "Efectivo", amount: 3000 }, { method: "Nequi", amount: 5000 }], items: [{ name: "Torta", cartQuantity: 1 }] },
        { id: 3, date: d(3), total: 4000, type: "abono", vendedorName: "Ana", paymentMethod: "Nequi", customerName: "Marta", items: [{ name: "Pan", partial: true }] },
        { id: 4, date: d(4), total: 6000, type: "anticipo", orderId: "o2", vendedorName: "Ana", paymentMethod: "Efectivo", notes: "Para el sábado" },
    ];

    it("reconoce el tipo de cada movimiento", () => {
        expect(txs.map(saleKind)).toEqual(["sale", "order", "abono", "anticipo"]);
    });

    it("filtra por tipo, vendedor, método, fechas, notas y búsqueda", () => {
        const all = { range: [null, null] };
        expect(filterSales(txs, { ...all, kinds: ["sale", "order"] }).map((t) => t.id)).toEqual([1, 2]);
        expect(filterSales(txs, { ...all, vendedor: "Ana" }).map((t) => t.id)).toEqual([1, 3, 4]);
        expect(filterSales(txs, { ...all, method: "Nequi" }).map((t) => t.id)).toEqual([2, 3]);
        expect(filterSales(txs, { range: [d(3), d(4)] }).map((t) => t.id)).toEqual([3, 4]);
        expect(filterSales(txs, { ...all, onlyNotes: true }).map((t) => t.id)).toEqual([4]);
        expect(filterSales(txs, { ...all, query: "marta" }).map((t) => t.id)).toEqual([3]);
        expect(filterSales(txs, { ...all, kinds: [] })).toHaveLength(4); // nada marcado = todo
    });

    it("«una fila por venta» reparte el dinero por método de pago", () => {
        const sheet = salesSummarySheet(txs, ["Efectivo", "Tarjeta"]);
        expect(sheet.rows).toHaveLength(4);
        expect(sheet.rows[1]).toMatchObject({ tipo: "Pedido", total: 8000, m_Efectivo: 3000, m_Nequi: 5000, m_Tarjeta: null, detalle: "1× Torta" });
        expect(sheet.rows[2].detalle).toBe("Abono a Pan");
        expect(sheet.rows[3]).toMatchObject({ tipo: "Anticipo pedido", detalle: "Anticipo", m_Efectivo: 6000 });
    });
});

describe("descargas: créditos e inventario", () => {
    const loans = [
        { customerId: "c1", customerName: "Marta", date: d(1), items: [{ name: "Pan", price: 1000, cartQuantity: 2 }] },
        { customerId: "c2", customerName: "Ana", date: d(9), items: [{ name: "Café", price: 3000, cartQuantity: 1 }] },
        { customerId: "c1", customerName: "Marta", date: d(10), items: [] },
    ];

    it("filtra créditos por cliente y fecha del fiado", () => {
        expect(filterLoans(loans, { range: [null, null], customer: "c1" })).toHaveLength(2);
        expect(filterLoans(loans, { range: [d(5), d(12)] }).map((l) => l.customerName)).toEqual(["Ana", "Marta"]);
        expect(loanCustomers(loans)).toEqual([
            { value: "c2", label: "Ana" },
            { value: "c1", label: "Marta" },
        ]);
    });

    it("inventario: categoría, stock bajo y sin productos de precio libre", () => {
        const products = [
            { name: "Pan", categoryId: "pan", quantity: 3, price: 1000 },
            { name: "Torta", categoryId: "pan", quantity: 20, price: 5000 },
            { name: "Café", categoryId: "bebida", quantity: 0, price: 3000 },
            { name: "Otro", isPriceFlexible: true, quantity: 0 },
        ];
        expect(filterInventory(products, {}).map((p) => p.name)).toEqual(["Pan", "Torta", "Café"]);
        expect(filterInventory(products, { category: "pan" }).map((p) => p.name)).toEqual(["Pan", "Torta"]);
        expect(filterInventory(products, { lowOnly: true }).map((p) => p.name)).toEqual(["Pan", "Café"]);
    });
});

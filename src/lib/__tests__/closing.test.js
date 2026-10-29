import { describe, expect, it } from "vitest";
import { closingMethods, closingPeriod, closingRows } from "../closing";

const since = new Date(2026, 9, 28, 0, 0);
const at = (h) => new Date(2026, 9, 28, h, 0);
const transactions = [
    { date: at(8), total: 20000, paymentMethod: "Efectivo", items: [{ cartQuantity: 2 }] },
    { date: at(9), total: 15000, payments: [{ method: "Efectivo", amount: 5000 }, { method: "Nequi", amount: 10000 }], items: [{ cartQuantity: 1 }] },
    { date: at(10), total: 0, paymentMethod: "Servicio", items: [{ cartQuantity: 1 }] }, // cortesía
    { date: at(11), total: 3000, type: "abono", paymentMethod: "Efectivo", items: [{ partial: true, cartQuantity: 0 }] },
    { date: new Date(2026, 9, 27, 18), total: 99999, paymentMethod: "Efectivo", items: [] }, // ayer: no cuenta
];
const cashOuts = [{ date: at(9), amount: 8000, concept: "Hielo" }];

describe("cierre de caja", () => {
    const period = closingPeriod({ transactions, cashOuts, since });

    it("suma las ventas desde el último cierre, por método", () => {
        expect(period.count).toBe(4);
        expect(period.expected).toBe(38000);
        expect(period.byMethod).toEqual({ Efectivo: 28000, Nequi: 10000, Servicio: 0 });
        expect(period.units).toBe(4); // el abono parcial no cuenta como producto
        expect(period.outsTotal).toBe(8000);
    });

    it("no pide contar cortesías y siempre incluye efectivo", () => {
        expect(closingMethods(["Tarjeta"], period.byMethod)).toEqual(["Tarjeta", "Efectivo", "Nequi"]);
        expect(closingMethods([], {})).toEqual(["Efectivo"]);
    });

    it("efectivo esperado = ventas + base − salidas; sin escribir nada, cuadra", () => {
        const methods = closingMethods([], period.byMethod);
        const r = closingRows({ methods, byMethod: period.byMethod, base: 50000, outsTotal: 8000, counted: {}, expectedTotal: period.expected });
        expect(r.rows.find((x) => x.method === "Efectivo").expected).toBe(28000 + 50000 - 8000);
        expect(r.difference).toBe(0);
        expect(r.realTotal).toBe(38000);
    });

    it("detecta un faltante en efectivo", () => {
        const methods = closingMethods([], period.byMethod);
        const r = closingRows({ methods, byMethod: period.byMethod, base: 50000, outsTotal: 8000, counted: { Efectivo: "68000" }, expectedTotal: period.expected });
        expect(r.difference).toBe(-2000);
        expect(r.withDiff.map((x) => x.method)).toEqual(["Efectivo"]);
    });
});

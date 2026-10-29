import { describe, expect, it } from "vitest";
import { byPaymentMethod, incomeByTime, previousRange, salesByHour, summarize, topProducts } from "../reports";

const day = (d, h = 10) => new Date(2026, 9, d, h, 0);
const tx = [
    { date: day(26, 8), total: 15000, paymentMethod: "Efectivo", items: [{ name: "Capuchino", cartQuantity: 2, subtotal: 15000, cost: 2500 }] },
    { date: day(27, 8), total: 6000, paymentMethod: "Nequi", items: [{ name: "Croissant", cartQuantity: 1, subtotal: 6000 }] },
    { date: day(27, 15), total: 3000, type: "abono", paymentMethod: "Efectivo", items: [{ name: "Abono a Tinto", partial: true, cartQuantity: 0, subtotal: 3000 }] },
];
const range = [day(26, 0), new Date(2026, 9, 27, 23, 59)];

describe("reportes", () => {
    it("resume ingresos, ventas (sin abonos), ticket y unidades", () => {
        const s = summarize(tx, range);
        expect(s.income).toBe(24000);
        expect(s.salesCount).toBe(2);
        expect(s.abonosTotal).toBe(3000);
        expect(s.avgTicket).toBe(10500);
        expect(s.units).toBe(3);
    });

    it("ganancia solo con productos que tienen costo", () => {
        const s = summarize(tx, range);
        expect(s.profit).toBe(10000); // 15.000 − 2 × 2.500
        expect(s.margin).toBe(67);
        expect(s.costCoverage).toBe(63); // 15.000 de 24.000 en productos
    });

    it("periodo anterior de la misma duración", () => {
        const [a, b] = previousRange(range);
        expect(b.getTime()).toBe(range[0].getTime() - 1);
        expect(b - a).toBe(range[1] - range[0]);
    });

    it("agrupa por día, hora, producto y método", () => {
        const { data } = incomeByTime(tx, range);
        expect(data.map((d) => d.value)).toEqual([15000, 9000]);
        expect(salesByHour(tx).find((h) => h.key === "8").value).toBe(2);
        expect(topProducts(tx)[0]).toMatchObject({ label: "Capuchino", revenue: 15000, units: 2, profit: 10000 });
        expect(byPaymentMethod(tx)).toEqual([
            { key: "Efectivo", label: "Efectivo", value: 18000 },
            { key: "Nequi", label: "Nequi", value: 6000 },
        ]);
    });
});

import { describe, expect, it } from "vitest";
import { loanOutstanding, planFromAmount, planFromPicks, planTotal } from "../loans";

const old = { id: "a", dateObj: new Date(2026, 9, 1), items: [{ name: "Capuchino", price: 7500, cartQuantity: 2 }, { name: "Croissant", price: 6000, cartQuantity: 1 }] };
const recent = { id: "b", dateObj: new Date(2026, 9, 5), items: [{ name: "Tinto", price: 2500, cartQuantity: 4 }] };

describe("abonos a créditos", () => {
    it("por monto: paga primero lo más antiguo y deja el resto como abono parcial", () => {
        const plans = planFromAmount([recent, old], 18000);
        expect(planTotal(plans)).toBe(18000);
        expect(plans).toHaveLength(1);
        expect(plans[0].remaining).toEqual([{ name: "Croissant", price: 6000, cartQuantity: 1, paid: 3000 }]);
        expect(plans[0].paidItems[1]).toMatchObject({ partial: true, subtotal: 3000 });
    });

    it("por monto: sigue con el siguiente crédito y nunca cobra más de lo que se debe", () => {
        const afterFirst = { ...old, items: [{ name: "Croissant", price: 6000, cartQuantity: 1, paid: 3000 }] };
        expect(loanOutstanding(afterFirst)).toBe(3000);
        const plans = planFromAmount([afterFirst, recent], 5000);
        expect(plans[0].remaining).toHaveLength(0);
        expect(plans[1].remaining).toEqual([{ name: "Tinto", price: 2500, cartQuantity: 4, paid: 2000 }]);
        expect(planTotal(planFromAmount([old, recent], 999999))).toBe(31000);
    });

    it("por productos: descuenta lo ya abonado y conserva el total adeudado", () => {
        const withCredit = { ...recent, items: [{ name: "Tinto", price: 2500, cartQuantity: 4, paid: 2000 }] };
        const plan = planFromPicks(withCredit, { 0: 1 });
        expect(planTotal([plan])).toBe(500);
        expect(plan.remaining).toEqual([{ name: "Tinto", price: 2500, cartQuantity: 3 }]);
        expect(loanOutstanding(withCredit) - 500).toBe(loanOutstanding({ items: plan.remaining }));
    });
});

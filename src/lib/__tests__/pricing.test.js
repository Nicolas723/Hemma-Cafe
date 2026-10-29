import { describe, expect, it } from "vitest";
import { computeOrder, lineSubtotal, transactionItems, unitPrice } from "../pricing";

const cafe = { id: "c", name: "Capuchino", price: 7500, specialPrice: 6800, wholesalePrice: null };

describe("precios", () => {
    it("usa el precio según el tipo de cliente", () => {
        expect(unitPrice(cafe, null)).toBe(7500);
        expect(unitPrice(cafe, "special")).toBe(6800);
        // sin precio mayorista registrado se cobra el normal
        expect(unitPrice(cafe, "wholesale")).toBe(7500);
    });

    it("aplica promociones por volumen y por paquete", () => {
        expect(lineSubtotal({ ...cafe, cartQuantity: 5 }, null, { type: "bulk", quantity: 5, price: 7000 })).toBe(35000);
        expect(lineSubtotal({ ...cafe, cartQuantity: 4 }, null, { type: "bulk", quantity: 5, price: 7000 })).toBe(30000);
        // paquete 2x13.000: 3 unidades = 1 paquete + 1 suelta
        expect(lineSubtotal({ ...cafe, cartQuantity: 3 }, null, { type: "pack", quantity: 2, price: 13000 })).toBe(20500);
    });

    it("el descuento manual reemplaza el total y se reparte entre los productos", () => {
        const productsById = { c: { ...cafe, cost: 2500 } };
        const order = computeOrder({ cart: [{ ...cafe, lineId: "c", cartQuantity: 2 }], productsById, promos: {}, priceType: null, customTotal: "12000" });
        expect(order.subtotal).toBe(15000);
        expect(order.total).toBe(12000);
        const [item] = transactionItems(order, productsById);
        expect(item.subtotal).toBe(12000);
        expect(item.discount).toBe(3000);
        expect(item.cost).toBe(2500); // el costo viaja con la venta para calcular la ganancia
    });

    it("cortesía: total en cero", () => {
        const order = computeOrder({ cart: [{ ...cafe, lineId: "c", cartQuantity: 1 }], productsById: { c: cafe }, promos: {}, priceType: null, customTotal: "0" });
        expect(order.total).toBe(0);
        expect(order.hasCustom).toBe(true);
    });
});

import { describe, expect, it } from "vitest";
import { dayKey, orderMoney, reservedByProduct, reservationConflicts, groupOrdersByDay, prepList, orderCartLines, sortOrders, DELIVERY_LINE_ID } from "../orders";

const today = new Date(2026, 10, 10, 9, 0); // martes 10 nov 2026
const mk = (id, dueDate, items, extra = {}) => ({ id, customerName: id, dueDate, dueTime: "", status: "pending", items, deliveryFee: 0, deposits: [], ...extra });
const line = (id, qty, price = 1000) => ({ id, name: id, price, cartQuantity: qty, subtotal: price * qty });

describe("pedidos: fechas", () => {
    it("dayKey usa la fecha local AAAA-MM-DD", () => {
        expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    });
});

describe("pedidos: dinero", () => {
    it("suma productos + domicilio y descuenta anticipos", () => {
        const o = mk("a", "2026-11-10", [line("pan", 3, 2500)], { deliveryFee: 4000, deposits: [{ amount: 5000, method: "Nequi" }] });
        expect(orderMoney(o)).toEqual({ itemsTotal: 7500, deliveryFee: 4000, total: 11500, prepaid: 5000, due: 6500 });
    });
});

describe("pedidos: reservas", () => {
    const orders = [
        mk("hoy", "2026-11-10", [line("pan", 3), line("cafe", 1)]),
        mk("atrasado", "2026-11-08", [line("pan", 2)]),
        mk("jueves", "2026-11-12", [line("pan", 12)]),
        mk("listo", "2026-11-10", [line("pan", 1)], { status: "ready" }),
        mk("entregado", "2026-11-10", [line("pan", 50)], { status: "delivered" }),
        mk("cancelado", "2026-11-10", [line("pan", 50)], { status: "cancelled" }),
    ];

    it("solo reservan los abiertos de hoy y los atrasados (no los futuros ni los cerrados)", () => {
        const r = reservedByProduct(orders, today);
        expect(r.pan).toEqual({ qty: 6, orders: [expect.objectContaining({ id: "hoy", qty: 3 }), expect.objectContaining({ id: "atrasado", qty: 2 }), expect.objectContaining({ id: "listo", qty: 1 })] });
        expect(r.cafe.qty).toBe(1);
    });

    it("puede excluir el pedido que se está cobrando", () => {
        expect(reservedByProduct(orders, today, ["hoy"]).pan.qty).toBe(3);
    });

    it("la línea de domicilio y los productos sin id no reservan nada", () => {
        const o = mk("x", "2026-11-10", [{ id: DELIVERY_LINE_ID, name: "Domicilio", price: 3000, cartQuantity: 1 }, { name: "Torta especial", cartQuantity: 1 }]);
        expect(reservedByProduct([o], today)).toEqual({});
    });

    it("conflicto: avisa solo cuando la nueva unidad invade lo reservado", () => {
        const reserved = reservedByProduct(orders, today);
        // stock 10, reservado 6 → disponible 4
        expect(reservationConflicts({ productId: "pan", stock: 10, inCart: 3, reserved })).toBeNull();
        expect(reservationConflicts({ productId: "pan", stock: 10, inCart: 4, reserved })).toMatchObject({ available: 4, reserved: 6 });
        expect(reservationConflicts({ productId: "otro", stock: 10, inCart: 9, reserved })).toBeNull();
    });
});

describe("pedidos: agenda", () => {
    const orders = [
        mk("b", "2026-11-10", [], { dueTime: "15:00" }),
        mk("a", "2026-11-10", [], { dueTime: "09:30" }),
        mk("sinHora", "2026-11-10", []),
        mk("viejo", "2026-11-07", []),
        mk("vie", "2026-11-13", []),
    ];

    it("agrupa en atrasados, hoy y días futuros", () => {
        const g = groupOrdersByDay(orders, today);
        expect(g.overdue.map((o) => o.id)).toEqual(["viejo"]);
        expect(g.byDay["2026-11-10"].map((o) => o.id)).toEqual(["a", "b", "sinHora"]);
        expect(g.byDay["2026-11-13"].map((o) => o.id)).toEqual(["vie"]);
    });

    it("ordena por fecha y hora, los sin hora al final del día", () => {
        expect(sortOrders(orders).map((o) => o.id)).toEqual(["viejo", "a", "b", "sinHora", "vie"]);
    });

    it("lista para preparar: suma por producto y compara con el stock", () => {
        const day = [mk("1", "2026-11-10", [line("pan", 3), line("cafe", 1)]), mk("2", "2026-11-10", [line("pan", 9)])];
        const list = prepList(day, { pan: { id: "pan", name: "Pan", quantity: 8 }, cafe: { id: "cafe", name: "Café", quantity: 5 } });
        expect(list).toEqual([
            { id: "pan", name: "Pan", qty: 12, stock: 8, missing: 4 },
            { id: "cafe", name: "Café", qty: 1, stock: 5, missing: 0 },
        ]);
    });
});

describe("pedidos: carga en la caja", () => {
    it("convierte el pedido en líneas de precio fijo e incluye el domicilio", () => {
        const o = mk("a", "2026-11-10", [line("pan", 3, 2500)], { deliveryFee: 4000 });
        const lines = orderCartLines(o);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatchObject({ id: "pan", price: 2500, cartQuantity: 3, isPriceFlexible: true, fromOrder: true });
        expect(lines[1]).toMatchObject({ id: DELIVERY_LINE_ID, name: "Domicilio", price: 4000, cartQuantity: 1, fromOrder: true });
        expect(new Set(lines.map((l) => l.lineId)).size).toBe(2);
    });
});

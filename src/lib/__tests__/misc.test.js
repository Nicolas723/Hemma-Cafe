import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { productionSuggestion } from "../production";
import { normalizePhone, reminderMessage, whatsappLink } from "../whatsapp";
import { decodeValue, encodeValue } from "../backup";
import { hasPermission } from "../permissions";
import { deviceCode } from "../devices";

describe("sugerencia de producción", () => {
    it("promedia el mismo día de la semana y resta el stock", () => {
        const today = new Date(2026, 9, 29); // jueves
        const saturdays = [24, 17, 10].map((d) => new Date(2026, 9, d, 9));
        const transactions = saturdays.map((date, i) => ({ date, items: [{ id: "pan", cartQuantity: [30, 36, 33][i] }] }));
        const [row] = productionSuggestion({ transactions, products: [{ id: "pan", name: "Pandebono", quantity: 12 }], weekday: 6, weeks: 6, today });
        // 6 sábados en el periodo (3 con ventas): 99 / 6 = 16,5 → +10 % = 19 → faltan 7
        expect(row).toMatchObject({ avg: 16.5, target: 19, stock: 12, suggested: 7 });
    });
});

describe("WhatsApp", () => {
    it("agrega el 57 a celulares colombianos", () => {
        expect(normalizePhone("300 123 4567")).toBe("573001234567");
        expect(normalizePhone("+57 300-123-4567")).toBe("573001234567");
    });
    it("arma el mensaje con lo que falta por pagar", () => {
        const text = reminderMessage("Julián Ríos", [{ date: new Date(2026, 9, 27), items: [{ name: "Croissant", price: 6000, cartQuantity: 1, paid: 3000 }] }]);
        expect(text).toContain("Hola Julián,");
        expect(text).toContain("*Total: $ 3.000*");
        // Sin emojis ni caracteres especiales que WhatsApp dañe (llegaban como «�»).
        expect(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\u00a0\u2022]/u.test(text)).toBe(false);
        expect(whatsappLink("3001234567", "hola", true)).toBe("https://wa.me/573001234567?text=hola");
        expect(whatsappLink("3001234567", "hola", false)).toBe("https://web.whatsapp.com/send?phone=573001234567&text=hola");
    });
});

describe("copia de seguridad", () => {
    it("guarda y recupera las fechas como Timestamp", () => {
        const date = new Date("2026-10-28T15:00:00Z");
        const original = { date: Timestamp.fromDate(date), items: [{ name: "x", dateAdded: "2026-10-28" }], total: 5 };
        const json = JSON.parse(JSON.stringify(encodeValue(original)));
        expect(json.date).toEqual({ __ts: date.toISOString() });
        const back = decodeValue(json);
        expect(back.date.toDate().getTime()).toBe(date.getTime());
        expect(back.items[0].dateAdded).toBe("2026-10-28");
    });
});

describe("permisos y equipos", () => {
    it("el administrador puede todo; el cajero según su configuración", () => {
        expect(hasPermission({ role: "admin" }, "editSales")).toBe(true);
        expect(hasPermission({ role: "cajero" }, "editSales")).toBe(false);
        expect(hasPermission({ role: "cajero" }, "discounts")).toBe(true);
        expect(hasPermission({ role: "cajero" }, "editSales", { editSales: true })).toBe(true);
        expect(hasPermission(null, "discounts")).toBe(false);
    });
    it("código corto del equipo", () => {
        expect(deviceCode("aB3xY9q2Lm7K")).toBe("LM7K");
    });
});

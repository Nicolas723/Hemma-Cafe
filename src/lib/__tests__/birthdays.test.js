import { describe, expect, it } from "vitest";
import { formatBirthday, parseBirthday, toBirthday, upcomingBirthdays } from "../birthdays";

describe("cumpleaños", () => {
    it("guarda día y mes como MM-DD y rechaza fechas imposibles", () => {
        expect(toBirthday(5, 3)).toBe("03-05");
        expect(toBirthday(29, 2)).toBe("02-29");
        expect(toBirthday(31, 4)).toBe("");
        expect(toBirthday("", 4)).toBe("");
        expect(parseBirthday("11-13")).toEqual({ month: 11, day: 13 });
        expect(formatBirthday("11-13")).toBe("13 de noviembre");
    });

    it("hoy y próximos 7 días, del más cercano al más lejano", () => {
        const today = new Date(2026, 10, 11, 15, 0); // 11 nov
        const customers = [
            { name: "Semana", birthday: "11-18" },
            { name: "Hoy", birthday: "11-11" },
            { name: "Lejos", birthday: "11-19" },
            { name: "Ayer", birthday: "11-10" },
            { name: "Sin dato" },
        ];
        const list = upcomingBirthdays(customers, today);
        expect(list.map((x) => [x.customer.name, x.daysAway])).toEqual([
            ["Hoy", 0],
            ["Semana", 7],
        ]);
    });

    it("funciona al cambiar de año", () => {
        const list = upcomingBirthdays([{ name: "Año nuevo", birthday: "01-02" }], new Date(2026, 11, 30));
        expect(list[0].daysAway).toBe(3);
        expect(list[0].date.getFullYear()).toBe(2027);
    });

    it("el 29 de febrero se recuerda el 28 en años no bisiestos", () => {
        const list = upcomingBirthdays([{ name: "Bisiesto", birthday: "02-29" }], new Date(2027, 1, 25));
        expect(list[0].date.getDate()).toBe(28);
        expect(list[0].daysAway).toBe(3);
    });
});

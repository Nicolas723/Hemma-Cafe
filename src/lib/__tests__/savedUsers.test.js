import { describe, expect, it } from "vitest";
import { addSavedUser, removeSavedUser, resolveSavedUsers } from "../savedUsers";

const users = [
    { id: "a", displayName: "Nicolás", role: "admin" },
    { id: "b", displayName: "Laura", role: "cajero" },
    { id: "c", displayName: "Inactivo", role: "cajero", active: false },
];

describe("usuarios guardados en el equipo", () => {
    it("agrega al inicio y sin duplicar (el más reciente primero)", () => {
        expect(addSavedUser([], "a")).toEqual(["a"]);
        expect(addSavedUser(["a", "b"], "b")).toEqual(["b", "a"]);
        expect(addSavedUser(["a"], "")).toEqual(["a"]);
    });

    it("quita un usuario", () => {
        expect(removeSavedUser(["b", "a"], "b")).toEqual(["a"]);
    });

    it("solo muestra los que existen y están activos, en el orden guardado", () => {
        expect(resolveSavedUsers(["b", "c", "zzz", "a"], users).map((u) => u.id)).toEqual(["b", "a"]);
    });
});

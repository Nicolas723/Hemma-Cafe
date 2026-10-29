import { readJSON, writeJSON } from "./storage";

/**
 * Mesas de ESTE equipo (cada punto de venta puede tener las suyas).
 * El mostrador siempre existe y va primero.
 */
const KEY = "pos_tables_config";
export const COUNTER = { id: "mostrador", label: "Mostrador" };
export const DEFAULT_TABLES = [COUNTER, ...[1, 2, 3, 4].map((n) => ({ id: `mesa${n}`, label: `Mesa ${n}` }))];

export function readTables() {
    const saved = readJSON(KEY, null);
    if (!Array.isArray(saved)) return DEFAULT_TABLES;
    return [COUNTER, ...saved.filter((t) => t && t.id && t.id !== COUNTER.id && t.label)];
}

export function saveTables(list) {
    writeJSON(
        KEY,
        list.filter((t) => t.id !== COUNTER.id).map((t) => ({ id: t.id, label: t.label.trim() || "Mesa" }))
    );
}

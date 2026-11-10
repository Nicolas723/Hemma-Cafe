/**
 * Usuarios guardados en este equipo para el acceso rápido (solo se pide la contraseña).
 * Se guardan únicamente los ids, nunca contraseñas. El más reciente va primero.
 */
export const SAVED_USERS_KEY = "pos_saved_users";

/** Agrega (o sube al primer lugar) un usuario. */
export const addSavedUser = (ids, id) => (id ? [id, ...ids.filter((x) => x !== id)] : ids);

export const removeSavedUser = (ids, id) => ids.filter((x) => x !== id);

/** Usuarios guardados que siguen existiendo y están activos, en el orden guardado. */
export function resolveSavedUsers(ids, users) {
    const byId = new Map(users.map((u) => [u.id, u]));
    return ids.map((id) => byId.get(id)).filter((u) => u && u.active !== false);
}

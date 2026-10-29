/**
 * Permisos del rol «cajero». El administrador siempre puede todo y decide en
 * Ajustes → «Permisos del cajero» cuáles de estos tiene el cajero.
 *
 * Siempre exclusivos del administrador: usuarios, permisos, métodos de pago,
 * registro de actividad, borrar cierres y la zona de mantenimiento.
 */
export const PERMISSIONS = [
    { key: "discounts", label: "Descuentos y cortesías", hint: "Cambiar el total de una venta o darla como cortesía", default: true },
    { key: "cashOut", label: "Registrar salidas de caja", hint: "Sacar efectivo de la caja para pagos o insumos", default: true },
    { key: "closing", label: "Hacer el cierre de caja", hint: "Ver y guardar el cierre del día", default: true },
    { key: "adjustStock", label: "Ajustar stock y registrar llegadas", hint: "Sumar o restar unidades y registrar la mercancía que llega", default: true },
    { key: "manageProducts", label: "Gestionar productos", hint: "Crear, editar, importar y eliminar productos, categorías y promociones", default: false },
    { key: "editSales", label: "Editar o anular ventas", hint: "Cambiar ventas ya cobradas desde el historial", default: false },
    { key: "removeLoanItems", label: "Quitar productos de un crédito", hint: "Borrar lo fiado sin cobrarlo", default: false },
    { key: "manageCustomers", label: "Gestionar clientes y vendedores", hint: "Agregar, cambiar el tipo de precio y eliminar", default: false },
    { key: "viewReports", label: "Ver reportes", hint: "Gráficos de ventas, horas pico y productos más vendidos", default: false },
    { key: "exportData", label: "Descargar reportes en Excel", hint: "Ventas, créditos, cierres e inventario", default: false },
];

export const DEFAULT_CASHIER_PERMS = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.default]));

/** ¿Puede este usuario hacer `perm`? */
export function hasPermission(user, perm, cashierPerms = DEFAULT_CASHIER_PERMS) {
    if (!user) return false;
    if (user.role === "admin") return true;
    return Boolean(cashierPerms[perm] ?? DEFAULT_CASHIER_PERMS[perm]);
}

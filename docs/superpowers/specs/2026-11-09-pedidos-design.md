# Pedidos (domicilios, encargos y preventas) — diseño

Acordado con el dueño el 2026-11-09. Pantalla nueva «Pedidos» en la barra lateral.

## Objetivo
Registrar durante el día pedidos para entregar o recoger en una fecha, sin que cuenten
como venta hasta que se entregan y cobran (o se fían). Lo pedido para hoy queda
**reservado** en inventario: existe, pero está apartado (no vendido).

## Pedido (colección `orders`)
| Campo | Descripción |
|---|---|
| `customerId`, `customerName` | Siempre un cliente registrado; se crea al vuelo solo con nombre si no existe. |
| `phone`, `address` | Opcionales (la dirección solo en domicilios). |
| `kind` | `"delivery"` (domicilio) o `"pickup"` (recoger). |
| `dueDate` | `"YYYY-MM-DD"` en hora local (agrupa la agenda por día). |
| `dueTime` | `"HH:MM"` o `""`. |
| `items` | `[{ id, name, price, cartQuantity, subtotal }]` con el **precio acordado** (incluye tipo de cliente y promos del momento). |
| `deliveryFee` | Valor del domicilio (0 si no aplica). |
| `deposits` | Anticipos `[{ amount, method, date }]`. |
| `notes` | Nota libre. |
| `status` | `pending` → `ready` → `delivered`, o `cancelled`. |
| `createdAt`, `createdBy`, `updatedAt`, `deliveredAt`, `cancelledAt` | Trazabilidad. |

Solo los pedidos abiertos (`pending`/`ready`) se escuchan en vivo; los cerrados se consultan bajo demanda.

## Reservas
- Reservado(producto) = unidades en pedidos abiertos con `dueDate` **hoy o atrasada**. Los de días futuros no reservan.
- Se **calcula**, no se guarda: nunca se descuadra con varios equipos ni sin internet.
- Disponible = stock − reservado (puede ser negativo = «faltan X por preparar»).
- El stock real solo baja al entregar (venta o crédito), como cualquier venta.

## Caja
- Tarjeta del producto: `6 · 🔒4` (disponible · reservado).
- Si agregar una unidad invade lo reservado de pedidos de **otros** clientes: modal de alerta que
  bloquea, con los pedidos afectados; «No vender» es la opción por defecto (Enter/Escape no venden).
  Se avisa una sola vez por mesa y producto.
- «Entregar» carga el pedido en la caja como una mesa más («📦 Cliente») con sus precios acordados
  (sin límite de stock). Se cobra el **saldo** o se fía con el flujo normal.

## Dinero (sin contar doble)
- Anticipo: transacción `type: "anticipo"` (sin productos) el día que se recibe. Cuenta en el cierre de ese día;
  en reportes es ingreso, no venta (igual que los abonos).
- Entrega cobrada: transacción normal con todos los productos (+ línea «Domicilio» sin stock), `total` = lo cobrado ahora
  (total − anticipos), `prepaid` = anticipos, `orderId`.
- Anticipo mayor que el total: se registra una salida de caja «Devolución anticipo» y la venta queda en $0.
- Entrega fiada: el crédito queda por el saldo (subtotales prorrateados), nota con el anticipo descontado.
- Cancelar con anticipo: se devuelve (salida de caja). Saldo a favor: fuera de la v1.

## Pantalla Pedidos
- Fila de días: Atrasados (si hay) · Hoy · próximos días con cantidad · selector de fecha.
- Lista del día por hora (sin hora al final): cliente, tipo, productos, dirección, anticipo, saldo; botones Listo / Entregar.
- Panel «Para preparar»: total por producto del día vs stock, marca faltantes.
- «Ver cerrados»: entregados y cancelados recientes.
- Formulario: cliente (buscar o crear), tipo, fecha/hora, productos, domicilio, anticipo + método, nota.

## Permisos del cajero
- `manageOrders` «Tomar y editar pedidos» (sí por defecto).
- `cancelOrders` «Cancelar pedidos» (no por defecto: puede implicar devolver dinero).

## Casos borde
Precio cambia → se respeta el acordado · recoge una parte → se ajusta en la caja antes de cobrar ·
atrasado → sigue reservando, arriba en rojo · producto borrado → se cobra igual sin descontar stock ·
pedido de algo sin stock → se acepta y aparece en «Para preparar».

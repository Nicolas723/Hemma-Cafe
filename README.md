# ☕ Hemma POS

Punto de venta de **Hemma Café** (café especial + panadería artesanal). Funciona sin internet, sincroniza
solo con Firebase al volver la conexión y se instala como app de escritorio en **Windows 7 de 32 bits**.

## Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| UI | React 18 + CSS propio (tokens en `src/styles/theme.css`) | Liviano, sin frameworks pesados |
| Datos | Firebase Firestore 10 con caché persistente (IndexedDB) | Vende offline y sincroniza solo |
| Escritorio | Electron **22.3.27** | Última versión compatible con Windows 7 / 32 bits — **no subir** |
| Build | Vite 5 con `target: chrome108` | Chromium 108 es el motor de Electron 22 |
| Íconos | lucide-react (SVG) | Windows 7 no muestra emojis a color |

## Estructura

```
src/
├── main.jsx, App.jsx        Arranque, sesión, navegación (Alt+1…7) y copia automática semanal
├── context/
│   ├── AuthProvider.jsx     Usuarios, roles, sesión recordada y demo aislada (ingreso offline)
│   ├── UiProvider.jsx       Avisos, confirmaciones e impresión de recibos
│   └── DataProvider.jsx     Suscripciones en vivo a Firestore + siembra inicial
├── data/actions.js          TODAS las escrituras (cobro, créditos, inventario, cierres…) + registro de actividad
├── data/demoData.js         Datos de muestra de la demo (solo en memoria)
├── lib/                     Utilidades puras: precios, créditos, reportes, copias, actividad, mesas, Excel…
├── components/              Piezas reutilizables (UI base, barra lateral, métodos de pago, recibo)
├── features/                Una carpeta por pantalla
│   ├── auth/  pos/  loans/  history/  closing/  inventory/  reports/  settings/
└── styles/                  theme · base · components · screens · print
electron/                    Proceso principal y preload (impresión, actualizaciones, copias de seguridad)
.github/workflows/pages.yml  Publica la demo pública en GitHub Pages
```

## Comandos

```bash
npm install
npm run dev              # web en http://localhost:5173
npm run electron:dev     # app de escritorio en modo desarrollo
npm run electron:build   # instalador Windows 32 bits → dist_electron/Hemma-POS-Setup-x.y.z.exe
npm run build            # web completa (dist/)
npm run build:demo       # web pública SOLO con la demo (GitHub Pages)
npm test                 # pruebas automáticas (precios, créditos, cierre, reportes, copias…)
```

> En VS Code la variable `ELECTRON_RUN_AS_NODE=1` puede estar definida: bórrala antes de abrir Electron.
> Con Node 22+ el binario de Electron puede quedar incompleto al instalar; si falta `electron.exe`,
> descomprime el zip de `%LOCALAPPDATA%\electron\Cache` en `node_modules/electron/dist` y crea `path.txt` con `electron.exe`.

## Decisiones importantes

- **Stock con `increment()`**: nunca se escribe una cantidad absoluta, así dos equipos o ventas offline no se pisan.
- **Ventas en vivo de los últimos 60 días** (`LIVE_DAYS`): la caja no se vuelve lenta con los meses; el historial
  consulta las ventas antiguas bajo demanda.
- **Lotes de máximo 400 operaciones**: importaciones y borrados grandes ya no fallan.
- **Métodos de pago con ID fijo** al sembrarlos: no se duplican aunque la app arranque sin internet.
- Las órdenes abiertas de cada mesa se guardan en `localStorage` (mismas claves que la versión 1.x).
- **Fechas siempre como Timestamp**: la v1 guardaba los abonos con la fecha en texto. Al abrir la app,
  `migrateStringDates` convierte las que queden (una sola vez cada una), así basta una consulta por rango.

## Inicio de sesión

**Usuario y contraseña**, sin correos. Las contraseñas se guardan como hash PBKDF2 (nunca en texto plano) y se verifican
en el mismo equipo, así que **se puede ingresar sin internet**.

- **Usuario principal** `hemmacafe` (contraseña inicial: la de siempre). Siempre es administrador; se puede cambiar su
  nombre, usuario y contraseña, pero **no se puede eliminar ni desactivar**. La app lo crea sola la primera vez que se
  conecta a internet y avisa en *Ajustes* mientras conserve la contraseña inicial.
- **Recordar en este equipo** (casilla al ingresar, o *Ajustes → Sesión en este equipo*): la app abre **directo en la caja**.
  Sin marcarla, la sesión dura solo mientras la app está abierta. «Salir» siempre olvida la sesión.
  Si alguien cambia la contraseña de ese usuario, la sesión recordada deja de valer.
- Tras 5 intentos fallidos el ingreso se bloquea 30 s.
- **¿Olvidaste tu contraseña?** Otro administrador autoriza el cambio con su contraseña (funciona sin internet).
  Si el olvidado es el principal y no hay otro administrador: en *Firebase Console → Firestore → users* borra el documento
  `principal`; la app lo vuelve a crear con la contraseña inicial.

### Roles

- **Administrador**: puede todo. Solo él gestiona usuarios, permisos, métodos de pago, mesas, ve el registro de actividad, borra cierres y usa la zona de mantenimiento.
- **Cajero**: vende y cobra; lo demás lo decide el administrador en **Ajustes → Permisos del cajero** (se sincroniza a todos los equipos y funciona offline):

  | Permiso | Por defecto |
  |---|---|
  | Aplicar descuentos y cortesías · Hacer el cierre de caja · Ajustar stock y registrar llegadas | Sí |
  | Gestionar productos/categorías/promociones · Editar o anular ventas · Quitar productos de un crédito · Gestionar clientes y vendedores · Ver reportes · Descargar Excel | No |

  Los permisos están en `src/lib/permissions.js` y se consultan con `useAuth().can("permiso")`.

### Aprobación de equipos (protección de los datos)

Cada equipo abre en segundo plano una sesión **anónima** de Firebase y queda registrado en la colección `devices`.
Con las reglas de `firestore.rules` publicadas, **solo los equipos aprobados** pueden leer o guardar datos: una copia del
instalador en otro PC muestra «Equipo pendiente de aprobación · código XXXX» y no ve nada. El administrador aprueba,
renombra o quita equipos en **Ajustes → Equipos** (quitar el acceso sirve si roban o venden un equipo).

Puesta en marcha (en este orden):
1. *Firebase Console → Authentication → Sign-in method* → activa **Anónimo** (sin la limpieza automática).
2. Instala la versión nueva y ábrela **con internet** en cada equipo: mientras las reglas no estén publicadas, cada
   equipo se registra como aprobado solo.
3. Revisa *Ajustes → Equipos* y luego publica `firestore.rules` en *Firestore → Reglas*.
   Desde ese momento, cualquier equipo nuevo necesita la aprobación de un administrador.

> Si publicas las reglas antes de los pasos 1 y 2, los equipos quedarán «pendientes» y habrá que aprobarlos desde
> *Firestore → devices* (campo `status: "approved"`).

## Funciones del día a día

- **Créditos**: abono por productos o **por monto** (se aplica primero a lo más antiguo; lo que no alcanza queda como abono parcial).
- **Cortesía / consumo interno**: botón propio en la caja (total $0, descuenta stock, queda en el registro de actividad).
- **Base de caja y salidas de caja**: en el cierre se escribe el efectivo con que se abrió (se suma) y se registran las
  salidas de efectivo (pagos a proveedores, insumos… se restan). Las salidas también se registran desde la caja (botón «Salida»).
- **Cierre impreso**: al guardar el cierre (o desde los cierres anteriores) se imprime un resumen en la impresora de recibos.
- **Recordatorio por WhatsApp** en Créditos: abre WhatsApp con el detalle de lo que debe el cliente (el celular queda guardado).
- **Costo y ganancia**: el administrador registra el costo de cada producto; Reportes muestra la ganancia estimada y el margen.
- **Qué preparar** (Inventario): según lo vendido ese día de la semana en las últimas 6 semanas, cuánto hornear o pedir.
- **Mesas por equipo**: *Ajustes → Mesas de este equipo* (cada punto de venta tiene las suyas).
- **Llegadas de mercancía**: *Inventario → Llegó mercancía* suma stock y guarda quién la recibió (pestaña *Llegadas*).
- **Reportes** (`features/reports`): ingresos vs periodo anterior, ingresos por día/mes, horas pico, productos más vendidos,
  métodos de pago y vendedores. Gráficos en CSS puro (sin librerías, livianos en Windows 7), con vista de tabla.
- **Registro de actividad** (*Reportes → Actividad*, solo administrador): ediciones/anulaciones de ventas, descuentos,
  cortesías, ajustes de stock, cierres, usuarios y permisos, con quién y cuándo (colección `auditLog`).
- **Copias de seguridad** (*Ajustes → Copia de seguridad*): Excel legible + `.json` completo. La app de escritorio hace una
  automática cada 7 días en *Documentos › Hemma POS › Copias de seguridad* (conserva las 10 últimas).
  **Restaurar copia** (solo administrador): agrega o reemplaza cada registro por el de la copia; no borra lo creado después.
- **Ajustes en mampostería** (`components/Masonry.jsx`): cada tarjeta sigue a la anterior de su columna, sin huecos.
- **Botón «volver arriba»** (`components/ScrollTopButton.jsx`): un solo componente global; aparece sutil en la esquina
  de cualquier elemento con scroll cuando se bajó bastante (no tapa la barra del carrito en el celular).
- **Pantalla de error amigable**: si una sección falla muestra «Reintentar» en vez de quedar en blanco; las secciones
  (salvo la caja) se cargan al abrirlas, para que la app arranque más rápido.

## Modo demo (para posibles compradores)

En la pantalla de ingreso: **«Probar la demo como Administrador / Cajero»**. Dentro, *Ajustes* tiene un botón para cambiar
de rol con un clic.

**La demo jamás toca los datos reales ni guarda nada**: usa otra instancia de Firebase **solo en memoria y con la red
desactivada** (`createDemoDb` en `src/lib/firebase.js`), carga datos de muestra (`src/data/demoData.js`) y no escribe en
`localStorage` (`setEphemeral` en `src/lib/storage.js`). Al salir — o al cerrar la app — se descarta todo y la siguiente
demo empieza limpia.

### Demo pública en GitHub Pages

`npm run build:demo` (usa `.env.demo` → `VITE_DEMO_ONLY=true`) genera una web que **solo** ofrece la demo: no lee la
sesión de Firebase ni los usuarios ni ningún dato real. El workflow `.github/workflows/pages.yml` la publica en cada
push a `main`; en GitHub activa *Settings → Pages → Source: GitHub Actions*. (Reemplaza a Netlify.)

## Tarjetas de productos

Por defecto la caja muestra **tarjetas solo con texto** (nombre, precio, stock y una franja de color por categoría): caben más productos y cargan más rápido en el PC de la caja.
Las fotos se pueden activar por equipo en *Ajustes → Pantalla de este equipo*; con ellas activas, el producto acepta un
enlace a la imagen (ya no se sube a Cloudinary).

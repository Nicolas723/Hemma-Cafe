import { useState } from "react";
import { Settings, Users, Image, Eye, Monitor, UserCircle2, CreditCard, Printer, RefreshCw, AlertTriangle, Plus, X, Download, Rocket, Trash2, Banknote, Smartphone, Landmark, Zap, Coffee, Gift, Coins, Wallet } from "lucide-react";
import { version } from "../../../package.json";
import { useData } from "../../context/DataProvider";
import { useUi, SILENT_PRINT_KEY } from "../../context/UiProvider";
import { ChipGroup, PageHeader, Toggle } from "../../components/ui";
import { PaymentIcon } from "../../lib/paymentIcons";
import { PRICE_TYPES } from "../../lib/pricing";
import { initials } from "../../lib/format";
import { readString, writeString } from "../../lib/storage";
import { useShowPhotos } from "../../lib/hooks";
import { useAuth } from "../../context/AuthProvider";
import UsersCard from "./UsersCard";
import { MyPasswordCard, SessionCard } from "./AccountCard";
import PermissionsCard from "./PermissionsCard";
import BackupCard from "./BackupCard";
import Masonry from "../../components/Masonry";
import TablesCard from "./TablesCard";
import DevicesCard from "./DevicesCard";

const ICON_CHOICES = [
    ["💵", Banknote],
    ["💳", CreditCard],
    ["📱", Smartphone],
    ["🏦", Landmark],
    ["⚡", Zap],
    ["☕", Coffee],
    ["🎁", Gift],
    ["🪙", Coins],
    ["💰", Wallet],
];

const PRICE_OPTIONS = Object.entries(PRICE_TYPES).map(([value, t]) => ({ value, label: t.label }));

function AddInline({ placeholder, onAdd, children }) {
    const [value, setValue] = useState("");
    return (
        <form
            className="inline-form"
            onSubmit={(e) => {
                e.preventDefault();
                if (!value.trim()) return;
                if (onAdd(value.trim()) !== false) setValue("");
            }}
        >
            <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
            {children}
            <button type="submit" className="btn btn--primary" disabled={!value.trim()} aria-label="Agregar">
                <Plus size={18} />
            </button>
        </form>
    );
}

export default function SettingsScreen({ updater }) {
    const { mode, vendedores, customers, paymentMethods, actions } = useData();
    const { showToast, showConfirm } = useUi();
    const { isAdmin, sessionUser, can, switchDemoRole, users } = useAuth();
    const principalDefault = isAdmin && users.some((u) => u.principal && u.defaultPassword);
    const [showPhotos, setShowPhotos] = useShowPhotos();
    const [priceType, setPriceType] = useState("special");
    const [pmEmoji, setPmEmoji] = useState("💵");
    const [silentPrint, setSilentPrint] = useState(() => readString(SILENT_PRINT_KEY) === "true");
    const [busy, setBusy] = useState("");

    const confirmDelete = (label, fn) => showConfirm(`¿Eliminar ${label}?`, { confirmLabel: "Eliminar" }).then((ok) => ok && fn());

    const reset = async (name, label) => {
        const ok = await showConfirm(`¿Seguro? Se borrará TODO el ${label} de la nube. No se puede deshacer.`, { confirmLabel: "Sí, borrar todo" });
        if (!ok) return;
        setBusy(name);
        try {
            const n = await actions.resetCollection(name);
            showToast(`${n} registros eliminados`, "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo borrar (¿hay internet?)", "error");
        } finally {
            setBusy("");
        }
    };

    return (
        <div className="page">
            <PageHeader
                icon={Settings}
                title="Ajustes"
                subtitle={`Hemma POS v${version}${mode === "demo" ? " · modo demo" : ""} · ${sessionUser?.displayName} (${isAdmin ? "administrador" : "cajero"})`}
            />

            {sessionUser?.isGuest && (
                <div className="demo-banner">
                    <Eye size={20} />
                    <div>
                        <b>Estás viendo la demo como {isAdmin ? "administrador" : "cajero"}.</b>
                        <div className="small">
                            {isAdmin ? "Cambia a cajero para ver qué opciones se ocultan." : "Algunas opciones están ocultas según los permisos del cajero."} Nada de lo que hagas en la demo
                            se guarda: todo se borra al salir.
                        </div>
                    </div>
                    <button className="btn btn--primary" onClick={() => switchDemoRole(isAdmin ? "cajero" : "admin")}>
                        Ver como {isAdmin ? "cajero" : "administrador"}
                    </button>
                </div>
            )}

            {principalDefault && (
                <div className="note note--warn">
                    <AlertTriangle size={16} /> El usuario principal todavía usa la contraseña inicial. Cámbiala en «Usuarios y contraseñas» (lápiz junto a él).
                </div>
            )}

            {/* Mampostería: cada tarjeta sigue a la anterior de su columna, sin huecos. */}
            <Masonry className="settings-grid">
                {isAdmin && <UsersCard />}
                {isAdmin && <PermissionsCard />}
                {isAdmin && mode !== "demo" && <DevicesCard />}
                <MyPasswordCard />
                <SessionCard />
                {(isAdmin || can("exportData")) && <BackupCard />}

                <section className="card stack">
                    <h2 className="card-title">
                        <Monitor size={20} /> Pantalla de este equipo
                    </h2>
                    <Toggle icon={Image} label="Mostrar fotos de productos" checked={showPhotos} onChange={setShowPhotos} />
                    <p className="muted small">Apagado, la caja muestra tarjetas solo con nombre, precio y stock: caben más productos y cargan más rápido.</p>
                </section>

                {isAdmin && <TablesCard />}

                {can("manageCustomers") && (
                <>
                <section className="card stack">
                    <h2 className="card-title">
                        <Users size={20} /> Vendedores
                    </h2>
                    <AddInline placeholder="Nombre del vendedor" onAdd={(n) => actions.addVendedor(n)} />
                    <div className="tag-cloud">
                        {vendedores.map((v) => (
                            <span key={v.id} className="tag-item">
                                <span className="avatar avatar--xs">{initials(v.name)}</span>
                                <b>{v.name}</b>
                                <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => confirmDelete(`a ${v.name}`, () => actions.deleteVendedor(v.id))} aria-label={`Eliminar ${v.name}`}>
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                </section>

                <section className="card stack">
                    <h2 className="card-title">
                        <UserCircle2 size={20} /> Clientes frecuentes
                    </h2>
                    <AddInline placeholder="Nombre del cliente" onAdd={(n) => actions.addCustomer(n, priceType)} />
                    <ChipGroup options={PRICE_OPTIONS} value={priceType} onChange={setPriceType} />
                    <div className="list list--scroll">
                        {customers.map((c) => (
                            <div className="list__item" key={c.id}>
                                <span className="avatar avatar--sm">{initials(c.name)}</span>
                                <div className="list__body">
                                    <b>{c.name}</b>
                                    <input
                                        className="input input--inline"
                                        inputMode="tel"
                                        defaultValue={c.phone || ""}
                                        placeholder="Celular (WhatsApp)"
                                        onBlur={(e) => e.target.value.trim() !== (c.phone || "") && actions.updateCustomer(c.id, { phone: e.target.value.trim() })}
                                        aria-label={`Celular de ${c.name}`}
                                    />
                                </div>
                                <select
                                    className={`select select--sm tag--${c.priceType || "special"}`}
                                    value={c.priceType || "special"}
                                    onChange={(e) => actions.updateCustomer(c.id, { priceType: e.target.value })}
                                    title="Tipo de precio"
                                >
                                    {PRICE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                                <button className="icon-btn icon-btn--danger" onClick={() => confirmDelete(`a ${c.name}`, () => actions.deleteCustomer(c.id))} aria-label={`Eliminar ${c.name}`}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {customers.length === 0 && <span className="muted">Aún no hay clientes.</span>}
                    </div>
                </section>
                </>
                )}

                {isAdmin && (
                <section className="card stack">
                    <h2 className="card-title">
                        <CreditCard size={20} /> Métodos de pago
                    </h2>
                    <AddInline placeholder="Nombre (ej: Nequi)" onAdd={(name) => actions.addPaymentMethod({ name, emoji: pmEmoji })} />
                    <div className="icon-picker">
                        {ICON_CHOICES.map(([emoji, Icon]) => (
                            <button key={emoji} type="button" className={`icon-btn ${pmEmoji === emoji ? "is-active" : ""}`} onClick={() => setPmEmoji(emoji)} aria-label="Ícono">
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>
                    <div className="tag-cloud">
                        {paymentMethods.map((pm) => (
                            <span key={pm.id} className="tag-item">
                                <PaymentIcon method={pm} size={16} />
                                <b>{pm.name}</b>
                                <button className="icon-btn icon-btn--danger icon-btn--xs" onClick={() => confirmDelete(`"${pm.name}"`, () => actions.deletePaymentMethod(pm.id))} aria-label={`Eliminar ${pm.name}`}>
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                </section>
                )}

                {updater.available && (
                    <section className="card stack">
                        <h2 className="card-title">
                            <Printer size={20} /> Impresión
                        </h2>
                        <Toggle
                            icon={Printer}
                            label="Imprimir directo (sin ventana)"
                            checked={silentPrint}
                            onChange={(v) => {
                                setSilentPrint(v);
                                writeString(SILENT_PRINT_KEY, v ? "true" : "false");
                            }}
                        />
                        <p className="muted small">Usa la impresora predeterminada de Windows. Ahorra un clic en cada recibo.</p>
                    </section>
                )}

                {updater.available && (
                    <section className="card stack">
                        <h2 className="card-title">
                            <Rocket size={20} /> Actualizaciones
                        </h2>
                        <div className="update-box">
                            <div>
                                <b>Versión instalada {version}</b>
                                <div className="muted small">
                                    {
                                        {
                                            idle: "Se revisa automáticamente al abrir la app.",
                                            checking: "Buscando…",
                                            "not-available": "Tienes la última versión.",
                                            available: `Nueva versión disponible: ${updater.version}`,
                                            downloading: `Descargando… ${Math.round(updater.progress)}%`,
                                            downloaded: "Lista para instalar.",
                                            error: "No se pudo conectar con el servidor de actualizaciones.",
                                        }[updater.status]
                                    }
                                </div>
                                {updater.status === "downloading" && (
                                    <div className="progress">
                                        <span style={{ width: `${updater.progress}%` }} />
                                    </div>
                                )}
                            </div>
                            {updater.status === "available" ? (
                                <button className="btn btn--primary" onClick={updater.download}>
                                    <Download size={18} /> Descargar
                                </button>
                            ) : updater.status === "downloaded" ? (
                                <button className="btn btn--primary" onClick={updater.install}>
                                    <Rocket size={18} /> Reiniciar e instalar
                                </button>
                            ) : (
                                <button className="btn btn--ghost" onClick={updater.check} disabled={updater.status === "checking" || updater.status === "downloading"}>
                                    <RefreshCw size={18} className={updater.status === "checking" ? "spin" : ""} /> Buscar
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {isAdmin && (
                <section className="card stack card--danger">
                    <h2 className="card-title">
                        <AlertTriangle size={20} /> Zona de mantenimiento
                    </h2>
                    <p className="muted small">Acciones permanentes sobre los datos en la nube. Úsalas solo para reiniciar registros.</p>
                    <button className="btn btn--danger-ghost" disabled={Boolean(busy)} onClick={() => reset("transactions", "historial de ventas")}>
                        <Trash2 size={18} /> {busy === "transactions" ? "Borrando…" : "Borrar historial de ventas"}
                    </button>
                    <button className="btn btn--danger-ghost" disabled={Boolean(busy)} onClick={() => reset("dailyPerformance", "historial de cierres")}>
                        <Trash2 size={18} /> {busy === "dailyPerformance" ? "Borrando…" : "Borrar historial de cierres"}
                    </button>
                </section>
                )}
            </Masonry>
        </div>
    );
}

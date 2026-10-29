import { ShoppingCart, Wallet, Receipt, Calculator, Package, Settings, BarChart3, LogOut, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { initials } from "../lib/format";

export const SCREENS = [
    { id: "pos", label: "Caja", icon: ShoppingCart },
    { id: "loans", label: "Créditos", icon: Wallet },
    { id: "history", label: "Ventas", icon: Receipt },
    { id: "closing", label: "Cierre", icon: Calculator, perm: "closing" },
    { id: "inventory", label: "Inventario", icon: Package },
    { id: "reports", label: "Reportes", icon: BarChart3, perm: "viewReports" },
    { id: "settings", label: "Ajustes", icon: Settings },
];

export default function Sidebar({ screens = SCREENS, active, onChange, badges = {}, isOnline, pendingSync, isDemo, user, onLogout }) {
    return (
        <nav className="sidebar" aria-label="Secciones">
            <div className="sidebar__brand">
                <img src="logo.png" alt="Hemma" />
                {isDemo && <span className="sidebar__demo">DEMO</span>}
            </div>

            <div className="sidebar__items">
                {screens.map(({ id, label, icon: Icon }, i) => (
                    <button
                        key={id}
                        className={`sidebar__item ${active === id ? "is-active" : ""}`}
                        onClick={() => onChange(id)}
                        title={`${label} (Alt+${i + 1})`}
                    >
                        <span className="sidebar__icon">
                            <Icon size={24} />
                            {badges[id] ? <span className="sidebar__badge">{badges[id]}</span> : null}
                        </span>
                        <span className="sidebar__label">{label}</span>
                    </button>
                ))}
            </div>

            <div className="sidebar__footer">
                <div
                    className={`net ${isOnline ? (pendingSync ? "net--sync" : "net--on") : "net--off"}`}
                    title={
                        isOnline
                            ? pendingSync
                                ? "Enviando cambios al servidor..."
                                : "Conectado y sincronizado"
                            : "Sin internet: se sigue vendiendo y se sincroniza al volver la conexión"
                    }
                >
                    {isOnline ? pendingSync ? <RefreshCw size={18} className="spin" /> : <Wifi size={18} /> : <WifiOff size={18} />}
                    <span>{isOnline ? (pendingSync ? "Sincronizando" : "En línea") : "Sin conexión"}</span>
                </div>
                <button className="sidebar__item sidebar__logout" onClick={onLogout} title={user ? `${user.displayName} · cerrar sesión` : "Cerrar sesión"}>
                    <span className="sidebar__icon">
                        {user ? <span className="sidebar__user">{initials(user.displayName)}</span> : <LogOut size={22} />}
                    </span>
                    <span className="sidebar__label">{isDemo ? "Salir demo" : "Salir"}</span>
                </button>
            </div>
        </nav>
    );
}

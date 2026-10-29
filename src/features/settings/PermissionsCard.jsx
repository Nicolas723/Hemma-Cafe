import { ShieldCheck, ShieldHalf, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthProvider";
import { PERMISSIONS } from "../../lib/permissions";

/** Solo administradores: qué puede hacer el rol «cajero». */
export default function PermissionsCard() {
    const { cashierPerms, setCashierPerm } = useAuth();
    return (
        <section className="card stack">
            <h2 className="card-title">
                <ShieldHalf size={20} /> Permisos del cajero
            </h2>
            <p className="muted small">El administrador puede todo. Toca cada permiso para dárselo o quitárselo al cajero; el cambio llega a todos los equipos.</p>
            <div className="perm-list">
                {PERMISSIONS.map((p) => {
                    const on = Boolean(cashierPerms[p.key]);
                    return (
                        <button key={p.key} type="button" className={`perm ${on ? "is-on" : ""}`} onClick={() => setCashierPerm(p.key, !on)} aria-pressed={on}>
                            <span className="perm__icon">{on ? <Check size={16} /> : <X size={16} />}</span>
                            <span className="perm__text">
                                <b>{p.label}</b>
                                <span>{p.hint}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
            <p className="muted small perm__fixed">
                <ShieldCheck size={14} /> Siempre solo del administrador: usuarios, permisos, métodos de pago, registro de actividad, borrar cierres y mantenimiento.
            </p>
        </section>
    );
}

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { MonitorSmartphone, Check, Trash2 } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthProvider";
import { useUi } from "../../context/UiProvider";
import { DEVICES_COLLECTION } from "../../lib/devices";
import { formatDateTime, toDate } from "../../lib/format";

/** Solo administradores: equipos con acceso a los datos. Aprobar, renombrar o quitar. */
export default function DevicesCard() {
    const { deviceId, approveDevice, renameDevice, removeDevice } = useAuth();
    const { showConfirm, showToast } = useUi();
    const [devices, setDevices] = useState(null);

    useEffect(
        () =>
            onSnapshot(
                collection(db, DEVICES_COLLECTION),
                (snap) =>
                    setDevices(
                        snap.docs
                            .map((d) => ({ id: d.id, ...d.data() }))
                            .sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) || (toDate(b.lastSeen || b.createdAt) - toDate(a.lastSeen || a.createdAt)))
                    ),
                (err) => {
                    console.warn(err);
                    setDevices([]);
                }
            ),
        []
    );

    const remove = async (d) => {
        if (d.id === deviceId) return showToast("No puedes quitarle el acceso a este mismo equipo", "warning");
        const ok = await showConfirm(`¿Quitarle el acceso a «${d.name}» (${d.code})? Dejará de ver los datos hasta que lo vuelvas a aprobar.`, { confirmLabel: "Quitar acceso" });
        if (ok) removeDevice(d.id, d.name);
    };

    const pending = (devices || []).filter((d) => d.status === "pending").length;

    return (
        <section className="card stack">
            <h2 className="card-title">
                <MonitorSmartphone size={20} /> Equipos {pending > 0 && <span className="tag tag--warn">{pending} por aprobar</span>}
            </h2>
            <p className="muted small">Solo los equipos aprobados pueden ver y guardar datos. Si te roban o vendes un equipo, quítale el acceso aquí.</p>
            {!deviceId && <div className="note">Este equipo no tiene sesión de Firebase: activa el inicio «Anónimo» en Firebase (ver README) para usar la aprobación de equipos.</div>}
            <div className="list">
                {(devices || []).map((d) => (
                    <div className={`list__item device ${d.status === "pending" ? "is-pending" : ""}`} key={d.id}>
                        <span className="device__code">{d.code}</span>
                        <div className="list__body">
                            <input
                                className="input input--inline"
                                defaultValue={d.name}
                                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== d.name && renameDevice(d.id, e.target.value)}
                                aria-label="Nombre del equipo"
                            />
                            <span className="muted small">
                                {d.id === deviceId ? "Este equipo · " : ""}
                                {d.status === "pending" ? `Pidió acceso ${d.createdAt ? formatDateTime(toDate(d.createdAt)) : ""}` : d.lastSeen ? `Última conexión ${formatDateTime(toDate(d.lastSeen))}` : "Aprobado"}
                            </span>
                        </div>
                        {d.status === "pending" ? (
                            <button className="btn btn--primary btn--sm" onClick={() => approveDevice(d.id, d.name)}>
                                <Check size={16} /> Aprobar
                            </button>
                        ) : (
                            <span className="tag tag--general">Aprobado</span>
                        )}
                        {d.id !== deviceId && (
                            <button className="icon-btn icon-btn--danger" onClick={() => remove(d)} aria-label={`Quitar acceso a ${d.name}`}>
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                ))}
                {devices && devices.length === 0 && <span className="muted small">Aún no hay equipos registrados.</span>}
            </div>
        </section>
    );
}

import { useState } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthProvider";
import { Field, Modal } from "../../components/ui";
import { normalizeUsername, passwordProblem } from "../../lib/passwords";
import { PasswordField } from "./AuthScreens";

/**
 * Recuperar contraseña: otro administrador autoriza el cambio con su propia
 * contraseña. Funciona sin internet.
 */
export default function ForgotPassword({ initialUsername, onClose }) {
    const { activeUsers, users, recoverWithAdmin } = useAuth();
    const admins = users.filter((u) => u.role === "admin" && u.active !== false);

    const initial = activeUsers.find((u) => u.username === normalizeUsername(initialUsername || ""));
    const [targetId, setTargetId] = useState(initial?.id || "");
    const otherAdmins = admins.filter((a) => a.id !== targetId);
    const [adminId, setAdminId] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const effectiveAdmin = otherAdmins.some((a) => a.id === adminId) ? adminId : otherAdmins[0]?.id || "";

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!targetId) return setError("Elige el usuario");
        const problem = passwordProblem(newPassword, confirm);
        if (problem) return setError(problem);
        setBusy(true);
        const res = await recoverWithAdmin({ adminId: effectiveAdmin, adminPassword, targetId, newPassword });
        setBusy(false);
        if (res.error) setError(res.error);
        else setDone(true);
    };

    if (done) {
        const name = users.find((u) => u.id === targetId)?.displayName;
        return (
            <Modal title="Contraseña actualizada" icon={CheckCircle2} onClose={onClose} size="sm" footer={<button className="btn btn--primary btn--lg" onClick={onClose}>Ingresar</button>}>
                <p className="confirm__msg">{name} ya puede ingresar con su nueva contraseña.</p>
            </Modal>
        );
    }

    return (
        <Modal title="Recuperar contraseña" icon={KeyRound} onClose={onClose} size="md">
            <form className="stack" onSubmit={submit}>
                <Field label="¿Qué usuario olvidó la contraseña?">
                    <select className="select" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                        <option value="">Seleccionar…</option>
                        {activeUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.displayName} (@{u.username})
                            </option>
                        ))}
                    </select>
                </Field>

                {targetId && otherAdmins.length === 0 ? (
                    <div className="note">
                        No hay otro administrador que autorice el cambio. Pide soporte: el usuario principal se restablece desde Firebase (ver README).
                    </div>
                ) : (
                    <>
                        <div className="form-grid">
                            <Field label="Administrador que autoriza">
                                <select className="select" value={effectiveAdmin} onChange={(e) => setAdminId(e.target.value)}>
                                    {otherAdmins.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.displayName}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Su contraseña">
                                <PasswordField value={adminPassword} onChange={setAdminPassword} placeholder="Contraseña del administrador" />
                            </Field>
                        </div>
                        <div className="form-grid">
                            <Field label="Nueva contraseña">
                                <PasswordField value={newPassword} onChange={setNewPassword} placeholder="Nueva contraseña" autoComplete="new-password" />
                            </Field>
                            <Field label="Repítela">
                                <PasswordField value={confirm} onChange={setConfirm} placeholder="Repite la nueva" autoComplete="new-password" />
                            </Field>
                        </div>
                        <p className="muted small">Funciona sin internet.</p>
                    </>
                )}

                {error && <div className="login__error">{error}</div>}

                <div className="modal__actions">
                    <button type="button" className="btn btn--ghost btn--lg" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn--primary btn--lg" disabled={busy || !targetId || !otherAdmins.length || !adminPassword || !newPassword}>
                        <KeyRound size={18} /> Cambiar contraseña
                    </button>
                </div>
            </form>
        </Modal>
    );
}

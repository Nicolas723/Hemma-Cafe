import { useState } from "react";
import { ShieldCheck, UserPlus, Pencil, Trash2, Save, KeyRound, Crown } from "lucide-react";
import { useAuth } from "../../context/AuthProvider";
import { useUi } from "../../context/UiProvider";
import { ChipGroup, Field, Modal, Toggle } from "../../components/ui";
import { PasswordField } from "../auth/AuthScreens";
import { ROLES, passwordProblem } from "../../lib/passwords";
import { initials } from "../../lib/format";

const ROLE_OPTIONS = Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label }));

/** Crear o editar un usuario del personal. user=null → nuevo. */
function UserForm({ user, onClose }) {
    const { createUser, updateUser, setUserPassword, sessionUser } = useAuth();
    const { showToast } = useUi();
    const isNew = !user;
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [username, setUsername] = useState(user?.username || "");
    const [role, setRole] = useState(user?.role || "cajero");
    const [active, setActive] = useState(user ? user.active !== false : true);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (isNew || password) {
            const problem = passwordProblem(password, confirm);
            if (problem) return setError(problem);
        }
        const res = isNew
            ? await createUser({ displayName, username: username || displayName, password, role })
            : await updateUser(user.id, { displayName, username, role, active });
        if (res.error) return setError(res.error);
        if (!isNew && password) {
            const r2 = await setUserPassword(user.id, password);
            if (r2.error) return setError(r2.error);
        }
        showToast(isNew ? `Usuario ${displayName} creado` : "Usuario actualizado", "success");
        onClose();
    };

    return (
        <Modal title={isNew ? "Nuevo usuario" : `Editar a ${user.displayName}`} icon={isNew ? UserPlus : Pencil} onClose={onClose} size="md">
            <form className="stack" onSubmit={submit}>
                <div className="form-grid">
                    <Field label="Nombre">
                        <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ej: Laura Gómez" autoFocus />
                    </Field>
                    <Field label="Usuario" hint="Con este nombre ingresa (sin espacios)">
                        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ej: laura" />
                    </Field>
                </div>
                {user?.principal ? (
                    <div className="note">
                        <Crown size={15} /> Usuario principal: siempre es administrador y no se puede eliminar ni desactivar. Puedes cambiar su nombre, usuario y contraseña.
                    </div>
                ) : (
                    <Field label="Rol" hint={ROLES[role]?.hint}>
                        <ChipGroup options={ROLE_OPTIONS} value={role} onChange={setRole} />
                    </Field>
                )}
                {!isNew && !user.principal && user.id !== sessionUser?.id && <Toggle label="Usuario activo (puede ingresar)" checked={active} onChange={setActive} />}
                <Field label={isNew ? "Contraseña" : "Nueva contraseña (opcional)"}>
                    <div className="form-grid">
                        <PasswordField value={password} onChange={setPassword} placeholder={isNew ? "Contraseña" : "Dejar vacío para no cambiar"} autoComplete="new-password" />
                        <PasswordField value={confirm} onChange={setConfirm} placeholder="Repite la contraseña" autoComplete="new-password" />
                    </div>
                </Field>
                {error && <div className="login__error">{error}</div>}
                <div className="modal__actions">
                    <button type="button" className="btn btn--ghost btn--lg" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn--primary btn--lg">
                        <Save size={18} /> {isNew ? "Crear usuario" : "Guardar"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default function UsersCard() {
    const { users, deleteUser, sessionUser, mode } = useAuth();
    const { showToast, showConfirm } = useUi();
    const [editing, setEditing] = useState(null); // null | "new" | user

    const remove = async (u) => {
        const ok = await showConfirm(`¿Eliminar el usuario de ${u.displayName}? Ya no podrá ingresar.`, { confirmLabel: "Eliminar" });
        if (!ok) return;
        const res = await deleteUser(u.id);
        showToast(res.error || `Usuario ${u.displayName} eliminado`, res.error ? "error" : "success");
    };

    return (
        <section className="card stack">
            <div className="section-head" style={{ margin: 0 }}>
                <h2 className="card-title">
                    <ShieldCheck size={20} /> Usuarios y contraseñas
                </h2>
                <button className="btn btn--primary btn--sm" onClick={() => setEditing("new")}>
                    <UserPlus size={16} /> Nuevo
                </button>
            </div>
            <div className="list list--scroll">
                {users.map((u) => (
                    <div className={`list__item ${u.active === false ? "is-inactive" : ""}`} key={u.id}>
                        <span className="avatar avatar--sm">{initials(u.displayName)}</span>
                        <div className="list__body">
                            <b>
                                {u.displayName} {u.id === sessionUser?.id && <span className="muted small">(tú)</span>}
                            </b>
                            <span className="muted small">
                                @{u.username}
                                {u.active === false && " · desactivado"}
                            </span>
                        </div>
                        {u.principal ? (
                            <span className="tag tag--wholesale">
                                <Crown size={12} /> Principal
                            </span>
                        ) : (
                            <span className={`tag ${u.role === "admin" ? "tag--wholesale" : "tag--general"}`}>{ROLES[u.role]?.label || u.role}</span>
                        )}
                        <button className="icon-btn" title="Editar / cambiar contraseña" onClick={() => setEditing(u)}>
                            <Pencil size={16} />
                        </button>
                        {u.id !== sessionUser?.id && !u.principal && (
                            <button className="icon-btn icon-btn--danger" title="Eliminar" onClick={() => remove(u)}>
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                ))}
                {users.length === 0 && <span className="muted">{mode === "demo" ? "Crea usuarios de prueba aquí: se borran al salir de la demo." : "Sin usuarios."}</span>}
            </div>
            <p className="muted small">
                <KeyRound size={13} /> Las contraseñas se guardan cifradas. Si alguien olvida la suya, un administrador puede cambiarla aquí o desde «¿Olvidaste tu contraseña?» al ingresar.
            </p>
            {editing && <UserForm user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        </section>
    );
}

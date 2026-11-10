import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, UserPlus, Repeat, Loader2, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthProvider";
import { useUi } from "../context/UiProvider";
import { PasswordField, roleLabel } from "../features/auth/AuthScreens";
import { initials } from "../lib/format";
import { Modal } from "./ui";

/**
 * Menú del botón de salir: cambiar de usuario (sin cerrar la sesión hasta que la
 * contraseña sea correcta), ingresar con otro usuario o cerrar sesión.
 */
export default function UserMenu({ user, isDemo, onLogout, onClose }) {
    const { savedUsers, switchUser, logout } = useAuth();
    const { showToast } = useUi();
    const [switching, setSwitching] = useState(null);
    const ref = useRef(null);
    const others = savedUsers.filter((u) => u.id !== user?.id);

    useEffect(() => {
        const onDown = (e) => !switching && ref.current && !ref.current.contains(e.target) && !e.target.closest(".sidebar__logout") && onClose();
        const onKey = (e) => e.key === "Escape" && !switching && onClose();
        document.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [onClose, switching]);

    const pick = async (u) => {
        // En la demo los invitados no tienen contraseña: el cambio es directo.
        if (isDemo) {
            await switchUser(u.id);
            showToast(`Ahora estás como ${u.displayName}`, "success");
            return onClose();
        }
        setSwitching(u);
    };

    return (
        <>
            <div className="user-menu" ref={ref} role="menu">
                {user && (
                    <div className="user-menu__me">
                        <span className={`saved-user__avatar ${user.role === "admin" ? "is-admin" : ""}`}>{initials(user.displayName)}</span>
                        <span>
                            <b>{user.displayName}</b>
                            <small>{roleLabel(user.role)}</small>
                        </span>
                    </div>
                )}
                {others.length > 0 && <div className="user-menu__label">Cambiar a</div>}
                {others.map((u) => (
                    <button key={u.id} type="button" role="menuitem" className="user-menu__item" onClick={() => pick(u)}>
                        <span className={`saved-user__avatar saved-user__avatar--sm ${u.role === "admin" ? "is-admin" : ""}`}>{initials(u.displayName)}</span>
                        <span className="user-menu__name">
                            {u.displayName}
                            <small>{roleLabel(u.role)}</small>
                        </span>
                        <Repeat size={15} className="muted" />
                    </button>
                ))}
                {!isDemo && (
                    <button
                        type="button"
                        role="menuitem"
                        className="user-menu__item"
                        onClick={() => {
                            onClose();
                            logout({ other: true });
                        }}
                    >
                        <span className="user-menu__icon">
                            <UserPlus size={16} />
                        </span>
                        <span className="user-menu__name">Otro usuario</span>
                    </button>
                )}
                <div className="user-menu__sep" />
                <button
                    type="button"
                    role="menuitem"
                    className="user-menu__item user-menu__item--danger"
                    onClick={() => {
                        onClose();
                        onLogout();
                    }}
                >
                    <span className="user-menu__icon">
                        <LogOut size={16} />
                    </span>
                    <span className="user-menu__name">{isDemo ? "Salir de la demo" : "Cerrar sesión"}</span>
                </button>
            </div>
            {/* Fuera de la barra lateral (si no, hereda su letra blanca). */}
            {switching &&
                createPortal(
                <SwitchUserModal
                    target={switching}
                    onCancel={() => setSwitching(null)}
                    onSubmit={async (password) => {
                        const res = await switchUser(switching.id, password);
                        if (res.ok) {
                            showToast(`Turno de ${switching.displayName}`, "success");
                            setSwitching(null);
                            onClose();
                        }
                        return res;
                    }}
                />,
                document.body
            )}
        </>
    );
}

/** Pide solo la contraseña del usuario al que se cambia; si se cancela, sigue la sesión actual. */
function SwitchUserModal({ target, onCancel, onSubmit }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const passRef = useRef(null);

    const submit = async (e) => {
        e.preventDefault();
        if (!password) return;
        setBusy(true);
        const res = await onSubmit(password);
        setBusy(false);
        if (res?.error) {
            setError(res.error);
            setPassword("");
            passRef.current?.focus();
        }
    };

    return (
        <Modal title={`Cambiar a ${target.displayName}`} icon={Repeat} onClose={onCancel} size="sm">
            <form onSubmit={submit} className="login__form switch-user">
                <div className="login__picked">
                    <span className={`saved-user__avatar ${target.role === "admin" ? "is-admin" : ""}`}>{initials(target.displayName)}</span>
                    <span>
                        <b>{target.displayName}</b>
                        <small>{roleLabel(target.role)}</small>
                    </span>
                </div>
                <PasswordField value={password} onChange={setPassword} inputRef={passRef} autoFocus />
                {error && <div className="login__error">{error}</div>}
                <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy || !password}>
                    {busy ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />} Cambiar de usuario
                </button>
                <p className="muted small">Las mesas y órdenes abiertas se mantienen.</p>
            </form>
        </Modal>
    );
}

import { useRef, useState } from "react";
import { LogIn, Lock, Eye, EyeOff, KeyRound, Sparkles, WifiOff, ShieldCheck, Loader2, User, Check, X, ArrowLeft, UserPlus } from "lucide-react";
import { initials } from "../../lib/format";
import { useAuth, LAST_USERNAME_KEY } from "../../context/AuthProvider";
import { useOnlineStatus } from "../../lib/hooks";
import { readString } from "../../lib/storage";
import ForgotPassword from "./ForgotPassword";

export function AuthLayout({ title, subtitle, children, footer }) {
    const online = useOnlineStatus();
    return (
        <div className="login">
            <div className="login__panel">
                <img src="logo.png" alt="Hemma Café" className="login__logo" />
                <h1>{title}</h1>
                {subtitle && <p className="login__sub">{subtitle}</p>}
                {!online && (
                    <div className="login__offline">
                        <WifiOff size={16} /> Sin internet
                    </div>
                )}
                {children}
                {footer && <div className="login__footer">{footer}</div>}
            </div>
        </div>
    );
}

export function PasswordField({ value, onChange, placeholder = "Contraseña", autoFocus, inputRef, autoComplete = "current-password" }) {
    const [show, setShow] = useState(false);
    return (
        <label className="login__field">
            <Lock size={18} />
            <input
                ref={inputRef}
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                autoComplete={autoComplete}
            />
            <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </label>
    );
}

const ErrorMsg = ({ children }) => (children ? <div className="login__error">{children}</div> : null);

/** Entrada a la demo eligiendo el rol. La demo vive en memoria y se borra al salir. */
function DemoLink() {
    const { enterDemo } = useAuth();
    return (
        <div className="demo-entry">
            <span>
                <Sparkles size={15} /> Probar la demo como
            </span>
            <button type="button" className="link-btn" onClick={() => enterDemo("admin")}>
                <ShieldCheck size={15} /> Administrador
            </button>
            <button type="button" className="link-btn" onClick={() => enterDemo("cajero")}>
                <User size={15} /> Cajero
            </button>
        </div>
    );
}

export function Splash({ text = "Cargando…" }) {
    return (
        <div className="login">
            <div className="splash">
                <img src="logo.png" alt="" />
                <span>
                    <Loader2 size={18} className="spin" /> {text}
                </span>
            </div>
        </div>
    );
}

/** Equipo nuevo sin internet: aún no tiene los usuarios descargados. */
export function NeedInternet() {
    return (
        <AuthLayout
            title="Falta la configuración inicial"
            subtitle="Este equipo aún no ha descargado los usuarios. Conéctalo a internet una vez; después funcionará sin conexión."
            footer={<DemoLink />}
        >
            <button className="btn btn--primary btn--xl btn--block" onClick={() => window.location.reload()}>
                Reintentar
            </button>
        </AuthLayout>
    );
}

export const roleLabel = (role) => (role === "admin" ? "Administrador" : "Cajero");

/** Tarjetas de los usuarios guardados en este equipo: tocar una pide solo la contraseña. */
function SavedUserPicker({ users, onPick, onForget, onOther }) {
    return (
        <div className="saved-users">
            <div className="saved-users__title">¿Quién ingresa?</div>
            <div className="saved-users__grid">
                {users.map((u) => (
                    <div key={u.id} className="saved-user">
                        <button type="button" className="saved-user__main" onClick={() => onPick(u)}>
                            <span className={`saved-user__avatar ${u.role === "admin" ? "is-admin" : ""}`}>{initials(u.displayName)}</span>
                            <b>{u.displayName}</b>
                            <span className="muted small">{roleLabel(u.role)}</span>
                        </button>
                        <button type="button" className="saved-user__forget" onClick={() => onForget(u)} title="Quitar de este equipo" aria-label={`Quitar a ${u.displayName} de este equipo`}>
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
            <button type="button" className="btn btn--ghost btn--block" onClick={onOther}>
                <UserPlus size={18} /> Otro usuario
            </button>
        </div>
    );
}

/** Ingreso con usuario y contraseña. «Recordar» abre directo en la caja la próxima vez. */
export function StaffLogin() {
    const { login, rememberDefault, savedUsers, forgetSavedUser, loginHint, clearLoginHint } = useAuth();
    // Con usuarios guardados se muestran las tarjetas; «Otro usuario» abre el formulario completo.
    const [showForm, setShowForm] = useState(() => loginHint === "other" || savedUsers.length === 0);
    const [picked, setPicked] = useState(null);
    const [username, setUsername] = useState(() => (loginHint === "other" ? "" : readString(LAST_USERNAME_KEY)));
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(rememberDefault);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [forgot, setForgot] = useState(false);
    const passRef = useRef(null);

    const submit = async (e) => {
        e.preventDefault();
        const uname = picked ? picked.username : username;
        if (!uname.trim() || !password) return;
        setBusy(true);
        const res = await login(uname, password, remember);
        if (res.ok) clearLoginHint();
        setBusy(false);
        if (res.error) {
            setError(res.error);
            setPassword("");
            passRef.current?.focus();
        }
    };

    const footer = (
        <>
            <button type="button" className="link-btn" onClick={() => setForgot(true)}>
                <KeyRound size={15} /> ¿Olvidaste tu contraseña?
            </button>
            <DemoLink />
        </>
    );

    const pickUser = (u) => {
        setPicked(u);
        setPassword("");
        setError("");
    };
    const back = () => {
        setPicked(null);
        setPassword("");
        setError("");
        if (savedUsers.length) setShowForm(false);
    };

    if (!picked && !showForm && savedUsers.length > 0) {
        return (
            <AuthLayout title="Bienvenido" subtitle="Toca tu usuario e ingresa tu contraseña" footer={footer}>
                <SavedUserPicker
                    users={savedUsers}
                    onPick={pickUser}
                    onForget={(u) => forgetSavedUser(u.id)}
                    onOther={() => {
                        setUsername("");
                        setShowForm(true);
                    }}
                />
                {forgot && <ForgotPassword initialUsername="" onClose={() => setForgot(false)} />}
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title={picked ? `Hola, ${picked.displayName.split(" ")[0]}` : "Bienvenido"} subtitle={picked ? "Ingresa tu contraseña" : "Ingresa con tu usuario y contraseña"} footer={footer}>
            <form onSubmit={submit} className="login__form">
                {picked ? (
                    <div className="login__picked">
                        <span className={`saved-user__avatar ${picked.role === "admin" ? "is-admin" : ""}`}>{initials(picked.displayName)}</span>
                        <span>
                            <b>{picked.displayName}</b>
                            <small>{roleLabel(picked.role)}</small>
                        </span>
                    </div>
                ) : (
                    <label className="login__field">
                        <User size={18} />
                        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" autoComplete="username" autoFocus={!username} autoCapitalize="none" />
                    </label>
                )}
                <PasswordField key={picked?.id || "form"} value={password} onChange={setPassword} inputRef={passRef} autoFocus={Boolean(picked || username)} />
                <button type="button" className={`check ${remember ? "is-on" : ""}`} onClick={() => setRemember((v) => !v)} aria-pressed={remember}>
                    <span className="check__box">{remember && <Check size={14} />}</span>
                    <span>
                        Recordar en este equipo
                        <small>Abre directo en la caja, sin pedir la contraseña</small>
                    </span>
                </button>
                <ErrorMsg>{error}</ErrorMsg>
                <button type="submit" className="btn btn--primary btn--xl btn--block" disabled={busy || !(picked || username.trim()) || !password}>
                    {busy ? <Loader2 size={20} className="spin" /> : <LogIn size={20} />} Ingresar
                </button>
                {(picked || savedUsers.length > 0) && (
                    <button type="button" className="btn btn--ghost btn--block" onClick={back}>
                        <ArrowLeft size={18} /> {picked ? "Otro usuario guardado" : "Volver a los usuarios guardados"}
                    </button>
                )}
            </form>
            {forgot && <ForgotPassword initialUsername={picked?.username || username} onClose={() => setForgot(false)} />}
        </AuthLayout>
    );
}

/** Portada de la demo pública (GitHub Pages): solo deja probar la demo. */
export function DemoLanding() {
    const { enterDemo } = useAuth();
    return (
        <AuthLayout title="Hemma POS" subtitle="Punto de venta para cafeterías y panaderías: rápido, táctil y funciona sin internet.">
            <div className="demo-landing">
                <p className="muted small">Prueba la demo con datos de muestra. Nada de lo que hagas se guarda: todo se borra al salir.</p>
                <button className="btn btn--primary btn--xl btn--block" onClick={() => enterDemo("admin")}>
                    <ShieldCheck size={20} /> Entrar como administrador
                </button>
                <button className="btn btn--soft btn--xl btn--block" onClick={() => enterDemo("cajero")}>
                    <User size={20} /> Entrar como cajero
                </button>
                <ul className="demo-landing__features">
                    <li>
                        <Check size={15} /> Caja con mesas, descuentos, cortesías y pago dividido
                    </li>
                    <li>
                        <Check size={15} /> Créditos con abonos por producto o por monto
                    </li>
                    <li>
                        <Check size={15} /> Cierre de caja, inventario, reportes y roles
                    </li>
                </ul>
            </div>
        </AuthLayout>
    );
}

/** Equipo sin aprobar: la base de datos lo rechaza hasta que un administrador lo apruebe. */
export function DevicePending() {
    const { deviceId, deviceCode } = useAuth();
    return (
        <AuthLayout title="Equipo pendiente de aprobación" subtitle="Por seguridad, solo los equipos aprobados pueden ver los datos del negocio." footer={<DemoLink />}>
            {deviceId ? (
                <>
                    <div className="device-code" aria-label="Código del equipo">
                        {deviceCode}
                    </div>
                    <p className="muted small">
                        Pide a un administrador que, desde un equipo ya aprobado, vaya a <b>Ajustes → Equipos</b> y apruebe el código <b>{deviceCode}</b>. Esta pantalla se
                        abrirá sola cuando lo apruebe.
                    </p>
                    <div className="login__offline">
                        <Loader2 size={16} className="spin" /> Esperando aprobación…
                    </div>
                </>
            ) : (
                <p className="muted small">
                    No se pudo iniciar la sesión del equipo. Revisa que haya internet y que en Firebase esté activado el inicio <b>Anónimo</b> (ver README).
                </p>
            )}
        </AuthLayout>
    );
}

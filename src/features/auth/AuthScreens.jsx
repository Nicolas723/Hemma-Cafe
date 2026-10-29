import { useRef, useState } from "react";
import { LogIn, Lock, Eye, EyeOff, KeyRound, Sparkles, WifiOff, ShieldCheck, Loader2, User, Check } from "lucide-react";
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

/** Ingreso con usuario y contraseña. «Recordar» abre directo en la caja la próxima vez. */
export function StaffLogin() {
    const { login, rememberDefault } = useAuth();
    const [username, setUsername] = useState(() => readString(LAST_USERNAME_KEY));
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(rememberDefault);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [forgot, setForgot] = useState(false);
    const passRef = useRef(null);

    const submit = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password) return;
        setBusy(true);
        const res = await login(username, password, remember);
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

    return (
        <AuthLayout title="Bienvenido" subtitle="Ingresa con tu usuario y contraseña" footer={footer}>
            <form onSubmit={submit} className="login__form">
                <label className="login__field">
                    <User size={18} />
                    <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" autoComplete="username" autoFocus={!username} autoCapitalize="none" />
                </label>
                <PasswordField value={password} onChange={setPassword} inputRef={passRef} autoFocus={Boolean(username)} />
                <button type="button" className={`check ${remember ? "is-on" : ""}`} onClick={() => setRemember((v) => !v)} aria-pressed={remember}>
                    <span className="check__box">{remember && <Check size={14} />}</span>
                    <span>
                        Recordar en este equipo
                        <small>Abre directo en la caja, sin pedir la contraseña</small>
                    </span>
                </button>
                <ErrorMsg>{error}</ErrorMsg>
                <button type="submit" className="btn btn--primary btn--xl btn--block" disabled={busy || !username.trim() || !password}>
                    {busy ? <Loader2 size={20} className="spin" /> : <LogIn size={20} />} Ingresar
                </button>
            </form>
            {forgot && <ForgotPassword initialUsername={username} onClose={() => setForgot(false)} />}
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

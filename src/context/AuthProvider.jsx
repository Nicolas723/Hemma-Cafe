import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { DEVICES_COLLECTION, deviceInfo } from "../lib/devices";
import { auth, db, createDemoDb, destroyDemoDb } from "../lib/firebase";
import { hashPassword, normalizeUsername, passwordProblem, verifyPassword } from "../lib/passwords";
import {
    purgeDemoLeftovers,
    readJSON,
    readSessionJSON,
    readString,
    setEphemeral,
    writeJSON,
    writeSessionJSON,
    writeString,
} from "../lib/storage";
import { DEFAULT_CASHIER_PERMS, PERMISSIONS, hasPermission } from "../lib/permissions";
import { logAudit } from "../lib/audit";
import { DEMO_ONLY } from "../lib/env";

/**
 * Acceso con USUARIO y CONTRASEÑA (sin correos):
 *  - Usuarios del personal en la colección `users`, con contraseña en hash.
 *    La verificación es local, así que se puede ingresar sin internet.
 *  - El usuario PRINCIPAL (el de siempre, «hemmacafe») existe siempre: se puede
 *    modificar pero no eliminar, desactivar ni quitarle el rol de administrador.
 *  - «Recordar en este equipo»: la sesión queda guardada y la app abre directo en
 *    la caja. Sin marcar, la sesión dura solo mientras la app está abierta.
 *  - La DEMO usa otra base de datos solo en memoria y sin red: nada se guarda ni
 *    se mezcla con los datos reales, y todo se descarta al salir.
 */
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/** Invitados de la demo: uno por rol, para mostrar la diferencia entre administrador y cajero. */
export const DEMO_GUESTS = {
    admin: { id: "__demo_admin", displayName: "Admin demo", username: "demo", role: "admin", active: true, isGuest: true },
    cajero: { id: "__demo_cajero", displayName: "Cajero demo", username: "cajero", role: "cajero", active: true, isGuest: true },
};

export const PRINCIPAL_ID = "principal";
/** Usuario principal inicial. La contraseña inicial es la de siempre (Hemmacafe2026), guardada solo como hash. */
const PRINCIPAL_SEED = {
    displayName: "Hemma Café",
    username: "hemmacafe",
    role: "admin",
    active: true,
    principal: true,
    defaultPassword: true,
    passwordHash: "gbXBMu8gluD+F6ajrGryCTY3w83HpBAsfr4uAV1hiQ8=",
    salt: "VOeiGzdqlqHSgnI6hNSBew==",
    iterations: 100000,
};

const LOCK_KEY = "pos_login_lock";
const MAX_ATTEMPTS = 5;
const SESSION_KEY = "pos_session";
const REMEMBER_KEY = "pos_remember";
export const LAST_USERNAME_KEY = "pos_last_username";
const USERS_CACHE_KEY = "pos_users_cache";
const PERMS_CACHE_KEY = "pos_cashier_perms";

// Marca de la contraseña con la que se abrió la sesión: si la cambian en otro
// equipo, la sesión recordada deja de valer y se vuelve a pedir.
const stampOf = (user) => (user?.passwordHash || "").slice(0, 12);

function readSavedSession() {
    return readJSON(SESSION_KEY, null) || readSessionJSON(SESSION_KEY, null);
}

// Limpia credenciales en texto plano de la versión 1.x y claves de versiones anteriores.
function purgeLegacy() {
    ["pos_saved_password", "pos_saved_username", "pos_remember_password", "pos_authenticated_production", "pos_authenticated_demo", "pos_session_production", "pos_users_cache_production", "pos_cashier_perms_production", "pos_last_user_production"].forEach((k) =>
        writeString(k, "")
    );
    purgeDemoLeftovers();
}

export function AuthProvider({ children }) {
    const [mode, setMode] = useState("production"); // la demo nunca se recuerda
    const [demoDb, setDemoDb] = useState(null);
    const [fbUser, setFbUser] = useState(undefined); // undefined = cargando
    const [usersState, setUsersState] = useState({ users: [], ready: false, fromServer: false });
    const [session, setSession] = useState(() => {
        purgeLegacy();
        return readSavedSession();
    });
    const [demoSessionId, setDemoSessionId] = useState("");
    const modeRef = useRef(mode);
    modeRef.current = mode;

    // Firebase Auth anónimo y silencioso: permite proteger la base con reglas
    // (`request.auth != null`) sin pedirle nada al usuario. Si falla, se sigue.
    useEffect(
        () =>
            // La build pública de demo no toca la cuenta real de Firebase.
            DEMO_ONLY
                ? setFbUser(null)
                : onAuthStateChanged(auth, (u) => {
                setFbUser(u || null);
                if (!u) signInAnonymously(auth).catch((err) => console.warn("Sesión anónima no disponible:", err?.code));
            }),
        []
    );

    const activeDb = mode === "demo" ? demoDb : db;
    const isDemo = mode === "demo";
    const canRead = isDemo ? Boolean(demoDb) : !DEMO_ONLY && fbUser !== undefined;

    // ───────────── Aprobación de este equipo (ver lib/devices.js) ─────────────
    const uid = !isDemo && !DEMO_ONLY ? fbUser?.uid || null : null;
    const [device, setDevice] = useState({ loaded: false, data: null });
    const [blocked, setBlocked] = useState(false); // la base rechazó la lectura: equipo sin aprobar
    const deviceRef = useRef(device);
    deviceRef.current = device;
    const deviceTouched = useRef(false);
    useEffect(() => {
        setDevice({ loaded: false, data: null });
        deviceTouched.current = false;
        if (!uid) return undefined;
        return onSnapshot(
            doc(db, DEVICES_COLLECTION, uid),
            (snap) => setDevice({ loaded: true, data: snap.exists() ? snap.data() : null }),
            (err) => {
                console.warn("No se pudo leer el estado del equipo:", err?.code);
                setDevice({ loaded: true, data: null });
            }
        );
    }, [uid]);
    const deviceApproved = device.data?.status === "approved";

    // Rechazado y sin solicitud: se crea la solicitud para que un administrador la apruebe.
    useEffect(() => {
        if (blocked && uid && device.loaded && !device.data) {
            setDoc(doc(db, DEVICES_COLLECTION, uid), { ...deviceInfo(uid), status: "pending", createdAt: new Date() }).catch((err) =>
                console.error("No se pudo solicitar la aprobación del equipo:", err)
            );
        }
    }, [blocked, uid, device]);

    /** Con un usuario real en sesión y acceso confirmado por el servidor: registra el equipo como aprobado (si falta) y su última conexión. */
    const touchDevice = () => {
        if (!uid || deviceTouched.current || !deviceRef.current.loaded) return;
        deviceTouched.current = true;
        const data = deviceRef.current.data;
        const ref = doc(db, DEVICES_COLLECTION, uid);
        const write =
            data?.status === "approved"
                ? updateDoc(ref, { lastSeen: new Date() })
                : setDoc(ref, { ...deviceInfo(uid), ...(data || {}), status: "approved", approvedBy: "Automático (antes de activar la protección)", approvedAt: new Date(), lastSeen: new Date(), createdAt: data?.createdAt || new Date() }, { merge: true });
        write.catch((err) => console.warn("No se pudo registrar el equipo:", err?.code));
    };

    // Usuarios en vivo (+ copia local de respaldo para ingresar sin internet).
    const principalSeeded = useRef(false);
    useEffect(() => {
        if (!canRead) {
            setUsersState({ users: [], ready: false, fromServer: false });
            return undefined;
        }
        const cached = isDemo ? [] : readJSON(USERS_CACHE_KEY, []);
        setUsersState({ users: cached, ready: isDemo, fromServer: false });
        // Si Firestore no responde (sin internet y sin caché), se usa la copia local.
        const fallback = setTimeout(() => setUsersState((s) => (s.ready ? s : { ...s, ready: true })), 3000);
        const unsub = onSnapshot(
            collection(activeDb, "users"),
            { includeMetadataChanges: true }, // para enterarse cuando el servidor confirma (fromCache → false)
            (snap) => {
                // Se ignoran documentos incompletos (sin usuario o nombre).
                const users = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.username && u.displayName);
                const fromServer = !snap.metadata.fromCache;
                if (!isDemo && (users.length || fromServer)) writeJSON(USERS_CACHE_KEY, users);
                if (!isDemo) setBlocked(false);
                // El servidor confirma que no existe el principal → se crea (una sola vez).
                if (!isDemo && fromServer && !principalSeeded.current && !users.some((u) => u.id === PRINCIPAL_ID)) {
                    principalSeeded.current = true;
                    setDoc(doc(db, "users", PRINCIPAL_ID), { ...PRINCIPAL_SEED, createdAt: new Date(), updatedAt: new Date() }).catch((err) =>
                        console.error("No se pudo crear el usuario principal:", err)
                    );
                }
                setUsersState({ users: users.length || fromServer ? users : cached, ready: true, fromServer });
            },
            (err) => {
                console.error("No se pudieron leer los usuarios:", err);
                if (!isDemo && err?.code === "permission-denied") setBlocked(true);
                setUsersState({ users: cached, ready: true, fromServer: false });
            }
        );
        return () => {
            clearTimeout(fallback);
            unsub();
        };
        // deviceApproved: al aprobarse el equipo se vuelve a suscribir.
    }, [canRead, activeDb, isDemo, fbUser?.uid, deviceApproved, device.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // Permisos del cajero (doc config/roles + copia local).
    const [cashierPerms, setCashierPerms] = useState(() => readJSON(PERMS_CACHE_KEY, DEFAULT_CASHIER_PERMS));
    useEffect(() => {
        setCashierPerms(isDemo ? DEFAULT_CASHIER_PERMS : readJSON(PERMS_CACHE_KEY, DEFAULT_CASHIER_PERMS));
        if (!canRead) return undefined;
        return onSnapshot(
            doc(activeDb, "config", "roles"),
            (snap) => {
                if (!snap.exists()) return;
                const perms = { ...DEFAULT_CASHIER_PERMS, ...snap.data().cashier };
                if (!isDemo) writeJSON(PERMS_CACHE_KEY, perms);
                setCashierPerms(perms);
            },
            (err) => console.error("No se pudieron leer los permisos:", err)
        );
    }, [canRead, activeDb, isDemo, fbUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

    // El equipo se registra (aprobado automáticamente mientras las reglas no estén publicadas)
    // solo cuando alguien ingresa con un usuario real: abrir la pantalla de ingreso o la demo no cuenta.
    const realSessionId = !isDemo && session ? session.id : null;
    useEffect(() => {
        if (realSessionId && usersState.fromServer && device.loaded) touchDevice();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [realSessionId, usersState.fromServer, device.loaded]);

    const users = useMemo(
        () =>
            [...usersState.users].sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0) || (a.displayName || "").localeCompare(b.displayName || "", "es")),
        [usersState.users]
    );
    const activeAdmins = users.filter((u) => u.role === "admin" && u.active !== false);

    const sessionUser = useMemo(() => {
        if (isDemo) {
            const guest = Object.values(DEMO_GUESTS).find((g) => g.id === demoSessionId);
            if (guest) return guest;
            const u = users.find((x) => x.id === demoSessionId);
            return u && u.active !== false ? u : null;
        }
        if (!session) return null;
        const u = users.find((x) => x.id === session.id);
        return u && u.active !== false && stampOf(u) === session.stamp ? u : null;
    }, [isDemo, demoSessionId, session, users]);

    const remembered = !isDemo && Boolean(readJSON(SESSION_KEY, null));

    const startSession = (user, remember) => {
        if (modeRef.current === "demo") {
            setDemoSessionId(user.id);
            return;
        }
        const s = { id: user.id, stamp: stampOf(user) };
        if (remember) writeJSON(SESSION_KEY, s);
        else writeString(SESSION_KEY, "");
        writeSessionJSON(SESSION_KEY, remember ? null : s);
        writeString(REMEMBER_KEY, remember ? "true" : "false");
        writeString(LAST_USERNAME_KEY, user.username);
        setSession(s);
    };

    const clearSession = () => {
        writeString(SESSION_KEY, "");
        writeSessionJSON(SESSION_KEY, null);
        setSession(null);
    };

    // ───────────── Bloqueo por intentos fallidos ─────────────
    const lockInfo = () => readJSON(LOCK_KEY, { count: 0, until: 0 });
    const registerFailure = () => {
        const l = lockInfo();
        const count = l.count + 1;
        const until = count >= MAX_ATTEMPTS ? Date.now() + 30000 * Math.pow(2, Math.floor(count / MAX_ATTEMPTS) - 1) : 0;
        writeJSON(LOCK_KEY, { count, until });
        return until;
    };
    const lockedFor = () => Math.max(0, Math.ceil((lockInfo().until - Date.now()) / 1000));

    const usersRef = (id) => doc(collection(activeDb, "users"), id);
    const create = (id, data) => setDoc(usersRef(id), data).catch((err) => console.error("No se pudo crear el usuario:", err));
    // updateDoc (no setDoc+merge): si el usuario fue eliminado en otro equipo no se "revive" a medias.
    const save = (id, data) => updateDoc(usersRef(id), data).catch((err) => console.error("No se pudo guardar el usuario:", err));

    const audit = (action, detail, by = sessionUser) => logAudit(activeDb, by, "users", action, detail);

    // ───────────── API pública ─────────────
    const api = {
        mode,
        isDemo,
        demoDb,
        fbUser,
        users,
        activeUsers: users.filter((u) => u.active !== false),
        usersReady: usersState.ready,
        usersFromServer: usersState.fromServer,
        sessionUser,
        isAdmin: sessionUser?.role === "admin",
        // Equipo: uid de la sesión anónima, su código y si la base lo rechaza (pendiente de aprobación).
        deviceId: uid,
        deviceCode: device.data?.code || (uid ? deviceInfo(uid).code : ""),
        deviceBlocked: blocked && !isDemo,
        approveDevice(id, name) {
            updateDoc(doc(db, DEVICES_COLLECTION, id), { status: "approved", approvedBy: sessionUser?.displayName || "", approvedAt: new Date() }).catch((err) =>
                console.error(err)
            );
            audit("Aprobó un equipo", name || id);
        },
        renameDevice(id, name) {
            updateDoc(doc(db, DEVICES_COLLECTION, id), { name: name.trim() || "Equipo" }).catch((err) => console.error(err));
        },
        removeDevice(id, name) {
            deleteDoc(doc(db, DEVICES_COLLECTION, id)).catch((err) => console.error(err));
            audit("Quitó el acceso a un equipo", name || id);
        },
        remembered,
        rememberDefault: readString(REMEMBER_KEY) === "true",
        lockedFor,
        cashierPerms,
        /** ¿El usuario en sesión puede hacer `perm`? (ver lib/permissions.js) */
        can: (perm) => hasPermission(sessionUser, perm, cashierPerms),
        setCashierPerm(key, value) {
            const next = { ...cashierPerms, [key]: value };
            setCashierPerms(next);
            if (!isDemo) writeJSON(PERMS_CACHE_KEY, next);
            setDoc(doc(activeDb, "config", "roles"), { cashier: next, updatedAt: new Date() }, { merge: true }).catch((err) =>
                console.error("No se pudieron guardar los permisos:", err)
            );
            audit(value ? "Dio un permiso al cajero" : "Quitó un permiso al cajero", PERMISSIONS.find((p) => p.key === key)?.label || key);
        },

        /** Ingreso con usuario y contraseña (funciona sin internet). */
        async login(username, password, remember) {
            const wait = lockedFor();
            if (wait > 0) return { error: `Demasiados intentos. Espera ${wait} s.` };
            const uname = normalizeUsername(username);
            const user = users.find((u) => u.username === uname);
            if (!user || user.active === false || !(await verifyPassword(password, user))) {
                const until = registerFailure();
                return { error: until ? "Demasiados intentos fallidos. Espera 30 s." : "Usuario o contraseña incorrectos" };
            }
            writeJSON(LOCK_KEY, { count: 0, until: 0 });
            startSession(user, remember);
            audit("Ingresó", remember ? "Con «Recordar en este equipo»" : "", user);
            return { ok: true };
        },

        logout() {
            if (modeRef.current === "demo") setDemoSessionId("");
            else clearSession();
        },

        /** Activar o quitar «Recordar en este equipo» para la sesión actual. */
        setRemember(on) {
            if (sessionUser && !isDemo) startSession(sessionUser, on);
        },

        // ── Demo (aislada, solo en memoria) ──
        async enterDemo(role = "admin") {
            setEphemeral(true); // nada de la demo toca localStorage
            const guest = DEMO_GUESTS[role] || DEMO_GUESTS.admin;
            const newDb = await createDemoDb();
            setDemoSessionId(guest.id);
            setDemoDb(newDb);
            setMode("demo");
        },
        /** En la demo: cambiar entre administrador y cajero con un clic. */
        switchDemoRole(role) {
            const guest = DEMO_GUESTS[role];
            if (modeRef.current === "demo" && guest) setDemoSessionId(guest.id);
        },
        /** Sale de la demo y la destruye: no queda ningún dato. */
        async exitDemo() {
            const old = demoDb;
            setMode("production");
            setDemoDb(null);
            setDemoSessionId("");
            setEphemeral(false);
            setSession(readSavedSession());
            await destroyDemoDb(old);
        },

        // ── Gestión de usuarios ──
        async createUser({ displayName, username, password, role }) {
            const uname = normalizeUsername(username);
            if (!displayName?.trim()) return { error: "Escribe el nombre" };
            if (!uname) return { error: "Escribe un usuario válido (letras y números)" };
            if (users.some((u) => u.username === uname)) return { error: `El usuario «${uname}» ya existe` };
            const problem = passwordProblem(password);
            if (problem) return { error: problem };
            const ref = doc(collection(activeDb, "users"));
            create(ref.id, {
                displayName: displayName.trim(),
                username: uname,
                role: role === "admin" ? "admin" : "cajero",
                active: true,
                ...(await hashPassword(password)),
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            audit("Creó un usuario", `${displayName.trim()} (@${uname}) · ${role === "admin" ? "administrador" : "cajero"}`);
            return { ok: true, id: ref.id };
        },

        async updateUser(id, { displayName, username, role, active }) {
            const user = users.find((u) => u.id === id);
            if (!user) return { error: "Usuario no encontrado" };
            const uname = normalizeUsername(username ?? user.username);
            if (!uname) return { error: "Usuario no válido" };
            if (users.some((u) => u.id !== id && u.username === uname)) return { error: `El usuario «${uname}» ya existe` };
            const nextRole = user.principal ? "admin" : role ?? user.role;
            const nextActive = user.principal ? true : active ?? user.active !== false;
            if (user.role === "admin" && !(nextRole === "admin" && nextActive) && activeAdmins.length <= 1) return { error: "Debe quedar al menos un administrador activo" };
            if (id === sessionUser?.id && !nextActive) return { error: "No puedes desactivar tu propio usuario" };
            save(id, { displayName: (displayName ?? user.displayName).trim(), username: uname, role: nextRole, active: nextActive, updatedAt: new Date() });
            const changes = [];
            if (nextRole !== user.role) changes.push(`rol: ${nextRole}`);
            if (nextActive !== (user.active !== false)) changes.push(nextActive ? "activado" : "desactivado");
            if (uname !== user.username) changes.push(`usuario: @${uname}`);
            if (changes.length) audit("Modificó un usuario", `${user.displayName} · ${changes.join(", ")}`);
            if (id === sessionUser?.id && !isDemo) writeString(LAST_USERNAME_KEY, uname);
            return { ok: true };
        },

        async setUserPassword(id, password, by = sessionUser) {
            if (!users.some((u) => u.id === id)) return { error: "Usuario no encontrado" };
            const problem = passwordProblem(password);
            if (problem) return { error: problem };
            const hashed = await hashPassword(password);
            save(id, { ...hashed, defaultPassword: false, updatedAt: new Date() });
            const target = users.find((u) => u.id === id);
            audit(id === by?.id ? "Cambió su contraseña" : by === sessionUser ? "Cambió la contraseña de un usuario" : "Recuperó la contraseña de un usuario", target?.displayName || "", by);
            // Si es la propia sesión, se renueva la marca para no sacar al usuario.
            if (!isDemo && session?.id === id) startSession({ id, username: sessionUser?.username, passwordHash: hashed.passwordHash }, remembered);
            return { ok: true };
        },

        async deleteUser(id) {
            const user = users.find((u) => u.id === id);
            if (!user) return { error: "Usuario no encontrado" };
            if (user.principal) return { error: "El usuario principal no se puede eliminar" };
            if (id === sessionUser?.id) return { error: "No puedes eliminar tu propio usuario" };
            if (user.role === "admin" && user.active !== false && activeAdmins.length <= 1) return { error: "Debe quedar al menos un administrador" };
            deleteDoc(usersRef(id)).catch((err) => console.error(err));
            audit("Eliminó un usuario", `${user.displayName} (@${user.username})`);
            return { ok: true };
        },

        async changeOwnPassword(current, next) {
            if (!sessionUser || sessionUser.isGuest) return { error: "No disponible para el invitado de la demo" };
            if (!(await verifyPassword(current, sessionUser))) return { error: "La contraseña actual no es correcta" };
            return api.setUserPassword(sessionUser.id, next);
        },

        // ── Recuperación ──
        /** Un administrador autoriza con su contraseña (funciona sin internet). */
        async recoverWithAdmin({ adminId, adminPassword, targetId, newPassword }) {
            const wait = lockedFor();
            if (wait > 0) return { error: `Demasiados intentos. Espera ${wait} s.` };
            const admin = activeAdmins.find((a) => a.id === adminId);
            if (!admin) return { error: "Elige un administrador" };
            if (!(await verifyPassword(adminPassword, admin))) {
                registerFailure();
                return { error: "La contraseña del administrador no es correcta" };
            }
            return api.setUserPassword(targetId, newPassword, admin);
        },
    };

    return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

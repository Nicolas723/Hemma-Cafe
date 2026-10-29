import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import Sidebar, { SCREENS } from "./components/Sidebar";
import { DemoLanding, DevicePending, NeedInternet, Splash, StaffLogin } from "./features/auth/AuthScreens";
import { DEMO_ONLY } from "./lib/env";
import PosScreen from "./features/pos/PosScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// La caja carga al instante; el resto de secciones se descarga al abrirlas
// (arranque más rápido en el PC con Windows 7).
const LoansScreen = lazy(() => import("./features/loans/LoansScreen"));
const HistoryScreen = lazy(() => import("./features/history/HistoryScreen"));
const ClosingScreen = lazy(() => import("./features/closing/ClosingScreen"));
const InventoryScreen = lazy(() => import("./features/inventory/InventoryScreen"));
const SettingsScreen = lazy(() => import("./features/settings/SettingsScreen"));
const ReportsScreen = lazy(() => import("./features/reports/ReportsScreen"));
import { AuthProvider, useAuth } from "./context/AuthProvider";
import { DataProvider, useData } from "./context/DataProvider";
import { useOnlineStatus, useUpdater } from "./lib/hooks";
import { db } from "./lib/firebase";
import { backupIsDue, runBackup } from "./lib/backup";
import { useUi } from "./context/UiProvider";
import { LOW_STOCK } from "./lib/inventory";

export default function App() {
    return (
        <ErrorBoundary full>
            <AuthProvider>
                <Gate />
            </AuthProvider>
        </ErrorBoundary>
    );
}

/** Decide qué pantalla de acceso mostrar antes de abrir la caja. */
function Gate() {
    const auth = useAuth();

    // Demo: base aparte en memoria (sin red). Se destruye al salir.
    if (auth.isDemo) {
        if (!auth.demoDb || !auth.sessionUser) return <Splash text="Abriendo demo…" />;
        return (
            <DataProvider db={auth.demoDb} mode="demo" key={auth.demoDb.app.name}>
                <Shell />
            </DataProvider>
        );
    }

    if (DEMO_ONLY) return <DemoLanding />;
    // Equipo sin aprobar (o con el acceso quitado): no muestra nada del negocio.
    if (auth.deviceBlocked) return <DevicePending />;
    if (!auth.usersReady) return <Splash text="Cargando usuarios…" />;
    if (auth.users.length === 0) return auth.usersFromServer ? <Splash text="Preparando el usuario principal…" /> : <NeedInternet />;
    // Con «Recordar en este equipo» hay sesión guardada y se entra directo a la caja.
    if (!auth.sessionUser) return <StaffLogin />;

    return (
        <DataProvider db={db} mode="production" key={`production-${auth.fbUser?.uid || "anon"}`}>
            <Shell />
        </DataProvider>
    );
}

function Shell() {
    const auth = useAuth();
    const [screen, setScreen] = useState("pos");
    const [historyRange, setHistoryRange] = useState(null);
    const isOnline = useOnlineStatus();
    const updater = useUpdater();
    const { pendingSync, loans, products, col } = useData();
    const { showToast } = useUi();

    // Copia de seguridad automática semanal (solo app de escritorio, con internet).
    useEffect(() => {
        if (auth.isDemo || !window.electron?.saveBackup) return undefined;
        const t = setTimeout(() => {
            if (!navigator.onLine || !backupIsDue()) return;
            runBackup(col)
                .then(() => showToast("Copia de seguridad semanal guardada en Documentos", "success", { label: "Abrir carpeta", onClick: () => window.electron.openBackups() }))
                .catch((err) => console.error("Copia automática fallida:", err));
        }, 60000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Secciones visibles según el rol (el cierre de caja es un permiso del cajero).
    const screens = useMemo(() => SCREENS.filter((s) => !s.perm || auth.can(s.perm)), [auth.sessionUser, auth.cashierPerms]); // eslint-disable-line react-hooks/exhaustive-deps
    const current = screens.some((s) => s.id === screen) ? screen : "pos";

    // Atajos: Alt+1..7 cambian de sección.
    useEffect(() => {
        const onKey = (e) => {
            if (!e.altKey) return;
            const idx = parseInt(e.key, 10) - 1;
            if (screens[idx]) {
                e.preventDefault();
                setScreen(screens[idx].id);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [screens]);

    const badges = useMemo(
        () => ({
            loans: new Set(loans.map((l) => l.customerId)).size || null,
            inventory: products.filter((p) => !p.isPriceFlexible && (p.quantity || 0) <= LOW_STOCK).length || null,
            settings: auth.isAdmin && (updater.status === "available" || updater.status === "downloaded") ? "!" : null,
        }),
        [loans, products, updater.status, auth.isAdmin]
    );

    const openHistory = (date) => {
        setHistoryRange([new Date(date), new Date(date)]);
        setScreen("history");
    };

    return (
        <div className="app">
            <Sidebar
                screens={screens}
                active={current}
                onChange={setScreen}
                badges={badges}
                isOnline={isOnline}
                pendingSync={pendingSync}
                isDemo={auth.isDemo}
                user={auth.sessionUser}
                onLogout={auth.isDemo ? auth.exitDemo : auth.logout}
            />
            <main className={`main ${current === "pos" ? "main--pos" : ""}`}>
                <ErrorBoundary resetKey={current}>
                <Suspense fallback={<div className="screen-loading"><Loader2 size={28} className="spin" /></div>}>
                {current === "pos" && <PosScreen />}
                {current === "loans" && <LoansScreen />}
                {current === "history" && <HistoryScreen initialRange={historyRange} onConsumeRange={() => setHistoryRange(null)} />}
                {current === "closing" && <ClosingScreen onViewSales={openHistory} />}
                {current === "inventory" && <InventoryScreen />}
                {current === "reports" && <ReportsScreen />}
                {current === "settings" && <SettingsScreen updater={updater} />}
                </Suspense>
                </ErrorBoundary>
            </main>
        </div>
    );
}

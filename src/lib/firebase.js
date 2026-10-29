import { initializeApp, deleteApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from "firebase/auth";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    memoryLocalCache,
    disableNetwork,
    terminate,
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDJBkF3vodLd6emQyvSX4IGY-27Ji7G1z8",
    authDomain: "hemmacafe-b02f8.firebaseapp.com",
    projectId: "hemmacafe-b02f8",
    storageBucket: "hemmacafe-b02f8.firebasestorage.app",
    messagingSenderId: "241934891527",
    appId: "1:241934891527:web:c24b35358386ffceb9c8a2",
    measurementId: "G-GX1KENBGDM",
};

const app = initializeApp(firebaseConfig);

// Caché persistente en IndexedDB: la caja sigue vendiendo sin internet y
// sincroniza sola cuando vuelve la conexión.
function createDb() {
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
    } catch (err) {
        console.warn("Persistencia offline no disponible, usando memoria:", err);
        return initializeFirestore(app, { localCache: memoryLocalCache() });
    }
}

export const db = createDb();

// Sesión del equipo guardada en IndexedDB: sigue activa sin internet.
// Sin popupRedirectResolver (no se usa y en Electron/file:// genera errores).
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });

/**
 * Base de datos de la DEMO: otra instancia de Firebase, solo en memoria y con la
 * red desactivada ANTES de cualquier lectura o escritura. Nada sale del equipo
 * ni se mezcla con los datos reales; al salir de la demo se destruye.
 */
let demoSeq = 0;
export async function createDemoDb() {
    const demoApp = initializeApp(firebaseConfig, `demo-${Date.now()}-${demoSeq++}`);
    const demoDb = initializeFirestore(demoApp, { localCache: memoryLocalCache() });
    await disableNetwork(demoDb);
    return demoDb;
}

export async function destroyDemoDb(demoDb) {
    if (!demoDb) return;
    try {
        await terminate(demoDb);
        await deleteApp(demoDb.app);
    } catch (err) {
        console.warn("No se pudo cerrar la demo:", err);
    }
}

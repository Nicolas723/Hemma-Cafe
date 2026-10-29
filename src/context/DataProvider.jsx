import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, where, Timestamp } from "firebase/firestore";
import { createActions, normalizeTransaction } from "../data/actions";
import { buildDemoDataset } from "../data/demoData";
import { CATEGORY_COLORS, NO_CATEGORY_COLOR } from "../lib/format";
import { DEFAULT_PAYMENT_METHODS } from "../lib/paymentIcons";
import { addDays, startOfDay } from "../lib/dates";
import { useUi } from "./UiProvider";
import { useAuth } from "./AuthProvider";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

/**
 * Días de ventas que se mantienen sincronizadas en vivo. Antes se descargaba
 * TODO el historial, y la caja se volvía más lenta cada mes. Las ventas más
 * antiguas se consultan bajo demanda desde el historial.
 */
export const LIVE_DAYS = 60;

const withId = (d) => ({ id: d.id, ...d.data() });
const withDate = (d) => {
    const data = d.data();
    return { id: d.id, ...data, date: data.date?.toDate ? data.date.toDate().toISOString() : data.date };
};

/** Suscripción a una consulta con estado de caché y escrituras pendientes. */
function useLiveQuery(makeQuery, mapDoc, deps) {
    const [state, setState] = useState({ docs: [], fromCache: true, pending: false, ready: false });
    useEffect(() => {
        let first = true;
        const unsub = onSnapshot(
            makeQuery(),
            { includeMetadataChanges: true },
            (snap) => {
                const meta = { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites, ready: true };
                // Cambios solo de metadatos: no remapear los documentos (ahorra renders).
                if (!first && snap.docChanges().length === 0) {
                    setState((s) => (s.fromCache === meta.fromCache && s.pending === meta.pending ? s : { ...s, ...meta }));
                    return;
                }
                first = false;
                setState({ docs: snap.docs.map(mapDoc), ...meta });
            },
            (err) => console.error("Error de suscripción:", err)
        );
        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return state;
}

/**
 * `db` es la base real (Firestore con caché offline) o, en la demo, una base
 * aparte solo en memoria y sin red (ver lib/firebase.js → createDemoDb).
 */
export function DataProvider({ db, mode, children }) {
    const { showToast } = useUi();
    const { sessionUser } = useAuth();
    const userRef = useRef(sessionUser);
    userRef.current = sessionUser;
    const col = useMemo(() => (name) => collection(db, name), [db]);
    const cutoff = useMemo(() => startOfDay(addDays(new Date(), -LIVE_DAYS)), [mode]);

    const products = useLiveQuery(() => col("products"), withId, [col]);
    const categories = useLiveQuery(() => col("categories"), withId, [col]);
    const customers = useLiveQuery(() => col("customers"), withId, [col]);
    const promotions = useLiveQuery(() => col("promotions"), withId, [col]);
    const vendedores = useLiveQuery(() => col("vendedores"), withId, [col]);
    const loans = useLiveQuery(() => col("loans"), withId, [col]);
    const paymentMethods = useLiveQuery(() => query(col("paymentMethods"), orderBy("order", "asc")), withId, [col]);
    const performanceLogs = useLiveQuery(() => query(col("dailyPerformance"), orderBy("date", "desc")), withDate, [col]);
    // Las ventas viejas guardaban la fecha como texto y las nuevas como Timestamp:
    // Firestore no mezcla tipos en un rango, así que se escuchan ambas.
    // Todas las fechas son Timestamp (las de texto de la v1 se convierten al arrancar: migrateStringDates).
    const cashOuts = useLiveQuery(() => query(col("cashOuts"), where("date", ">=", Timestamp.fromDate(cutoff))), withDate, [col, cutoff]);
    const txTs = useLiveQuery(() => query(col("transactions"), where("date", ">=", Timestamp.fromDate(cutoff))), normalizeTransaction, [col, cutoff]);

    const transactions = useMemo(
        () => [...txTs.docs].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
        [txTs.docs]
    );

    const sortByName = (list) => [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

    const data = useMemo(() => {
        const productsById = {};
        for (const p of products.docs) productsById[p.id] = p;
        const sortedCategories = sortByName(categories.docs);
        const colorById = Object.fromEntries(sortedCategories.map((c, i) => [c.id, CATEGORY_COLORS[i % CATEGORY_COLORS.length]]));
        return {
            mode,
            liveSince: cutoff,
            products: products.docs,
            productsById,
            categories: sortedCategories,
            categoryColor: (id) => colorById[id] || NO_CATEGORY_COLOR,
            customers: sortByName(customers.docs),
            promotions: promotions.docs,
            vendedores: sortByName(vendedores.docs),
            loans: loans.docs,
            paymentMethods: paymentMethods.docs,
            performanceLogs: performanceLogs.docs,
            cashOuts: cashOuts.docs,
            transactions,
            ready: products.ready && paymentMethods.ready,
            // En la demo todo queda "pendiente" para siempre (no hay red): no se muestra.
            pendingSync: mode !== "demo" && (products.pending || loans.pending || txTs.pending || performanceLogs.pending),
        };
    }, [mode, cutoff, products, categories, customers, promotions, vendedores, loans, paymentMethods, performanceLogs, cashOuts, transactions, txTs.pending]);

    const dataRef = useRef(data);
    dataRef.current = data;

    const actions = useMemo(() => createActions({ db, col, getData: () => dataRef.current, getUser: () => userRef.current, notify: showToast }), [db, col, showToast]);

    // Siembra inicial: solo con datos confirmados por el servidor y una vez por sesión.
    const seeded = useRef({});
    useEffect(() => {
        const key = mode;
        if (seeded.current[key]) return;
        if (mode === "demo") {
            seeded.current[key] = true;
            actions.loadDataset(buildDemoDataset());
            return;
        }
        if (paymentMethods.fromCache || products.fromCache || !paymentMethods.ready || !products.ready) return;
        seeded.current[key] = true;

        const run = async () => {
            if (paymentMethods.docs.length === 0) await actions.seedPaymentMethods(DEFAULT_PAYMENT_METHODS);
            else {
                const seen = new Set();
                const dupes = [];
                [...paymentMethods.docs]
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .forEach((pm) => {
                        const n = pm.name?.trim().toLowerCase();
                        if (!n) return;
                        if (seen.has(n)) dupes.push(pm.id);
                        else seen.add(n);
                    });
                if (dupes.length) await actions.dedupePaymentMethods(dupes);
            }
            if (!products.docs.some((p) => p.name?.trim().toLowerCase() === "otro")) await actions.seedOtroProduct();
            const fixed = await actions.migrateStringDates();
            if (fixed) console.info(`Fechas unificadas en ${fixed} ventas`);
        };
        run().catch((err) => console.error("Error en la siembra inicial:", err));
    }, [mode, actions, paymentMethods, products]);

    // `col` se expone para consultas bajo demanda (reportes, actividad, entradas de mercancía).
    const value = useMemo(() => ({ ...data, col, actions }), [data, col, actions]);
    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

import { useEffect, useState } from "react";
import { readString, writeString } from "./storage";

export function useOnlineStatus() {
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener("online", on);
        window.addEventListener("offline", off);
        return () => {
            window.removeEventListener("online", on);
            window.removeEventListener("offline", off);
        };
    }, []);
    return online;
}

export function useMediaQuery(q) {
    const [match, setMatch] = useState(() => window.matchMedia(q).matches);
    useEffect(() => {
        const mql = window.matchMedia(q);
        const fn = (e) => setMatch(e.matches);
        mql.addEventListener("change", fn);
        return () => mql.removeEventListener("change", fn);
    }, [q]);
    return match;
}

/** Estado de actualizaciones de la app de escritorio (Electron). */
export function useUpdater() {
    const [state, setState] = useState({ status: "idle", version: "", progress: 0 });
    useEffect(() => {
        const api = window.electron;
        if (!api) return undefined;
        const offStatus = api.onUpdateStatus?.((status, info) => setState((s) => ({ ...s, status, version: info || s.version })));
        const offProgress = api.onUpdateProgress?.((percent) => setState((s) => ({ ...s, status: "downloading", progress: percent })));
        return () => {
            offStatus?.();
            offProgress?.();
        };
    }, []);
    return {
        ...state,
        available: Boolean(window.electron),
        check: () => {
            setState((s) => ({ ...s, status: "checking" }));
            window.electron?.checkForUpdates();
        },
        download: () => window.electron?.startDownload(),
        install: () => window.electron?.quitAndInstall(),
    };
}

/** Valor que solo cambia después de `ms` sin cambios (búsquedas fluidas en PCs lentos). */
export function useDebounced(value, ms = 150) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

/** Preferencia de este equipo guardada en localStorage (sí/no). */
export function useDevicePref(key, fallback = false) {
    const [value, setValue] = useState(() => {
        const raw = readString(key);
        return raw ? raw === "true" : fallback;
    });
    const set = (v) => {
        setValue(v);
        writeString(key, v ? "true" : "false");
    };
    return [value, set];
}

/** Fotos de productos en la caja e inventario (apagado: tarjetas solo con texto). */
export const SHOW_PHOTOS_KEY = "pos_show_photos";
export const useShowPhotos = () => useDevicePref(SHOW_PHOTOS_KEY, false);

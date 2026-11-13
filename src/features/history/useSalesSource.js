import { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { startOfDay } from "../../lib/dates";

/**
 * Ventas para un rango: las que están en vivo y, si el rango empieza antes
 * de la ventana en vivo, también las antiguas (se consultan a la base).
 * Devuelve { source, loading }.
 */
export default function useSalesSource(range) {
    const { transactions, liveSince, actions } = useData();
    const { showToast } = useUi();
    const [archive, setArchive] = useState({ key: null, loading: false, rows: [] });

    const needsArchive = !range[0] || startOfDay(range[0]) < liveSince;
    const archiveKey = needsArchive ? `${range[0]?.getTime() || 0}-${range[1]?.getTime() || 0}` : null;
    useEffect(() => {
        if (!archiveKey || archive.key === archiveKey) return;
        let cancelled = false;
        setArchive({ key: archiveKey, loading: true, rows: [] });
        actions
            .loadTransactionsRange(range[0], range[1])
            .then((rows) => !cancelled && setArchive({ key: archiveKey, loading: false, rows }))
            .catch((err) => {
                console.error(err);
                if (!cancelled) setArchive({ key: archiveKey, loading: false, rows: [] });
                showToast("No se pudieron cargar las ventas antiguas (¿sin internet?)", "warning");
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [archiveKey]);

    const source = useMemo(() => {
        if (!needsArchive) return transactions;
        // Unir ventas en vivo + antiguas, sin duplicados.
        const byId = new Map(archive.rows.map((t) => [t.id, t]));
        transactions.forEach((t) => byId.set(t.id, t));
        return [...byId.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }, [needsArchive, transactions, archive.rows]);

    return { source, loading: Boolean(archiveKey) && (archive.key !== archiveKey || archive.loading) };
}

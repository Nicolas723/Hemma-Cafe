import { useRef, useState } from "react";
import { DatabaseBackup, FolderOpen, Loader2, Download, Upload } from "lucide-react";
import { useAuth } from "../../context/AuthProvider";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { useOnlineStatus } from "../../lib/hooks";
import { AUTO_BACKUP_DAYS, lastBackupDate, readBackupFile, runBackup } from "../../lib/backup";
import { formatDateTime } from "../../lib/format";

/** Copia de seguridad manual + estado de la automática (semanal, solo en la app de escritorio). */
export default function BackupCard() {
    const { col, mode, actions } = useData();
    const { showToast, showConfirm } = useUi();
    const { isAdmin } = useAuth();
    const fileRef = useRef(null);
    const online = useOnlineStatus();
    const [busy, setBusy] = useState(false);
    const [last, setLast] = useState(lastBackupDate);
    const desktop = Boolean(window.electron?.saveBackup);

    const backup = async () => {
        setBusy(true);
        try {
            const { folder, counts } = await runBackup(col);
            setLast(lastBackupDate());
            showToast(
                `Copia lista: ${counts.transactions} ventas, ${counts.products} productos${folder ? " · guardada en Documentos" : ""}`,
                "success",
                desktop ? { label: "Abrir carpeta", onClick: () => window.electron.openBackups() } : undefined
            );
        } catch (err) {
            console.error(err);
            showToast("No se pudo crear la copia de seguridad", "error");
        } finally {
            setBusy(false);
        }
    };

    // Restaurar: solo administradores. Agrega/reemplaza por id, no borra lo posterior.
    const restore = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            const { createdAt, counts, data } = await readBackupFile(file);
            const ok = await showConfirm(
                `¿Restaurar la copia del ${createdAt ? formatDateTime(createdAt) : "archivo elegido"}? Trae ${counts.transactions} ventas, ${counts.products} productos, ${counts.loans} créditos y ${counts.users} usuarios. Lo que tenga el mismo registro se reemplaza por la versión de la copia; lo creado después se conserva.`,
                { confirmLabel: "Restaurar" }
            );
            if (!ok) return;
            const n = actions.restoreBackup(data);
            showToast(`Copia restaurada: ${n} registros`, "success");
        } catch (err) {
            console.error(err);
            showToast(err.message || "No se pudo leer la copia", "error");
        }
    };

    return (
        <section className="card stack">
            <h2 className="card-title">
                <DatabaseBackup size={20} /> Copia de seguridad
            </h2>
            <p className="muted small">
                Guarda <b>todos</b> los datos (ventas, productos, créditos, cierres, clientes…) en un Excel para leer y un archivo .json para restaurar.
                {desktop
                    ? ` Esta caja también hace una copia automática cada ${AUTO_BACKUP_DAYS} días en Documentos › Hemma POS › Copias de seguridad (guarda las 10 últimas).`
                    : ""}
            </p>
            <div className="muted small">Última copia en este equipo: {last ? formatDateTime(last) : "nunca"}</div>
            {mode === "demo" && <div className="note">En la demo la copia contiene solo los datos de muestra.</div>}
            {!online && <div className="note">Conéctate a internet para que la copia incluya todo el historial.</div>}
            <div className="row-gap">
                <button className="btn btn--primary" onClick={backup} disabled={busy}>
                    {busy ? <Loader2 size={18} className="spin" /> : <Download size={18} />} {busy ? "Creando copia…" : "Hacer copia ahora"}
                </button>
                {desktop && (
                    <button className="btn btn--ghost" onClick={() => window.electron.openBackups()}>
                        <FolderOpen size={18} /> Abrir carpeta
                    </button>
                )}
                {isAdmin && (
                    <>
                        <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
                            <Upload size={18} /> Restaurar copia
                        </button>
                        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={restore} />
                    </>
                )}
            </div>
        </section>
    );
}

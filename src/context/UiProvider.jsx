import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import Receipt from "../components/Receipt";
import ClosingReceipt from "../components/ClosingReceipt";
import { readString } from "../lib/storage";

const UiContext = createContext(null);
export const useUi = () => useContext(UiContext);

const TOAST_ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
export const SILENT_PRINT_KEY = "pos_silent_print";

export function UiProvider({ children }) {
    const [toast, setToast] = useState(null);
    const [confirmState, setConfirmState] = useState(null);
    const [printJob, setPrintJob] = useState(null); // { kind: "receipt" | "closing", data }
    const timer = useRef(null);

    const closeToast = useCallback(() => {
        clearTimeout(timer.current);
        setToast(null);
    }, []);

    /** showToast("Texto", "success", { label: "Imprimir", onClick }) */
    const showToast = useCallback((message, type = "success", action = null) => {
        clearTimeout(timer.current);
        setToast({ message, type, action, key: Date.now() });
        timer.current = setTimeout(() => setToast(null), action ? 7000 : 3500);
    }, []);

    const showConfirm = useCallback(
        (message, { confirmLabel = "Confirmar", danger = true } = {}) =>
            new Promise((resolve) => setConfirmState({ message, confirmLabel, danger, resolve })),
        []
    );

    const answer = (value) => {
        confirmState?.resolve(value);
        setConfirmState(null);
    };

    useEffect(() => {
        if (!confirmState) return;
        const onKey = (e) => {
            if (e.key === "Escape") answer(false);
            if (e.key === "Enter") answer(true);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const print = useCallback((kind, data) => {
        if (!data) return;
        setPrintJob({ kind, data });
        // Esperar a que React pinte el recibo antes de imprimir.
        setTimeout(() => {
            const silent = readString(SILENT_PRINT_KEY) === "true";
            if (window.electron?.print) window.electron.print({ silent });
            else window.print();
        }, 250);
    }, []);
    const printReceipt = useCallback((transaction) => print("receipt", transaction), [print]);
    const printClosing = useCallback((closing) => print("closing", closing), [print]);

    const ToastIcon = toast ? TOAST_ICONS[toast.type] || Info : null;

    return (
        <UiContext.Provider value={{ showToast, showConfirm, printReceipt, printClosing }}>
            {children}

            {toast && (
                <div key={toast.key} className={`toast toast--${toast.type}`} role="status">
                    <ToastIcon size={20} />
                    <span className="toast__msg">{toast.message}</span>
                    {toast.action && (
                        <button
                            className="toast__action"
                            onClick={() => {
                                toast.action.onClick();
                                closeToast();
                            }}
                        >
                            {toast.action.label}
                        </button>
                    )}
                    <button className="toast__close" onClick={closeToast} aria-label="Cerrar">
                        <X size={16} />
                    </button>
                </div>
            )}

            {confirmState && (
                <div className="modal-backdrop" onMouseDown={() => answer(false)}>
                    <div className="modal modal--sm" onMouseDown={(e) => e.stopPropagation()} role="alertdialog">
                        <div className="confirm__icon">
                            <AlertTriangle size={28} />
                        </div>
                        <p className="confirm__msg">{confirmState.message}</p>
                        <div className="modal__actions">
                            <button className="btn btn--ghost btn--lg" onClick={() => answer(false)}>
                                Cancelar
                            </button>
                            <button
                                className={`btn btn--lg ${confirmState.danger ? "btn--danger" : "btn--primary"}`}
                                onClick={() => answer(true)}
                                autoFocus
                            >
                                {confirmState.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="print-area">
                {printJob?.kind === "closing" ? <ClosingReceipt closing={printJob.data} /> : <Receipt transaction={printJob?.data} />}
            </div>
        </UiContext.Provider>
    );
}

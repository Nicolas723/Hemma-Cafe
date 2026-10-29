import { Component } from "react";
import { AlertTriangle, RotateCcw, RefreshCw } from "lucide-react";

/**
 * Si una pantalla falla, muestra un aviso con «Reintentar» en vez de dejar la
 * caja en blanco. Las órdenes abiertas viven en localStorage: no se pierden.
 * `resetKey`: al cambiar (p. ej. de sección) se limpia el error solo.
 */
export default class ErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error("Error en la pantalla:", error, info?.componentStack);
    }

    componentDidUpdate(prev) {
        if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        // Si falló la carga de una sección (p. ej. archivo dañado tras una actualización), recargar suele resolverlo.
        const chunk = /Loading chunk|dynamically imported module|Failed to fetch/i.test(String(error?.message));
        return (
            <div className={`crash ${this.props.full ? "crash--full" : ""}`} role="alert">
                <AlertTriangle size={40} />
                <h2>Algo salió mal en esta pantalla</h2>
                <p className="muted">
                    {chunk ? "No se pudo cargar esta sección." : "No se perdió nada: las órdenes abiertas y las ventas siguen guardadas."} Prueba de nuevo o recarga la app.
                </p>
                <div className="row-gap">
                    <button className="btn btn--primary btn--lg" onClick={() => this.setState({ error: null })}>
                        <RotateCcw size={18} /> Reintentar
                    </button>
                    <button className="btn btn--ghost btn--lg" onClick={() => window.location.reload()}>
                        <RefreshCw size={18} /> Recargar la app
                    </button>
                </div>
                <details className="crash__details">
                    <summary>Detalle técnico</summary>
                    <code>{String(error?.message || error)}</code>
                </details>
            </div>
        );
    }
}

import { Children, Fragment, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Aplana fragmentos (<>…</>) y quita los vacíos, conservando claves estables. */
function flatten(children, prefix = "") {
    const out = [];
    Children.toArray(children).forEach((child) => {
        if (isValidElement(child) && child.type === Fragment) out.push(...flatten(child.props.children, `${prefix}${child.key}/`));
        else if (child) out.push({ key: `${prefix}${child.key}`, node: child });
    });
    return out;
}

/**
 * Tarjetas en columnas tipo «mampostería»: cada tarjeta se ubica justo debajo de la
 * anterior de la columna más corta, sin huecos. Chromium 108 (Windows 7) no tiene
 * masonry en CSS, por eso se calcula aquí.
 *
 * Todas las tarjetas viven en un mismo contenedor (posición absoluta): al cambiar
 * de columna no se vuelven a montar, así no se pierde lo que se esté escribiendo.
 */
export default function Masonry({ children, minColumn = 340, gap = 16, className = "" }) {
    const items = flatten(children);
    const box = useRef(null);
    const [layout, setLayout] = useState({ colWidth: 0, height: 0, pos: {} });
    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    const compute = useCallback(() => {
        const el = box.current;
        if (!el) return;
        const width = el.clientWidth;
        const cols = Math.max(1, Math.floor((width + gap) / (minColumn + gap)));
        const colWidth = (width - gap * (cols - 1)) / cols;
        const heights = new Array(cols).fill(0);
        const pos = {};
        el.querySelectorAll(":scope > [data-masonry-key]").forEach((node) => {
            const c = heights.indexOf(Math.min(...heights));
            pos[node.dataset.masonryKey] = { x: c * (colWidth + gap), y: heights[c] };
            // Tarjetas que no muestran nada (componentes que devuelven null) no ocupan espacio ni separación.
            if (node.offsetHeight > 0) heights[c] += node.offsetHeight + gap;
        });
        const next = { colWidth, height: Math.max(0, Math.max(...heights) - gap), pos };
        // Solo actualiza si cambió algo (evita bucles de render).
        if (JSON.stringify(next) !== JSON.stringify(layoutRef.current)) setLayout(next);
    }, [gap, minColumn]);

    // Antes de pintar: mide y ubica (sin parpadeo). Si el ancho de columna cambió, mide de nuevo.
    useLayoutEffect(compute);

    // Re-ubica cuando cambia el ancho de la pantalla o el alto de una tarjeta (listas que crecen, errores…).
    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return undefined;
        let frame = 0;
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(compute);
        });
        ro.observe(box.current);
        box.current.querySelectorAll(":scope > [data-masonry-key]").forEach((n) => ro.observe(n));
        return () => {
            cancelAnimationFrame(frame);
            ro.disconnect();
        };
    }, [compute, items.length]);

    const ready = layout.colWidth > 0;
    return (
        <div ref={box} className={`masonry ${className}`} style={{ height: ready ? layout.height : undefined }}>
            {items.map(({ key, node }) => {
                const p = layout.pos[key];
                // top/left (no transform): un transform haría que los modales (position: fixed) quedaran atrapados en la tarjeta.
                return (
                    <div
                        key={key}
                        data-masonry-key={key}
                        className="masonry__item"
                        style={ready && p ? { width: layout.colWidth, left: p.x, top: p.y } : { visibility: "hidden" }}
                    >
                        {node}
                    </div>
                );
            })}
        </div>
    );
}

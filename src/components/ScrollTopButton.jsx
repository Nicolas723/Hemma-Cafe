import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

const MARGIN = 14; // separación desde la esquina del elemento
const SIZE = 40;
// Elementos flotantes que el botón no debe tapar (se ubica encima de ellos).
const AVOID = [".cart-fab"];

/** ¿Vale la pena ofrecer «volver arriba»? Solo si se bajó bastante. */
const scrolledEnough = (el) => el.scrollTop > Math.max(160, el.clientHeight * 0.5);

/**
 * Botón «volver arriba» para CUALQUIER elemento con scroll (la página, la cuadrícula
 * de productos, listas, tablas, ventanas…). Un solo componente global: escucha el
 * scroll de todo el documento y aparece, sutil, en la esquina inferior derecha del
 * elemento que se desplazó. Así también funciona en pantallas futuras sin tocarlas.
 */
export default function ScrollTopButton() {
    const [state, setState] = useState({ el: null, pos: null, visible: false });
    const current = useRef(null);

    useEffect(() => {
        // setTimeout y no requestAnimationFrame: el navegador pausa rAF si la ventana queda detrás de otra.
        let timer = 0;

        const place = (el) => {
            const isPage = el === document.scrollingElement;
            const r = isPage ? { right: window.innerWidth, bottom: window.innerHeight, left: 0, top: 0 } : el.getBoundingClientRect();
            // Elemento fuera de pantalla o demasiado pequeño para un botón.
            if (r.bottom - r.top < SIZE * 3 || r.right - r.left < SIZE * 2) return null;
            let bottom = window.innerHeight - Math.min(r.bottom, window.innerHeight) + MARGIN;
            const right = window.innerWidth - Math.min(r.right, window.innerWidth) + MARGIN;
            const x = window.innerWidth - right - SIZE / 2;
            AVOID.forEach((sel) => {
                document.querySelectorAll(sel).forEach((n) => {
                    const a = n.getBoundingClientRect();
                    const y = window.innerHeight - bottom - SIZE / 2;
                    if (a.width && x >= a.left && x <= a.right && y + SIZE / 2 >= a.top) bottom = window.innerHeight - a.top + 10;
                });
            });
            return { right, bottom };
        };

        const update = (el) => {
            if (!el || !el.isConnected) {
                current.current = null;
                return setState((s) => (s.visible ? { ...s, visible: false } : s));
            }
            if (scrolledEnough(el)) {
                const pos = place(el);
                if (!pos) return;
                current.current = el;
                setState({ el, pos, visible: true });
            } else if (current.current === el) {
                current.current = null;
                setState((s) => ({ ...s, visible: false }));
            }
        };

        const onScroll = (e) => {
            const el = e.target === document ? document.scrollingElement : e.target;
            if (!(el instanceof Element) || el.scrollHeight <= el.clientHeight) return; // scroll horizontal (chips) u otros
            clearTimeout(timer);
            timer = setTimeout(() => update(el), 60);
        };
        const onResize = () => current.current && update(current.current);

        document.addEventListener("scroll", onScroll, true); // captura: llega el scroll de cualquier elemento
        window.addEventListener("resize", onResize);
        // Si el elemento desaparece (se cambia de pantalla o se cierra una ventana), el botón se oculta.
        const check = setInterval(() => current.current && !current.current.isConnected && update(null), 700);
        return () => {
            clearTimeout(timer);
            clearInterval(check);
            document.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onResize);
        };
    }, []);

    const goTop = () => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        state.el?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    };

    if (!state.pos) return null;
    return (
        <button
            type="button"
            className={`scroll-top ${state.visible ? "is-visible" : ""}`}
            style={{ right: state.pos.right, bottom: state.pos.bottom }}
            onClick={goTop}
            aria-label="Volver arriba"
            title="Volver arriba"
            tabIndex={state.visible ? 0 : -1}
        >
            <ArrowUp size={18} />
        </button>
    );
}

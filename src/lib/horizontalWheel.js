/**
 * Rueda del mouse en los deslizables horizontales (mesas, categorías, vendedores…).
 * El navegador solo desplaza en vertical con la rueda; aquí, si el puntero está
 * sobre algo que solo se desliza en horizontal, la rueda lo mueve de lado.
 * Lo que también se desliza en vertical (listas, tablas) se deja como siempre.
 */
const scrolls = (value) => value === "auto" || value === "scroll";

export function installHorizontalWheel() {
    const onWheel = (e) => {
        // Ctrl+rueda es zoom; un trackpad que ya mueve en horizontal no necesita ayuda.
        if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerWidth : e.deltaY;

        for (let el = e.target; el && el.nodeType === 1 && el !== document.body; el = el.parentElement) {
            const style = getComputedStyle(el);
            const canX = scrolls(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
            const canY = scrolls(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
            if (canY) return; // un deslizable vertical tiene prioridad
            if (!canX) continue;
            const max = el.scrollWidth - el.clientWidth;
            // En el borde se deja pasar la rueda para que la página siga bajando.
            if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= max - 1)) return;
            el.scrollLeft += delta;
            e.preventDefault();
            return;
        }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
}

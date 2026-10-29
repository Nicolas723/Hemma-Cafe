import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { isEmojiSupported } from "../lib/emoji";

/** Ventana modal. Se cierra con Esc o clic afuera. */
export function Modal({ title, icon: Icon, onClose, children, footer, size = "md" }) {
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose?.();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="modal-backdrop" onMouseDown={onClose}>
            <div className={`modal modal--${size}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="modal__head">
                    <h2 className="modal__title">
                        {Icon && <Icon size={22} />} {title}
                    </h2>
                    <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
                        <X size={20} />
                    </button>
                </div>
                <div className="modal__body">{children}</div>
                {footer && <div className="modal__actions">{footer}</div>}
            </div>
        </div>
    );
}

export function SearchInput({ value, onChange, placeholder = "Buscar...", autoFocus, inputRef, onKeyDown, className = "" }) {
    const localRef = useRef(null);
    const ref = inputRef || localRef;
    return (
        <div className={`search ${className}`}>
            <Search size={18} className="search__icon" />
            <input
                ref={ref}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                onKeyDown={onKeyDown}
                spellCheck={false}
            />
            {value && (
                <button
                    className="search__clear"
                    onClick={() => {
                        onChange("");
                        ref.current?.focus();
                    }}
                    aria-label="Limpiar"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}

/** Botones tipo pastilla de selección única (reemplazan los <select> de un clic extra). */
export function ChipGroup({ options, value, onChange, className = "", size }) {
    return (
        <div className={`chips ${className}`} role="radiogroup">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={value === o.value}
                    className={`chip ${size === "lg" ? "chip--lg" : ""} ${value === o.value ? "is-active" : ""}`}
                    onClick={() => onChange(o.value)}
                    title={o.title}
                >
                    {o.icon}
                    <span>{o.label}</span>
                    {o.count !== undefined && <span className="chip__count">{o.count}</span>}
                </button>
            ))}
        </div>
    );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }) {
    return (
        <div className={`stat stat--${tone}`}>
            {Icon && (
                <div className="stat__icon">
                    <Icon size={22} />
                </div>
            )}
            <div className="stat__body">
                <div className="stat__label">{label}</div>
                <div className="stat__value">{value}</div>
                {hint && <div className="stat__hint">{hint}</div>}
            </div>
        </div>
    );
}

export function EmptyState({ icon: Icon, title, children }) {
    return (
        <div className="empty">
            {Icon && <Icon size={44} strokeWidth={1.5} />}
            <div className="empty__title">{title}</div>
            {children && <div className="empty__text">{children}</div>}
        </div>
    );
}

export function Toggle({ checked, onChange, label, icon: Icon }) {
    return (
        <button type="button" className={`toggle ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
            {Icon && <Icon size={16} />}
            <span>{label}</span>
            <span className="toggle__track">
                <span className="toggle__thumb" />
            </span>
        </button>
    );
}

export function Field({ label, children, hint, className = "" }) {
    return (
        <label className={`field ${className}`}>
            {label && <span className="field__label">{label}</span>}
            {children}
            {hint && <span className="field__hint">{hint}</span>}
        </label>
    );
}

/** Emoji solo si el sistema lo puede dibujar (Windows 7 no tiene fuente de emojis). */
export function SafeEmoji({ emoji, fallback = null }) {
    if (isEmojiSupported(emoji)) return <span aria-hidden="true">{emoji}</span>;
    return fallback;
}

export function PageHeader({ icon: Icon, title, subtitle, children }) {
    return (
        <div className="page-head">
            <div className="page-head__title">
                {Icon && (
                    <div className="page-head__icon">
                        <Icon size={24} />
                    </div>
                )}
                <div>
                    <h1>{title}</h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
            </div>
            {children && <div className="page-head__actions">{children}</div>}
        </div>
    );
}

/** Input numérico de dinero: solo dígitos, muestra separador de miles. */
export function MoneyInput({ value, onChange, placeholder = "0", autoFocus, className = "", onKeyDown, inputRef }) {
    const display = value === "" || value === null || value === undefined ? "" : Number(value).toLocaleString("es-CO");
    return (
        <div className={`money ${className}`}>
            <span className="money__sign">$</span>
            <input
                ref={inputRef}
                inputMode="numeric"
                value={display}
                placeholder={placeholder}
                autoFocus={autoFocus}
                onKeyDown={onKeyDown}
                onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    onChange(digits === "" ? "" : String(parseInt(digits, 10)));
                }}
            />
        </div>
    );
}

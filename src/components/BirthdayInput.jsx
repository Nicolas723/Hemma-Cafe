import { useState } from "react";
import { Cake } from "lucide-react";
import { MONTHS, parseBirthday, toBirthday } from "../lib/birthdays";

/**
 * Cumpleaños opcional: día + mes (sin año). `value` y `onChange` usan "MM-DD" o "".
 * Mientras falte el día o el mes se espera; elegir «—» en cualquiera lo borra.
 */
export default function BirthdayInput({ value, onChange, compact = false }) {
    const parsed = parseBirthday(value);
    const [day, setDay] = useState(parsed ? String(parsed.day) : "");
    const [month, setMonth] = useState(parsed ? String(parsed.month) : "");

    const update = (d, m) => {
        setDay(d);
        setMonth(m);
        if (!d || !m) {
            if (value) onChange("");
            return;
        }
        const next = toBirthday(d, m);
        if (next !== (value || "")) onChange(next);
    };
    const maxDay = month ? new Date(2024, Number(month), 0).getDate() : 31;

    return (
        <div className={`birthday-input ${compact ? "birthday-input--compact" : ""}`} title="Cumpleaños (opcional)">
            <Cake size={compact ? 14 : 16} />
            <select className="select select--sm" value={day} onChange={(e) => update(e.target.value, month)} aria-label="Día del cumpleaños">
                <option value="">Día</option>
                {Array.from({ length: maxDay }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                        {i + 1}
                    </option>
                ))}
            </select>
            <select
                className="select select--sm"
                value={month}
                onChange={(e) => {
                    const m = e.target.value;
                    const max = m ? new Date(2024, Number(m), 0).getDate() : 31;
                    update(day && Number(day) > max ? String(max) : day, m);
                }}
                aria-label="Mes del cumpleaños"
            >
                <option value="">Mes</option>
                {MONTHS.map((name, i) => (
                    <option key={name} value={String(i + 1)}>
                        {compact ? name.slice(0, 3) : name}
                    </option>
                ))}
            </select>
        </div>
    );
}

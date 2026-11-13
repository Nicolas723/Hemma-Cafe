import { useMemo, useState } from "react";
import { StickyNote, Search } from "lucide-react";
import { useData } from "../../context/DataProvider";
import { useUi } from "../../context/UiProvider";
import { ChipGroup, Field, Toggle } from "../../components/ui";
import ExportDialog, { Group, RangeField, useRangeFilter } from "../../components/ExportDialog";
import { DATE_PRESETS } from "../../lib/dates";
import { exportWorkbook } from "../../lib/excel";
import { SALE_KINDS, filterSales, rangeTag, salesDetailSheet, salesSummarySheet, safeFileName } from "../../lib/exports";
import useSalesSource from "./useSalesSource";

const FORMATS = [
    { value: "detail", label: "Detalle por producto" },
    { value: "summary", label: "Una fila por venta" },
];

/**
 * Descargar ventas. Viene llenado con los filtros de la pantalla (initial).
 * locked: cajero sin permiso de ver días anteriores (solo hoy).
 */
export default function SalesExport({ initial, locked, onClose }) {
    const { vendedores, paymentMethods, products, categories } = useData();
    const { showToast } = useUi();
    const [dates, setDates] = useRangeFilter(initial.preset, initial.range);
    const range = useMemo(() => (locked ? DATE_PRESETS[0].range() : dates.range), [locked, dates.range]);
    const [vendedor, setVendedor] = useState(initial.vendedor);
    const [method, setMethod] = useState(initial.method);
    const [kinds, setKinds] = useState(SALE_KINDS.map((k) => k.value));
    const [onlyNotes, setOnlyNotes] = useState(initial.onlyNotes);
    const [useQuery, setUseQuery] = useState(Boolean(initial.query));
    const [format, setFormat] = useState("detail");
    const { source, loading } = useSalesSource(range);

    const rows = useMemo(
        () => filterSales(source, { range, vendedor, method, kinds, onlyNotes, query: useQuery ? initial.query : "" }),
        [source, range, vendedor, method, kinds, onlyNotes, useQuery, initial.query]
    );
    const methodNames = useMemo(() => paymentMethods.map((m) => m.name), [paymentMethods]);
    const toggleKind = (k) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));

    const download = async () => {
        try {
            const sheet = format === "summary" ? salesSummarySheet(rows, methodNames) : salesDetailSheet(rows, { products, categories });
            const who = vendedor ? `_${vendedor}` : "";
            await exportWorkbook(safeFileName(`Ventas_${rangeTag(range)}${who}.xlsx`), [sheet]);
            showToast("Excel de ventas descargado", "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo exportar el Excel", "error");
            return false;
        }
    };

    return (
        <ExportDialog title="Descargar ventas" count={rows.length} noun={["venta", "ventas"]} loading={loading} onDownload={download} onClose={onClose}>
            <RangeField value={dates} onChange={setDates} locked={locked} />
            <Group label="Tipo">
                <div className="chips chips--wrap">
                    {SALE_KINDS.map((k) => (
                        <button key={k.value} type="button" className={`chip ${kinds.includes(k.value) ? "is-active" : ""}`} onClick={() => toggleKind(k.value)} aria-pressed={kinds.includes(k.value)}>
                            {k.label}
                        </button>
                    ))}
                </div>
            </Group>
            <div className="export__row">
                <Field label="Vendedor">
                    <select className="select" value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
                        <option value="">Todos</option>
                        {vendedores.map((v) => (
                            <option key={v.id} value={v.name}>
                                {v.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Método de pago">
                    <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="">Todos</option>
                        {[...new Set([...methodNames, ...(initial.method ? [initial.method] : [])])].map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>
            {(initial.onlyNotes || onlyNotes || initial.query) && (
                <div className="export__row">
                    <Toggle icon={StickyNote} label="Solo con notas" checked={onlyNotes} onChange={setOnlyNotes} />
                    {initial.query && <Toggle icon={Search} label={`Solo «${initial.query}»`} checked={useQuery} onChange={setUseQuery} />}
                </div>
            )}
            <Group label="Formato" hint={format === "summary" ? "Una fila por venta, con una columna por método de pago: ideal para cuadrar dinero." : "Una fila por cada producto vendido."}>
                <ChipGroup options={FORMATS} value={format} onChange={setFormat} />
            </Group>
        </ExportDialog>
    );
}

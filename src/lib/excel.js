/**
 * ExcelJS pesa ~1 MB: se carga solo cuando el usuario exporta o importa,
 * así el arranque de la caja en Windows 7 es mucho más rápido.
 */
const loadExcel = () => import("exceljs/dist/exceljs.min.js").then((m) => m.default || m);
const loadSaver = () => import("file-saver").then((m) => m.saveAs || m.default);

const BRAND_ARGB = "FF5B7410";

/**
 * Crea y descarga un libro de Excel.
 * @param {string} fileName
 * @param {{name:string, columns:{header:string,key:string,width?:number,money?:boolean}[], rows:object[]}[]} sheets
 */
export async function exportWorkbook(fileName, sheets) {
    const [buffer, saveAs] = await Promise.all([buildWorkbook(sheets), loadSaver()]);
    saveAs(new Blob([buffer]), fileName);
}

/** Genera el .xlsx en memoria (ArrayBuffer) sin descargarlo. */
export async function buildWorkbook(sheets) {
    const ExcelJS = await loadExcel();
    const wb = new ExcelJS.Workbook();
    for (const { name, columns, rows } of sheets) {
        const ws = wb.addWorksheet(name);
        ws.columns = columns.map(({ header, key, width }) => ({ header, key, width: width || 15 }));
        rows.forEach((r) => ws.addRow(r));
        const head = ws.getRow(1);
        head.font = { bold: true, color: { argb: "FFFFFFFF" } };
        head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_ARGB } };
        columns.forEach((c, i) => {
            if (c.money) ws.getColumn(i + 1).numFmt = '"$"#,##0';
        });
    }
    return wb.xlsx.writeBuffer();
}

/** Descarga un archivo cualquiera (navegador). */
export async function downloadFile(fileName, data, type = "application/octet-stream") {
    const saveAs = await loadSaver();
    saveAs(new Blob([data], { type }), fileName);
}

/** Lee la primera hoja de un .xlsx y devuelve filas como objetos {encabezado: valor}. */
export async function readWorkbook(file) {
    const ExcelJS = await loadExcel();
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const headers = {};
    ws.getRow(1).eachCell((cell, col) => {
        headers[col] = String(cell.text || "").trim();
    });
    const rows = [];
    ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};
        row.eachCell((cell, col) => {
            const h = headers[col];
            if (h) obj[h] = cell.type === ExcelJS.ValueType.Number ? cell.value : cell.text;
        });
        if (Object.keys(obj).length) rows.push(obj);
    });
    return rows;
}

export const today = () => new Date().toISOString().split("T")[0];

export const PRODUCT_COLUMNS = [
    { header: "Nombre", key: "Nombre", width: 28 },
    { header: "Categoría", key: "Categoría", width: 20 },
    { header: "Precio", key: "Precio", width: 14, money: true },
    { header: "Cantidad", key: "Cantidad", width: 10 },
    { header: "Precio Especial", key: "Precio Especial", width: 16, money: true },
    { header: "Precio Mayorista", key: "Precio Mayorista", width: 16, money: true },
    { header: "Costo", key: "Costo", width: 12, money: true },
];

import { buildReportSheets } from './report.js';
import { todayStr } from './dates.js';

/*
 * Genera el archivo .xlsx y lo descarga.
 *
 * ExcelJS pesa bastante, así que se carga con import() dinámico: solo baja
 * cuando el usuario le da al botón, y no entra al bundle principal que se
 * descarga al abrir la app.
 */

const CABECERA = { argb: 'FF2E2B27' };
const TEXTO_CABECERA = { argb: 'FFFFFFFF' };

/*
 * Arma el libro de Excel. Separado de la descarga para poder generarlo también
 * fuera del navegador (ver scripts/sample-report.mjs) y verificar el archivo.
 */
export async function buildWorkbook(data) {
  const { default: ExcelJS } = await import('exceljs');

  const libro = new ExcelJS.Workbook();
  libro.creator = 'AlDía';
  libro.created = new Date();

  buildReportSheets(data).forEach((hoja) => {
    const ws = libro.addWorksheet(hoja.name, {
      views: [{ state: 'frozen', ySplit: 1 }],   // la fila de títulos se queda fija al bajar
    });
    ws.columns = hoja.columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 14 }));

    ws.getRow(1).font = { bold: true, color: TEXTO_CABECERA };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: CABECERA };
    ws.getRow(1).alignment = { vertical: 'middle' };

    hoja.rows.forEach((fila) => ws.addRow(fila));

    hoja.columns.forEach((c, i) => {
      if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
    });

    // Filtros en las hojas que son listas, para poder ordenar y buscar en Excel.
    if (hoja.rows.length > 0 && hoja.name !== 'Resumen') {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hoja.columns.length },
      };
    }
  });

  return libro;
}

export async function exportToExcel(data, filename) {
  const libro = await buildWorkbook(data);
  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), filename || `AlDia-reporte-${todayStr()}.xlsx`);
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Se libera después, si no algunos navegadores cancelan la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

import { parse as parseCsvSync } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

/**
 * Parse a CSV buffer into a 2D grid of strings (header row included).
 * `columns` is left off so we control header mapping ourselves; blank lines and
 * trailing empty columns are trimmed by the caller.
 */
export function parseCsvGrid(content: Buffer | string): string[][] {
  const records = parseCsvSync(content, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    cast: (value: string) => value,
  }) as unknown[][];

  return records.map((row) => row.map((cell) => stringifyCell(cell)));
}

function stringifyCell(cell: unknown): string {
  if (cell === null || cell === undefined) {
    return '';
  }
  if (typeof cell === 'string') {
    return cell;
  }
  if (
    typeof cell === 'number' ||
    typeof cell === 'boolean' ||
    typeof cell === 'bigint'
  ) {
    return String(cell);
  }
  return '';
}

/**
 * Parse an XLSX buffer into a 2D grid of strings using the first worksheet.
 * Uses `cell.text` so currency-formatted / numeric cells still yield a parseable
 * string for downstream `parseMoney`.
 *
 * NOTE: exceljs' bundled typings declare an ambient `Buffer extends ArrayBuffer`,
 * which clashes with Node's `Buffer<ArrayBufferLike>` under TS 5.x module
 * resolution. We therefore hand it the exact underlying ArrayBuffer slice.
 */
export async function parseXlsxGrid(content: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const grid: string[][] = [];
  worksheet.eachRow((row) => {
    const line: string[] = [];
    for (let col = 1; col <= worksheet.columnCount; col += 1) {
      const text = row.getCell(col).text;
      line.push(typeof text === 'string' ? text : '');
    }
    grid.push(line);
  });

  return grid;
}

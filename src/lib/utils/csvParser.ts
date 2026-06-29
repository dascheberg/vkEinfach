export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: ";" | ",";
}

export function removeBom(text: string): string {
  return text.replace(/^﻿/, "");
}

function detectDelimiter(firstLine: string): ";" | "," {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(rawText: string): ParsedCsv {
  const text = removeBom(rawText);
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));

  if (lines.length === 0) return { headers: [], rows: [], delimiter: ";" };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);
  const rows = lines.slice(1).map((l) => parseLine(l, delimiter));

  return { headers, rows, delimiter };
}

export function applyMapping(
  headers: string[],
  rows: string[][],
  mapping: Record<string, string>
): Record<string, string>[] {
  return rows.map((row) => {
    const result: Record<string, string> = {};
    for (const [appField, csvHeader] of Object.entries(mapping)) {
      if (!csvHeader) continue;
      const colIndex = headers.indexOf(csvHeader);
      result[appField] = colIndex >= 0 ? (row[colIndex] ?? "") : "";
    }
    return result;
  });
}

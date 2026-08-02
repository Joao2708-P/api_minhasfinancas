// Parser de extratos bancários. Suporta CSV e OFX (formatos estruturados).
// PDF NÃO é parseado aqui: não é viável de forma confiável em um Worker;
// nesse caso o arquivo é apenas armazenado no R2 com status 'pending'.

import { toCents } from "./money";

export type StatementFormat = "csv" | "ofx" | "pdf";

// Lançamento normalizado: valor SEMPRE positivo (em centavos); o sinal
// original vira o campo `type`.
export type ParsedEntry = {
    date: Date;
    description: string;
    type: "in" | "out";
    value: number;
};

function stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Converte "1.234,56", "-50,00", "1234.56", "R$ 10,00" -> número (reais).
function parseAmount(raw: string): number | null {
    let s = raw.replace(/[^\d.,-]/g, "").trim();
    if (!s) return null;

    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    if (hasComma && hasDot) {
        // pt-BR: ponto = milhar, vírgula = decimal.
        s = s.replace(/\./g, "").replace(",", ".");
    } else if (hasComma) {
        // Só vírgula: decimal.
        s = s.replace(",", ".");
    }
    // Só ponto (ou nenhum): já está em formato parseável.

    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

// Aceita dd/mm/yyyy, dd/mm/yy, yyyy-mm-dd e yyyymmdd (OFX).
function parseDate(raw: string): Date | null {
    const s = raw.trim();

    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (m) {
        const [, d, mo, y] = m;
        const year = y.length === 2 ? 2000 + Number(y) : Number(y);
        const date = new Date(year, Number(mo) - 1, Number(d));
        return isNaN(date.getTime()) ? null : date;
    }

    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        const [, y, mo, d] = m;
        const date = new Date(Number(y), Number(mo) - 1, Number(d));
        return isNaN(date.getTime()) ? null : date;
    }

    m = s.match(/^(\d{4})(\d{2})(\d{2})/); // OFX DTPOSTED
    if (m) {
        const [, y, mo, d] = m;
        const date = new Date(Number(y), Number(mo) - 1, Number(d));
        return isNaN(date.getTime()) ? null : date;
    }

    return null;
}

// Divide uma linha de CSV respeitando aspas duplas.
function splitCsvLine(line: string, delimiter: string): string[] {
    const fields: string[] = [];
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
            fields.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    fields.push(current);

    return fields.map((f) => f.trim());
}

function toEntry(date: Date, description: string, amount: number): ParsedEntry {
    return {
        date,
        description: description || "Sem descrição",
        type: amount < 0 ? "out" : "in",
        value: Math.abs(toCents(amount)),
    };
}

function parseCsv(content: string): ParsedEntry[] {
    const lines = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    if (lines.length === 0) return [];

    // Delimitador: ';' costuma aparecer em CSV pt-BR; senão ','.
    const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

    // Detecta cabeçalho pela presença de palavras conhecidas.
    const header = splitCsvLine(lines[0], delimiter).map((h) => stripAccents(h.toLowerCase()));
    const dateKeys = ["data", "date"];
    const descKeys = ["descricao", "historico", "description", "memo", "lancamento"];
    const amountKeys = ["valor", "amount", "value", "montante"];

    const findCol = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));

    let idxDate = findCol(dateKeys);
    let idxDesc = findCol(descKeys);
    let idxAmount = findCol(amountKeys);

    let dataLines = lines;

    if (idxDate >= 0 && idxAmount >= 0) {
        // Tem cabeçalho: ignora a primeira linha.
        dataLines = lines.slice(1);
    } else {
        // Sem cabeçalho reconhecido: assume [data, descrição, valor].
        idxDate = 0;
        idxDesc = 1;
        idxAmount = 2;
    }

    const entries: ParsedEntry[] = [];

    for (const line of dataLines) {
        const cols = splitCsvLine(line, delimiter);

        const date = parseDate(cols[idxDate] ?? "");
        const amount = parseAmount(cols[idxAmount] ?? "");
        if (!date || amount === null) continue; // linha inválida é ignorada

        const description = idxDesc >= 0 ? cols[idxDesc] ?? "" : "";
        entries.push(toEntry(date, description, amount));
    }

    return entries;
}

function parseOfx(content: string): ParsedEntry[] {
    const entries: ParsedEntry[] = [];
    const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];

    const tag = (block: string, name: string) => {
        const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
        return m ? m[1].trim() : "";
    };

    for (const block of blocks) {
        const date = parseDate(tag(block, "DTPOSTED"));
        const amount = parseAmount(tag(block, "TRNAMT"));
        if (!date || amount === null) continue;

        const description = tag(block, "MEMO") || tag(block, "NAME");
        entries.push(toEntry(date, description, amount));
    }

    return entries;
}

// Ponto de entrada: escolhe o parser pelo formato.
export function parseStatement(format: StatementFormat, content: string): ParsedEntry[] {
    switch (format) {
        case "csv":
            return parseCsv(content);
        case "ofx":
            return parseOfx(content);
        case "pdf":
        default:
            return []; // PDF não é parseado automaticamente
    }
}

// Detecta o formato pela extensão do arquivo.
export function formatFromFileName(fileName: string): StatementFormat | null {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".csv")) return "csv";
    if (lower.endsWith(".ofx")) return "ofx";
    if (lower.endsWith(".pdf")) return "pdf";
    return null;
}

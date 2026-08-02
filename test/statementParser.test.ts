import { describe, it, expect } from "vitest";
import { parseStatement, formatFromFileName } from "../src/lib/statementParser";

describe("parseStatement - CSV", () => {
    it("parseia CSV com cabeçalho e valores pt-BR (delimitador ;)", () => {
        const csv = [
            "data;descricao;valor",
            "05/05/2026;Salário;5.000,00",
            "10/05/2026;Mercado;-350,50",
        ].join("\n");

        const entries = parseStatement("csv", csv);

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({ description: "Salário", type: "in", value: 500000 });
        expect(entries[1]).toMatchObject({ description: "Mercado", type: "out", value: 35050 });
        expect(entries[0].date.getFullYear()).toBe(2026);
    });

    it("parseia CSV sem cabeçalho assumindo [data, descrição, valor] com delimitador ,", () => {
        const csv = "2026-06-05,Uber,-95.00\n2026-06-06,Reembolso,120.00";

        const entries = parseStatement("csv", csv);

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({ description: "Uber", type: "out", value: 9500 });
        expect(entries[1]).toMatchObject({ description: "Reembolso", type: "in", value: 12000 });
    });

    it("ignora linhas inválidas", () => {
        const csv = "data;descricao;valor\nlinha;quebrada;xx\n01/01/2026;Ok;10,00";
        const entries = parseStatement("csv", csv);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ description: "Ok", value: 1000 });
    });
});

describe("parseStatement - OFX", () => {
    it("parseia blocos STMTTRN", () => {
        const ofx = `
        <OFX><BANKMSGSRSV1><STMTTRNRS><BANKTRANLIST>
        <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260505<TRNAMT>5000.00<MEMO>Salario</STMTTRN>
        <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260510<TRNAMT>-350.50<MEMO>Mercado</STMTTRN>
        </BANKTRANLIST></STMTTRNRS></BANKMSGSRSV1></OFX>`;

        const entries = parseStatement("ofx", ofx);

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({ description: "Salario", type: "in", value: 500000 });
        expect(entries[1]).toMatchObject({ description: "Mercado", type: "out", value: 35050 });
    });
});

describe("parseStatement - PDF", () => {
    it("não parseia PDF (retorna vazio)", () => {
        expect(parseStatement("pdf", "qualquer coisa")).toEqual([]);
    });
});

describe("formatFromFileName", () => {
    it("detecta pela extensão", () => {
        expect(formatFromFileName("extrato.csv")).toBe("csv");
        expect(formatFromFileName("EXTRATO.OFX")).toBe("ofx");
        expect(formatFromFileName("doc.pdf")).toBe("pdf");
        expect(formatFromFileName("imagem.png")).toBeNull();
    });
});

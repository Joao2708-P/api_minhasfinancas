import { describe, it, expect } from "vitest";
import { suggestCategoryId } from "../src/lib/categoryRules";

const categories = [
    { id: "cat_mercado", name: "Mercado" },
    { id: "cat_transporte", name: "Transporte" },
    { id: "cat_lazer", name: "Lazer" },
];

describe("suggestCategoryId", () => {
    it("sugere pela substring, ignorando acento e caixa", () => {
        expect(suggestCategoryId("Compras no MERCADO central", categories)).toBe("cat_mercado");
        expect(suggestCategoryId("uber transporte app", categories)).toBe("cat_transporte");
    });

    it("retorna undefined quando nada casa", () => {
        expect(suggestCategoryId("Pagamento de boleto", categories)).toBeUndefined();
    });

    it("retorna undefined sem descrição", () => {
        expect(suggestCategoryId(undefined, categories)).toBeUndefined();
        expect(suggestCategoryId("", categories)).toBeUndefined();
    });

    it("ignora nomes muito curtos (< 3 chars)", () => {
        expect(suggestCategoryId("no ar", [{ id: "x", name: "ar" }])).toBeUndefined();
    });
});

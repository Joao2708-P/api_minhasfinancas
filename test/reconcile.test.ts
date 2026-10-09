import { describe, it, expect } from "vitest";
import { autoMatch, rankCandidates, typeForDirection, type ReconItem, type ReconTx } from "../src/lib/reconcile";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const tx = (id: string, type: "in" | "out", value: number, date: string): ReconTx => ({ id, type, value, date: day(date) });
const it_ = (id: string, direction: "payable" | "receivable", value: number, due: string): ReconItem => ({
    id, direction, value, dueDate: day(due),
});

describe("typeForDirection", () => {
    it("a pagar ← saída; a receber ← entrada", () => {
        expect(typeForDirection("payable")).toBe("out");
        expect(typeForDirection("receivable")).toBe("in");
    });
});

describe("autoMatch", () => {
    it("casa o par inequívoco (mesmo tipo, valor e dentro da janela)", () => {
        const r = autoMatch([tx("t1", "out", 10000, "2026-10-11")], [it_("c1", "payable", 10000, "2026-10-10")]);
        expect(r.pairs).toEqual([{ txId: "t1", itemId: "c1" }]);
        expect(r.ambiguous).toBe(0);
    });

    it("não casa tipo errado, valor diferente ou fora da janela", () => {
        const items = [it_("c1", "payable", 10000, "2026-10-10")];
        expect(autoMatch([tx("t1", "in", 10000, "2026-10-10")], items).pairs).toEqual([]);
        expect(autoMatch([tx("t1", "out", 10001, "2026-10-10")], items).pairs).toEqual([]);
        expect(autoMatch([tx("t1", "out", 10000, "2026-10-20")], items).pairs).toEqual([]);
    });

    it("transação com dois compromissos compatíveis é ambígua", () => {
        const r = autoMatch(
            [tx("t1", "out", 10000, "2026-10-10")],
            [it_("c1", "payable", 10000, "2026-10-09"), it_("c2", "payable", 10000, "2026-10-11")],
        );
        expect(r.pairs).toEqual([]);
        expect(r.ambiguous).toBe(1);
    });

    it("duas transações iguais disputando o mesmo compromisso: nenhuma baixa (antes a 1ª ganhava)", () => {
        const r = autoMatch(
            [tx("t1", "out", 10000, "2026-10-10"), tx("t2", "out", 10000, "2026-10-11")],
            [it_("c1", "payable", 10000, "2026-10-10")],
        );
        expect(r.pairs).toEqual([]);
        expect(r.ambiguous).toBe(2);
    });

    it("pareia vários pares independentes no mesmo lote", () => {
        const r = autoMatch(
            [tx("t1", "out", 5000, "2026-10-05"), tx("t2", "in", 8000, "2026-10-06")],
            [it_("c1", "payable", 5000, "2026-10-05"), it_("c2", "receivable", 8000, "2026-10-07")],
        );
        expect(r.pairs).toEqual([
            { txId: "t1", itemId: "c1" },
            { txId: "t2", itemId: "c2" },
        ]);
    });
});

describe("rankCandidates", () => {
    const item = it_("c1", "payable", 10000, "2026-10-10");

    it("valor exato primeiro, depois menor diferença de valor, depois de data", () => {
        const r = rankCandidates(item, [
            tx("a", "out", 10500, "2026-10-10"), // +5%
            tx("b", "out", 10000, "2026-10-14"), // exato, 4 dias
            tx("c", "out", 10000, "2026-10-11"), // exato, 1 dia
            tx("d", "out", 10200, "2026-10-10"), // +2%
        ]);
        expect(r.map((s) => s.id)).toEqual(["c", "b", "d", "a"]);
        expect(r[0]).toMatchObject({ exact: true, dayDiff: 1, valueDiff: 0 });
    });

    it("descarta tipo errado, fora da tolerância e fora da janela", () => {
        const r = rankCandidates(item, [
            tx("in", "in", 10000, "2026-10-10"),
            tx("caro", "out", 12000, "2026-10-10"),  // +20% > 10%
            tx("longe", "out", 10000, "2026-11-30"),
        ]);
        expect(r).toEqual([]);
    });
});

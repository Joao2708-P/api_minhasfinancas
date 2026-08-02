import { describe, it, expect } from "vitest";
import { goalProgress } from "../src/services/goal.service";

describe("goalProgress", () => {
    it("calcula progresso e valor restante", () => {
        expect(goalProgress(1000000, 250000)).toEqual({ progress: 0.25, remaining: 750000 });
    });

    it("limita o progresso em 1 e o restante em 0 quando já atingiu", () => {
        expect(goalProgress(1000, 5000)).toEqual({ progress: 1, remaining: 0 });
    });

    it("trata alvo zero sem dividir por zero", () => {
        expect(goalProgress(0, 100)).toEqual({ progress: 0, remaining: 0 });
    });
});

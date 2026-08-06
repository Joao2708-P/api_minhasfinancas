import { describe, it, expect } from "vitest";
import { goalProgress } from "../src/services/goal.service";

describe("goalProgress", () => {
    it("calcula progresso, restante, percentual e se atingiu", () => {
        expect(goalProgress(1000000, 250000)).toEqual({
            progress: 0.25,
            remaining: 750000,
            percent: 25,
            reached: false,
        });
    });

    it("limita o progresso em 1 e o restante em 0 quando já atingiu", () => {
        expect(goalProgress(1000, 5000)).toEqual({
            progress: 1,
            remaining: 0,
            percent: 100,
            reached: true,
        });
    });

    it("trata alvo zero sem dividir por zero", () => {
        expect(goalProgress(0, 100)).toEqual({
            progress: 0,
            remaining: 0,
            percent: 0,
            reached: false,
        });
    });
});

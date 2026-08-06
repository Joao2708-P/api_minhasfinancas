import { Hono } from "hono";
import { calculatorController } from "../controllers/calculator.controller";
import type { AppEnv } from "../types";

export const calculatorRoute = new Hono<AppEnv>();

// Simulações financeiras (cálculo puro, sem tenant). Montadas sob authGuard.
calculatorRoute.post("/compound-interest", calculatorController.compoundInterest);
calculatorRoute.post("/loan", calculatorController.loan);
calculatorRoute.post("/goal-contribution", calculatorController.goalContribution);
calculatorRoute.post("/months-to-goal", calculatorController.monthsToGoal);

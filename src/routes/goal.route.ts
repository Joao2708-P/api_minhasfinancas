import { Hono } from "hono";
import { goalController } from "../controllers/goal.controller";
import type { AppEnv } from "../types";

export const goalRoute = new Hono<AppEnv>();

goalRoute.get("/", goalController.listGoals);
goalRoute.post("/", goalController.createGoal);
goalRoute.get("/:id", goalController.getGoalById);
goalRoute.put("/:id", goalController.updateGoal);
goalRoute.delete("/:id", goalController.deleteGoal);

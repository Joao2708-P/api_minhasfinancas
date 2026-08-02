import { Hono } from "hono";
import { goalController } from "../controllers/goal.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const goalRoute = new Hono<AppEnv>();

goalRoute.get("/", requirePermission("finance:read"), goalController.listGoals);
goalRoute.post("/", requirePermission("finance:write"), goalController.createGoal);
goalRoute.get("/:id", requirePermission("finance:read"), goalController.getGoalById);
goalRoute.put("/:id", requirePermission("finance:write"), goalController.updateGoal);
goalRoute.delete("/:id", requirePermission("finance:write"), goalController.deleteGoal);

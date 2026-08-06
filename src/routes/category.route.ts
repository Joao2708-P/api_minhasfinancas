import { Hono } from "hono";
import { categoryController } from "../controllers/category.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const categoryRoute = new Hono<AppEnv>();

categoryRoute.get("/", requirePermission("finance:read"), categoryController.listCategories);
categoryRoute.post("/", requirePermission("finance:write"), categoryController.createCategory);
categoryRoute.get("/:id", requirePermission("finance:read"), categoryController.getCategoryById);
categoryRoute.put("/:id", requirePermission("finance:write"), categoryController.updateCategory);
categoryRoute.delete("/:id", requirePermission("finance:write"), categoryController.deleteCategory);

import { Hono } from "hono";
import { categoryController } from "../controllers/category.controller";
import type { AppEnv } from "../types";

export const categoryRoute = new Hono<AppEnv>()

categoryRoute.get('/', categoryController.listCategories);
categoryRoute.post('/', categoryController.createCategory);
categoryRoute.get('/:id', categoryController.getCategoryById);
categoryRoute.put('/:id', categoryController.updateCategory);
categoryRoute.delete('/:id', categoryController.deleteCategory);

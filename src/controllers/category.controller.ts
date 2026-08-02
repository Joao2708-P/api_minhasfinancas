import type { Context } from "hono";
import { createCategorySchema, updateCategorySchema } from "../schemas/category.schema";
import { CategoryService } from "../services/category.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv } from "../types";

export const categoryController = {
    async listCategories(c: Context<AppEnv>) {
        // O usuário vem do token, não mais de ?userId (evita vazar dados de terceiros).
        const categories = await CategoryService.listByUser(c.get("db"), c.get("userId"));
        return c.json(categories);
    },

    async getCategoryById(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const category = await CategoryService.findByIdOwned(c.get("db"), c.get("userId"), id);
        if (!category) throw new NotFoundError("Categoria");

        return c.json(category);
    },

    async createCategory(c: Context<AppEnv>) {
        const body = createCategorySchema.parse(await c.req.json());

        const category = await CategoryService.create(c.get("db"), c.get("userId"), body);
        return c.json(category, 201);
    },

    async updateCategory(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updateCategorySchema.parse(await c.req.json());

        const existing = await CategoryService.findByIdOwned(c.get("db"), c.get("userId"), id);
        if (!existing) throw new NotFoundError("Categoria");

        const category = await CategoryService.update(c.get("db"), c.get("userId"), id, body);
        return c.json(category);
    },

    async deleteCategory(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const categoryDelete = await CategoryService.delete(c.get("db"), c.get("userId"), id);
        if (!categoryDelete) throw new NotFoundError("Categoria");

        return c.json(categoryDelete);
    },
};

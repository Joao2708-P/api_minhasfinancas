import type { Context } from "hono";
import { createCategorySchema, updateCategorySchema } from "../schemas/category.schema";
import { CategoryService } from "../services/category.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

export const categoryController = {
    async listCategories(c: Context<AppEnv>) {
        const categories = await CategoryService.listByScope(c.get("db"), scopeOf(c));
        return c.json(categories);
    },

    async getCategoryById(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const category = await CategoryService.findByIdOwned(c.get("db"), scopeOf(c), id);
        if (!category) throw new NotFoundError("Categoria");

        return c.json(category);
    },

    async createCategory(c: Context<AppEnv>) {
        const body = createCategorySchema.parse(await c.req.json());

        const category = await CategoryService.create(c.get("db"), scopeOf(c), body, c.get("userId"));
        return c.json(category, 201);
    },

    async updateCategory(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updateCategorySchema.parse(await c.req.json());
        const s = scopeOf(c);

        const existing = await CategoryService.findByIdOwned(c.get("db"), s, id);
        if (!existing) throw new NotFoundError("Categoria");

        const category = await CategoryService.update(c.get("db"), s, id, body, c.get("userId"));
        return c.json(category);
    },

    async deleteCategory(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const categoryDelete = await CategoryService.delete(c.get("db"), scopeOf(c), id, c.get("userId"));
        if (!categoryDelete) throw new NotFoundError("Categoria");

        return c.json(categoryDelete);
    },
};

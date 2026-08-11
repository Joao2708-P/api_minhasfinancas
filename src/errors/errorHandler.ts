import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "./errors";

export const errorHandler: ErrorHandler = (err, c)  => {
    if(err instanceof ZodError) {
        // Detalha quais campos falharam. Sem isto o cliente só recebe "Dados
        // inválidos" e não sabe o que corrigir. `message` já traz as mensagens
        // (o front exibe `error.message` direto); `fields` carrega o path por campo.
        const fields = err.issues.map((issue) => ({
            field: issue.path.join('.') || '(raiz)',
            message: issue.message,
        }))
        const message = fields.map((f) => f.message).join('; ') || 'Dados inválidos'
        return c.json(
            {
                error: {
                    code: 'VALIDATION_ERROR',
                    message,
                    fields,
                },
            },
            400
        )
    }

    if(err instanceof AppError) {
        return c.json(
            {
                error: {
                    code: err.code,
                    message: err.message
                },
            },
            err.statusCode as 400
        )
    }

    console.log(err);

    return c.json(
        {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Erro interno no servidor'
            },
        },
        500
    )
}
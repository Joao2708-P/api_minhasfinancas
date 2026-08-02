import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { AppError } from "./errors";

export const errorHandler: ErrorHandler = (err, c)  => {
    if(err instanceof ZodError) {
        return c.json(
            {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Dados inválidos',

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
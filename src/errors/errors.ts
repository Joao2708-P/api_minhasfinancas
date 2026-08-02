export class AppError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public code: string = 'INTERNAL_ERROR'
    ) {
        super(message);
        this.name = 'AppError'
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} não encontrado`, 404, 'NOT_FOUND');
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Não Autorizado') {
        super(message, 401, 'UNAUTHORIZED')
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Acesso negado') {
        super(message, 403, 'FORBIDDEN')
    }
}

export class BadRequestError extends AppError {
    constructor(message: string) {
        super(message, 400, 'BAD_REQUEST')
    }
}
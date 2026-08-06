import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { createDb } from './database'
import { errorHandler } from './errors/errorHandler'
import { routes } from './routes'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

// Middlewares globais de segurança/observabilidade.
app.use('*', logger())
app.use('*', secureHeaders())

// CORS por allowlist (não mais aberto a qualquer origem). As origens vêm de
// CORS_ORIGINS (CSV); sem isso, cai no allowlist de dev (Vite). É essencial
// liberar os headers de tenant no preflight, senão o front não consegue enviá-los.
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:4173']
app.use('*', cors({
    origin: (origin, c) => {
        const configured = (c.env.CORS_ORIGINS ?? '')
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        const allowlist = configured.length ? configured : DEV_ORIGINS
        return allowlist.includes(origin) ? origin : null
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'X-Cliente-Id'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
}))

// Cria a instância do Drizzle por request e guarda no contexto.
app.use('*', async (c, next) => {
    c.set('db', createDb(c.env.DB))
    await next()
})

app.onError(errorHandler)

app.route('/', routes)

app.get('/', (c) => c.json({ name: 'Minhas Finanças API', status: 'ok' }))

export default app

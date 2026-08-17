import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { createDb } from './database'
import { errorHandler } from './errors/errorHandler'
import { getAllowedOrigins } from './lib/allowlist'
import { originGuard } from './middlewares/originGuard'
import { routes } from './routes'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

// Middlewares globais de segurança/observabilidade.
app.use('*', logger())
app.use('*', secureHeaders())

// CORS por allowlist (não mais aberto a qualquer origem). As origens vêm de
// CORS_ORIGINS (CSV); sem isso, cai no allowlist de dev (Vite). É essencial
// liberar os headers de tenant no preflight, senão o front não consegue enviá-los.
// `credentials: true` permite o cookie de sessão cross-site.
app.use('*', cors({
    origin: (origin, c) => {
        return getAllowedOrigins(c.env).includes(origin) ? origin : null
    },
    allowHeaders: ['Content-Type', 'Authorization', 'X-Org-Id', 'X-Cliente-Id'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
}))

// Proteção CSRF: com o token em cookie SameSite=None, exige Origin válida nos
// métodos de escrita (ver middlewares/originGuard.ts).
app.use('*', originGuard)

// Cria a instância do Drizzle por request e guarda no contexto.
app.use('*', async (c, next) => {
    c.set('db', createDb(c.env.DB))
    await next()
})

app.onError(errorHandler)

app.route('/', routes)

app.get('/', (c) => c.json({ name: 'Metria Finanças API', status: 'ok' }))

export default app

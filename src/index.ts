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
app.use('*', cors())

// Cria a instância do Drizzle por request e guarda no contexto.
app.use('*', async (c, next) => {
    c.set('db', createDb(c.env.DB))
    await next()
})

app.onError(errorHandler)

app.route('/', routes)

app.get('/', (c) => c.json({ name: 'Minhas Finanças API', status: 'ok' }))

export default app

require('dotenv').config()
const fastify = require('fastify')
const { initSchema } = require('./db')
const accountRoutes = require('./routes/accounts')
const transactionRoutes = require('./routes/transactions')

function buildApp() {
  const app = fastify({ logger: true, ajv: { customOptions: { multipleOfPrecision: 2, removeAdditional: false } } })

  app.setErrorHandler((err, request, reply) => {
    if (err.validation) {
      return reply.code(400).send({ error: err.message })
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message })
    }
    request.log.error(err)
    reply.code(500).send({ error: 'Internal server error' })
  })

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: 'Route not found' })
  })

  app.register(accountRoutes)
  app.register(transactionRoutes)
  return app
}

async function start() {
  await initSchema()
  const app = buildApp()
  await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})

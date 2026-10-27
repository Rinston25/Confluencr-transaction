const { pool } = require('../db')

const idParams = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id']
}

const createBody = {
  type: 'object',
  properties: { name: { type: 'string', minLength: 1 } },
  required: ['name'],
  additionalProperties: false
}

async function createAccount(request, reply) {
  const name = request.body.name.trim()
  if (!name) {
    return reply.code(400).send({ error: 'name must not be empty' })
  }
  const { rows } = await pool.query(
    'INSERT INTO accounts (name) VALUES ($1) RETURNING id, name, balance, created_at',
    [name]
  )
  reply.code(201).send(rows[0])
}

async function getAccount(request, reply) {
  const { rows } = await pool.query(
    'SELECT id, name, balance, created_at FROM accounts WHERE id = $1',
    [request.params.id]
  )
  if (rows.length === 0) {
    return reply.code(404).send({ error: 'Account not found' })
  }
  reply.send(rows[0])
}

async function accountRoutes(app) {
  app.post('/accounts', { schema: { body: createBody } }, createAccount)
  app.get('/accounts/:id', { schema: { params: idParams } }, getAccount)
}

module.exports = accountRoutes

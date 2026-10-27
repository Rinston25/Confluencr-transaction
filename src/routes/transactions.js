const { pool } = require('../db')

const idParams = {
  type: 'object',
  properties: { id: { type: 'string', format: 'uuid' } },
  required: ['id']
}

const createBody = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['credit', 'debit'] },
    amount: { type: 'number', minimum: 0.01, maximum: 9999999999999, multipleOf: 0.01 },
    description: { type: 'string' },
    reference_id: { type: 'string', minLength: 1 }
  },
  required: ['type', 'amount', 'reference_id'],
  additionalProperties: false
}

const listQuery = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    offset: { type: 'integer', minimum: 0, default: 0 }
  }
}

function httpError(statusCode, message) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

async function applyTransaction(client, accountId, body) {
  const account = await client.query('SELECT balance FROM accounts WHERE id = $1 FOR UPDATE', [accountId])
  if (account.rows.length === 0) {
    throw httpError(404, 'Account not found')
  }
  const existing = await client.query(
    'SELECT id FROM transactions WHERE account_id = $1 AND reference_id = $2',
    [accountId, body.reference_id]
  )
  if (existing.rows.length > 0) {
    throw httpError(409, 'Duplicate reference_id')
  }
  if (body.type === 'debit' && account.rows[0].balance < body.amount) {
    throw httpError(422, 'Insufficient balance')
  }
  const inserted = await client.query(
    `INSERT INTO transactions (account_id, type, amount, description, reference_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, account_id, type, amount, description, reference_id, created_at`,
    [accountId, body.type, body.amount, body.description || null, body.reference_id]
  )
  const sign = body.type === 'credit' ? 1 : -1
  const updated = await client.query(
    'UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING balance',
    [sign * body.amount, accountId]
  )
  return { ...inserted.rows[0], balance: updated.rows[0].balance }
}

async function createTransaction(request, reply) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await applyTransaction(client, request.params.id, request.body)
    await client.query('COMMIT')
    reply.code(201).send(result)
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      throw httpError(409, 'Duplicate reference_id')
    }
    throw err
  } finally {
    client.release()
  }
}

async function listTransactions(request, reply) {
  const { id } = request.params
  const { limit, offset } = request.query
  const account = await pool.query('SELECT id FROM accounts WHERE id = $1', [id])
  if (account.rows.length === 0) {
    return reply.code(404).send({ error: 'Account not found' })
  }
  const { rows } = await pool.query(
    `SELECT id, account_id, type, amount, description, reference_id, created_at
     FROM transactions WHERE account_id = $1
     ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [id, limit, offset]
  )
  reply.send(rows)
}

async function transactionRoutes(app) {
  app.post('/accounts/:id/transactions', { schema: { params: idParams, body: createBody } }, createTransaction)
  app.get('/accounts/:id/transactions', { schema: { params: idParams, querystring: listQuery } }, listTransactions)
}

module.exports = transactionRoutes

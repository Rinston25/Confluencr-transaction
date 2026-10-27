require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Pool, types } = require('pg')

types.setTypeParser(1700, (value) => Number(value))

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')
  await pool.query(sql)
}

module.exports = { pool, initSchema }

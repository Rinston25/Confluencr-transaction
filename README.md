# Transaction Ledger API

A small REST API for accounts and credit/debit transactions with a balance that never goes negative.

## Tech stack

- Node.js 20+ (CommonJS), Fastify
- PostgreSQL via `pg` (plain SQL)
- dotenv, docker-compose (Postgres only), Bruno

## Folder structure

```
src/
  app.js              server setup, error handler, startup
  db.js               pg pool and schema loader
  routes/
    accounts.js       account endpoints
    transactions.js   transaction endpoints
bruno/                Bruno collection
schema.sql            tables and index (run on startup)
docker-compose.yml    local Postgres
```

## Setup

```
git clone https://github.com/Rinston25/Confluencr-transaction.git
cd Confluencr-transaction
cp .env.example .env
docker compose up -d
npm install
npm start
```

The API runs on http://localhost:3000. `schema.sql` is applied automatically on startup.

`npm run dev` restarts on file changes.

## Conventions

- Money (`amount`, `balance`) is returned as a JSON **number**, e.g. `59.5`.
- Errors always look like `{ "error": "message" }`.
- Status codes: 400 validation, 404 not found, 409 duplicate, 422 insufficient balance, 500 unexpected.

## Endpoints

### POST /accounts

Only `name` is accepted; any other field returns 400.

```
{ "name": "Rinston" }
```
201:
```
{ "id": "561719e4-300b-4248-8a6e-afffc7e47c44", "name": "Rinston", "balance": 0, "created_at": "2026-10-27T14:10:56.449Z" }
```

### GET /accounts/:id

200 with the account, 404 if missing, 400 if `id` is not a UUID.

### POST /accounts/:id/transactions

`amount` must be greater than 0 with at most 2 decimal places.

```
{ "type": "debit", "amount": 40.5, "description": "Payment", "reference_id": "ref-002" }
```
201:
```
{
  "id": "131e98ba-9e08-40b3-83c0-c85923176bd1",
  "account_id": "561719e4-300b-4248-8a6e-afffc7e47c44",
  "type": "debit",
  "amount": 40.5,
  "description": "Payment",
  "reference_id": "ref-002",
  "created_at": "2026-10-27T14:10:57.933Z",
  "balance": 59.5
}
```

- 422 `{ "error": "Insufficient balance" }` when a debit exceeds the balance (nothing is saved)
- 409 `{ "error": "Duplicate reference_id" }` when the account already used that `reference_id`

### GET /accounts/:id/transactions?limit=20&offset=0

Newest first. `limit` defaults to 20 (max 100), `offset` defaults to 0. 404 if the account does not exist.

```
[
  { "id": "...", "account_id": "...", "type": "debit", "amount": 40.5, "description": "Payment", "reference_id": "ref-002", "created_at": "..." }
]
```

## Design decisions

- **Row lock for concurrency:** each transaction runs in one DB transaction that starts with `SELECT ... FOR UPDATE` on the account, so concurrent requests on the same account are serialised and the balance can never go negative.
- **NUMERIC for money:** `NUMERIC(15,2)` avoids floating point errors in storage and arithmetic.
- **Unique `(account_id, reference_id)`:** gives idempotency per account; the same `reference_id` can be used on different accounts.
- **Balance stored on the account:** it is updated in the same DB transaction as the transaction insert, so the two always agree and reads are cheap. A `CHECK (balance >= 0)` is a last line of defence.

## Known limitations

- Fastify's default type coercion is on, so `"amount": "50"` is accepted and treated as 50.
- `amount` is capped at 9999999999999, but repeated credits can still push the balance past `NUMERIC(15,2)`, which returns a 500.
- `name` has no maximum length.

## Bruno collection

1. Install [Bruno](https://www.usebruno.com/).
2. Open Bruno, choose **Open Collection** and select the `bruno` folder.
3. Select the **local** environment (top right).
4. Run the requests in order (or right click the collection and choose **Run**). `Create Account` stores the new id in `accountId`, which the other requests use.

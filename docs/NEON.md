# Neon database setup

The Neon project for Between is named `between-tutor-agent` and is hosted in
`aws-eu-central-1` (Frankfurt). It uses PostgreSQL 17.

## Local configuration

In the ignored root `env` file, add the connection string from the Neon CLI or
Neon Console. Never commit this value.

```dotenv
DATABASE_URL=postgresql://between_owner:...@.../between?sslmode=require
```

The official driver is already installed in `agent-core`:

```bash
npm install @neondatabase/serverless --workspace agent-core
```

## Schema

`packages/agent-core/sql/001_initial.sql` is the initial schema. It stores:

- tutors and their Telegram chat IDs;
- students, scoped to a tutor;
- append-only plan versions and attempts;
- processed Telegram update IDs for atomic deduplication; and
- one compressed-demo clock per tutor.

The schema intentionally preserves the backend's product invariants: a plan
revision inserts a new version, completed evidence remains literal, and a
duplicate Telegram update cannot create a second student turn.

## Migration

Use a privileged local connection only. Run the SQL file against the Neon
`between` database once, then verify the six tables exist:

```bash
npx neonctl@latest psql --project-id ancient-butterfly-21489681 --database-name between --role-name between_owner -- -f packages/agent-core/sql/001_initial.sql
```

The initial migration was applied when the project was created. The command is
safe to re-run because every object uses `IF NOT EXISTS`. Do not paste the
connection string into a tracked file.

To copy the current local rehearsal state into Neon, run:

```bash
npm run db:migrate:json
```

This is idempotent and keeps append-only plan and attempt history intact.

## Application migration

The live hackathon demo retains `.data/between.json` while its synchronous
store surface is converted to asynchronous database calls. Do not deploy the
panel and Telegram channel to separate hosts until that conversion is complete:
they must share this Neon database, not a local file.

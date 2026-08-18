# Local deployment record

## Verified environment

- Windows with WSL 2
- 8 logical CPU threads
- 16 GB physical memory
- Docker Desktop 29.6.2
- Dify 1.16.1, pinned to upstream commit `6f8ed69`

## Verification completed

- PostgreSQL healthy
- Redis healthy
- Dify API healthy
- local agent sandbox healthy
- plugin database migration completed
- `http://localhost` returned HTTP 200

## Initial resource snapshot

At idle shortly after first startup, the Dify containers used approximately 2.5 GiB of memory in total. Docker Desktop was configured with about 7.65 GiB available to Linux containers. Docker images occupied 13.81 GB across the machine; that figure also includes images from another existing local project, so it is not attributed entirely to Dify.

This leaves enough room for workflow and RAG development, but a local LLM should be tested separately and with a small model because Dify, another existing container stack, and the model would otherwise compete for memory.

## First-start observation

PostgreSQL was temporarily reported as unhealthy while its initial data directory was being created and synchronized. Dependent containers retried automatically. Logs later showed that PostgreSQL accepted connections, the plugin database was created, migrations completed, and the application became healthy.

This was treated as an initialization delay rather than a configuration defect because the database process remained alive and progressed through `initdb`, shutdown, final startup, and readiness in sequence.

## Local-only security boundary

The runtime configuration lives under `.runtime/`, is ignored by Git, and contains a non-empty local `SECRET_KEY`. The current deployment is intended for local development and is not exposed to the public internet.

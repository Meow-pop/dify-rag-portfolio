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
- `http://127.0.0.1` returned HTTP 200

The generated runtime sets `NEXT_PUBLIC_SOCKET_URL=ws://127.0.0.1` so the
workflow collaboration WebSocket uses the same host as the console. Keeping
these hosts identical is required for the browser to send the local login
cookie and for workflow edits to auto-save.

## Initial resource snapshot

At idle shortly after first startup, the Dify containers used approximately 2.5 GiB of memory in total. Docker Desktop was configured with about 7.65 GiB available to Linux containers. Docker images occupied 13.81 GB across the machine; that figure also includes images from another existing local project, so it is not attributed entirely to Dify.

This leaves enough room for workflow and RAG development, but a local LLM should be tested separately and with a small model because Dify, another existing container stack, and the model would otherwise compete for memory.

## Local embedding service

Ollama runs as an additional service in the same Docker Compose network as
Dify. It stores downloaded models in the named `ollama_data` volume and does
not publish port 11434 to Windows, the LAN, or the public internet. Dify reaches
it through the internal address `http://ollama:11434`.

The initial embedding model is `qwen3-embedding:0.6b`. Generation still uses
the configured DeepSeek API; only document and query vectorization happens
locally. This hybrid layout keeps the first portfolio version responsive while
demonstrating a private, self-hosted embedding path.

In Dify, the Ollama provider uses the Docker-internal base URL above and the
model type `Text Embedding`. The sample knowledge base is named
`星桥优选电商知识库` and contains the four Markdown files under
`sample-data/xingqiao-commerce/`. Its first retrieval check used the query
`新疆订单购买恒温杯，总金额199元，需要多少运费？`; the top results correctly
retrieved the 20-yuan shipping rule from both the FAQ and product manual.

## First-start observation

PostgreSQL was temporarily reported as unhealthy while its initial data directory was being created and synchronized. Dependent containers retried automatically. Logs later showed that PostgreSQL accepted connections, the plugin database was created, migrations completed, and the application became healthy.

This was treated as an initialization delay rather than a configuration defect because the database process remained alive and progressed through `initdb`, shutdown, final startup, and readiness in sequence.

## Local-only security boundary

The runtime configuration lives under `.runtime/`, is ignored by Git, and contains a non-empty local `SECRET_KEY`. The current deployment is intended for local development and is not exposed to the public internet.

The tracked Compose override publishes the Dify Web interface and plugin debugging endpoint on `127.0.0.1` only. The unused HTTPS host mapping is removed. This avoids relying solely on Windows Firewall to prevent direct LAN access.

Always use `scripts\Start-Dify.ps1` and `scripts\Stop-Dify.ps1`, because those scripts load both the upstream Compose file and the local security override. Run `scripts\Test-LocalSecurity.ps1` after deployment changes to verify host bindings, the local secret, Git ignore coverage, and HTTP availability.

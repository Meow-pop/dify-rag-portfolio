# Architecture

## Initial local architecture

```text
Browser
  |
  v
Dify Web / API
  |-- PostgreSQL: application metadata
  |-- Redis: cache and task coordination
  |-- Vector store: document embeddings
  |-- Plugin daemon: model and tool integrations
  |
  +--> Cloud model API (development mode)
  |
  +--> Ollama qwen3-embedding:0.6b (Docker-internal embedding service)
```

## Planned RAG request path

```text
Question
  -> query normalization
  -> vector and keyword retrieval
  -> optional reranking
  -> context assembly
  -> LLM generation
  -> answer with source citations
  -> feedback and evaluation log
```

The first implementation is hybrid: Ollama creates embeddings locally, while
DeepSeek generates the final answer. Ollama has no published host port; Dify
connects to it at `http://ollama:11434` inside the Compose network.

## Why this repository wraps upstream Dify

The upstream source is checked out at a pinned release under `.runtime/`. This keeps the portfolio repository small, prevents accidental edits to generated deployment files, and makes the exact upstream version explicit.

Custom ingestion, evaluation, workflow exports and deployment notes will live in this repository and remain separate from the upstream platform.

---
title: "Ollama"
description: "Run local AI models with Ollama for zero per-token cost."
---

# Ollama

Ollama lets you run open-source LLMs locally. Ideal for self-hosted Overlay deployments that need to avoid external AI API costs.

## Prerequisites

- Linux/macOS server with 8+ GB RAM
- Docker (recommended) or native Ollama install

## Quick Start

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:8b

# Start the server
ollama serve
```

## Docker

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 \
  --name ollama ollama/ollama
```

## Configure Overlay

Add to `overlay.config.json`:

```json
{
  "ai": {
    "gateway": "ollama",
    "ollama": {
      "baseUrl": "http://localhost:11434",
      "defaultModel": "llama3.1:8b"
    }
  }
}
```

## Recommended Models

| Model | Size | Use Case |
|-------|------|----------|
| `llama3.1:8b` | 8B | Fast, good for chat |
| `llama3.1:70b` | 70B | High quality, slower |
| `mistral:7b` | 7B | Balanced speed/quality |
| `codellama:34b` | 34B | Code generation |

## GPU Support

For best performance, run Ollama on a GPU:

```bash
docker run -d --gpus all -v ollama:/root/.ollama -p 11434:11434 \
  ollama/ollama
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Slow responses | Use a GPU or smaller model |
| Model not found | Run `ollama pull <model>` first |
| Connection refused | Ensure Ollama is running: `ollama serve` |

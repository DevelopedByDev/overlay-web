---
title: "vLLM"
description: "High-throughput model serving with vLLM."
---

# vLLM

vLLM is a high-throughput inference engine for serving open-source LLMs. Use it when you need to serve models at scale with PagedAttention for efficient memory usage.

## Prerequisites

- NVIDIA GPU with 16+ GB VRAM
- CUDA 12.1+

## Quick Start

```bash
# Install vLLM
pip install vllm

# Start server
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3.1-8B-Instruct \
  --tensor-parallel-size 1 \
  --port 8000
```

## Docker

```bash
docker run --runtime nvidia --gpus all \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model meta-llama/Meta-Llama-3.1-8B-Instruct
```

## Configure Overlay

Add to `overlay.config.json`:

```json
{
  "ai": {
    "gateway": "vllm",
    "vllm": {
      "baseUrl": "http://localhost:8000/v1",
      "defaultModel": "meta-llama/Meta-Llama-3.1-8B-Instruct"
    }
  }
}
```

## Multi-GPU

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3.1-70B-Instruct \
  --tensor-parallel-size 4 \
  --port 8000
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OOM errors | Reduce `--max-model-len` or use `-- quantization awq` |
| Slow first request | Pre-load model with `--enforce-eager` |

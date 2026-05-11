---
title: "MinIO"
description: "Self-hosted S3-compatible object storage with MinIO."
---

# MinIO

MinIO is the recommended storage backend for self-hosted Overlay. It provides S3-compatible APIs with no external dependencies.

## Quick Start

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -v minio_data:/data \
  -e MINIO_ROOT_USER=overlay \
  -e MINIO_ROOT_PASSWORD=strong-password \
  minio/minio server /data --console-address ":9001"
```

## Configure Overlay

Add to `.env.local`:

```bash
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=overlay
S3_SECRET_ACCESS_KEY=strong-password
S3_BUCKET_NAME=overlay-files
S3_REGION=us-east-1
```

## Create Bucket

```bash
mc alias set local http://localhost:9000 overlay strong-password
mc mb local/overlay-files
mc anonymous set download local/overlay-files
```

## Console

Access the MinIO Console at `http://localhost:9001` with the root credentials.

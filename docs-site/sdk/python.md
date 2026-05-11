---
title: "Python SDK"
description: "Patterns for integrating with Overlay from Python."
---

# Python SDK

Overlay does not ship a dedicated Python SDK. Use `httpx` or `requests` with the patterns below.

## Client Setup

```python
import httpx

BASE_URL = "https://overlay.yourcompany.com"

class OverlayClient:
    def __init__(self, base_url: str, api_key: str = None):
        self.client = httpx.Client(base_url=base_url)
        self.api_key = api_key

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def get(self, path: str):
        return self.client.get(f"/api{path}", headers=self._headers())

    def post(self, path: str, json: dict = None):
        return self.client.post(f"/api{path}", headers=self._headers(), json=json)
```

## Bootstrap

```python
client = OverlayClient(BASE_URL, api_key="your-token")
bootstrap = client.get("/app/bootstrap").json()
print(bootstrap["user"], bootstrap["entitlements"])
```

## Ask (Streaming)

```python
with httpx.stream(
    "POST",
    f"{BASE_URL}/api/app/conversations/ask",
    headers=client._headers(),
    json={"conversationId": "abc", "message": "Hello", "modelId": "claude-sonnet-4-6"},
) as response:
    for chunk in response.iter_text():
        print(chunk, end="")
```

## Async

```python
import httpx

async with httpx.AsyncClient(base_url=BASE_URL) as client:
    bootstrap = await client.get("/api/app/bootstrap")
    print(bootstrap.json())
```

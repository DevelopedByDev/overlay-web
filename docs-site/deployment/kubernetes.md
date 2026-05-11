---
title: "Kubernetes"
description: "Deploy Overlay on Kubernetes."
---

# Kubernetes Deployment

For enterprises that already run on Kubernetes. Includes manifests, resource recommendations, and horizontal pod autoscaling.

## Namespace

```bash
kubectl create namespace overlay
```

## Secret

```bash
kubectl create secret generic overlay-secrets \
  --from-literal=SESSION_SECRET=$(openssl rand -hex 32) \
  --from-literal=INTERNAL_API_SECRET=$(openssl rand -hex 32) \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="redis://..." \
  --namespace overlay
```

## Deployment

```yaml
# k8s/app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: overlay-app
  namespace: overlay
spec:
  replicas: 2
  selector:
    matchLabels:
      app: overlay-app
  template:
    metadata:
      labels:
        app: overlay-app
    spec:
      containers:
        - name: app
          image: ghcr.io/getoverlay/overlay:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: overlay-secrets
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: 2000m
              memory: 4Gi
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: overlay-app
  namespace: overlay
spec:
  selector:
    app: overlay-app
  ports:
    - port: 80
      targetPort: 3000
```

## Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: overlay-ingress
  namespace: overlay
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
    - hosts:
        - overlay.yourcompany.com
      secretName: overlay-tls
  rules:
    - host: overlay.yourcompany.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: overlay-app
                port:
                  number: 80
```

## Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: overlay-app-hpa
  namespace: overlay
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: overlay-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## AI Worker Deployment

For high-volume AI inference, run a separate worker pool:

```yaml
# k8s/ai-worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: overlay-ai-worker
  namespace: overlay
spec:
  replicas: 3
  selector:
    matchLabels:
      app: overlay-ai-worker
  template:
    metadata:
      labels:
        app: overlay-ai-worker
    spec:
      containers:
        - name: worker
          image: ghcr.io/getoverlay/overlay-ai-worker:latest
          envFrom:
            - secretRef:
                name: overlay-secrets
          resources:
            requests:
              cpu: 1000m
              memory: 2Gi
            limits:
              cpu: 4000m
              memory: 8Gi
```

## Resource Recommendations

| Component | CPU Request | Memory Request | Notes |
|-----------|-------------|----------------|-------|
| Web app | 500m | 1Gi | Scales with user count |
| AI worker | 1000m | 2Gi | Add GPU nodes for local models |
| Postgres | 500m | 1Gi | Use managed DB in production |
| Redis | 100m | 256Mi | Can be replaced with Valkey |
| MinIO | 500m | 512Mi | Use S3-compatible managed storage in production |

## Helm Chart (Optional)

A community Helm chart is planned. For now, apply manifests directly:

```bash
kubectl apply -f k8s/
```

# Deployment Targets

Cloud platforms and host instances layout.

## Purpose
Specifies hosting services, load balancers, and network structures.

## Status
- **Status**: Draft

## Scope
Infrastructure details for web, api, local-ai, and background workers.

## Target Architecture
- **Web App**: Cloudflare Pages / Vercel / AWS Amplify.
- **Backend API & Workers**: AWS ECS / GCP Cloud Run / VPS.
- **Local AI Inference**: Dedicated GPU instance (AWS EC2 / RunPod) or serverless CPU environments.

## TODO / Next Steps
- [ ] Calculate hosting resource and budget limits.

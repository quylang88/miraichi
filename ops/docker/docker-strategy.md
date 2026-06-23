# Docker Strategy Plan

Image sizes, layer caching, and dev/prod container profiles.

## Purpose
Specifies multi-stage build hierarchies and registry release targets.

## Status
- **Status**: Draft

## Scope
Maps build targets for web, api, local-ai, and background worker images.

## Strategy Details
- **Base Images**: Use official Alpine/Debian-slim base images (e.g. `node:alpine`, `python:slim`).
- **Layers**: Group dynamic package installation steps (e.g. npm install, pip install) early in the Dockerfile to maximize cache hits.

## TODO / Next Steps
- [ ] Design base Dockerfiles for each of the four apps.

# Docker Strategy Plan

Image sizes, layer caching, and dev/prod container profiles.

## Purpose
Specifies multi-stage build hierarchies and registry release targets.

## Status
- **Status**: Draft
- **Review Status**: Phase 6 planning active; Dockerfile work deferred pending owner approval.

## Scope
Maps build targets for web, API, and approved background worker images.

## Strategy Details
- **Base Images**: Use official Alpine/Debian-slim base images (e.g. `node:alpine`, `python:slim`).
- **Layers**: Group dynamic package installation steps (e.g. npm install, pip install) early in the Dockerfile to maximize cache hits.

## TODO / Next Steps
- [ ] Keep Dockerfile creation out of scope until Phase 6 implementation planning names exact files and verification commands.

# Deployment and Environments

| Boundary | Staging | Production |
| --- | --- | --- |
| Git branch | protected `staging` | protected `main` |
| GitHub Environment | `staging` | `production` |
| Supabase | retained Frankfurt project | separate Singapore project |
| Edge region | `eu-central-1` | `ap-southeast-1` |
| Cloudflare Worker | staging-only | separate production-only |
| Owner data | synthetic and always cleaned | real owner data |
| R2 owner backup | no production credentials | private production bucket |
| Promotion | push after green PR | exact merged `staging` candidate only |

Project refs, Worker names, origins, Edge URLs, credentials, Vault values, schedulers, and databases
must be distinct. Production starts empty; staging owner rows are never copied. Match/provider state
is rebuilt independently and is not a substitute for owner backup.

Use `scripts/release/remote-readiness.ts` before provider mutation. It reports logical missing names
only and rejects shared identifiers, wrong regions, public/missing R2, missing offline-key proof,
incomplete branch protection, and loopback production URLs.

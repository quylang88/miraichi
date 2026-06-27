# Competition Registry

Data registry details for registering tournaments in the system.

## Purpose
Explains how to configure new football tournaments dynamically without changing core application code.

## Status
- **Status**: Active

## Scope
Defines the dynamic records shape in the configuration layer. Storage of this registry is restricted to local configuration files during Phase 3; database tables are deferred.

## Registry Rules
1. **Dynamic Configuration Metadata**: Adding a tournament simply requires defining a registry config record:
   ```json
   {
     "id": "competition-alpha",
     "name": "Competition Alpha",
     "country": "Region Alpha",
     "type": "tournament",
     "isActive": true
   }
   ```
2. **Support Multiple Tournaments**: Code must support processing records from multiple competitions concurrently.

## TODO / Next Steps
- [ ] Draft initial mock registry records for `packages/config` testing.

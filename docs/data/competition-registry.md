# Competition Registry

Data registry details for mapping tournaments in the database.

## Purpose
Explains how to register new football tournaments in the system without changing code.

## Status
- **Status**: Draft

## Scope
Defines the dynamic records shape in the competition configuration repository.

## Registry Rules
1. **Dynamic Metadata Registration**: The registry is stored in a database table or a registry config. Adding a tournament simply requires inserting a row:
   ```json
   {
     "id": "wc-2026",
     "name": "World Cup 2026",
     "country": "International",
     "type": "tournament",
     "isActive": true
   }
   ```
2. **Support Multiple Tournaments**: The code must handle queries listing multiple competitions simultaneously.

## TODO / Next Steps
- [ ] Create initial competition registry JSON records for testing.

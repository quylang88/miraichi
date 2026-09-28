# Owner Data Backup and Recovery

## Recovery contract

Encrypted production backups contain only durable owner data: owner profile, drafts, bets, bankroll
accounts, bankroll ledger, discipline configuration, and settlement events. Matches, provider
caches/checkpoints, live overlay, sessions, challenges, and refresh state are excluded because they
are rebuildable or ephemeral.

The normal recovery point is approximately 24 hours because backup creation is daily and also runs
before a production release. This is not a zero-data-loss promise. The free architecture has no
point-in-time recovery, no automatic cross-region failover, and no recovery-time SLA.

## Backup creation and proof

The production backup workflow:

1. exports and validates the canonical V3 owner envelope;
2. encrypts it in memory with AES-256-GCM using `OWNER_BACKUP_KEY_BASE64` and the versioned
   `OWNER_BACKUP_KEY_ID`;
3. writes only ciphertext to the private R2 Standard bucket;
4. performs metadata, byte readback, decryption, payload-hash, owner, and record-count verification;
5. applies bounded retention only after the new object is proven.

The retention plan keeps 30 daily and 12 monthly encrypted objects, subject to the internal 1 GB
pre-upload refusal ceiling.

Daily create/readback and weekly `backup:owner:restore-local` are independent of application deploy
permission. Plaintext must never be written to GitHub artifacts, R2, logs, shell history, or normal
files. R2 is usage-billed; retention and the internal 1 GB refusal ceiling are risk controls, not a
hard billing cap.

## Encryption-key custody and rotation

Keep `OWNER_BACKUP_KEY_BASE64` in the production GitHub Environment and an independent offline
password-manager/export copy. `MIRAICHI_OFFLINE_BACKUP_KEY_CONFIRMED=true` means the offline copy
was tested by an authorized owner; it is not the key itself. Losing the key makes the ciphertext
unrecoverable.

To rotate:

1. generate a new independent 32-byte key outside logs and chat;
2. assign a new immutable `OWNER_BACKUP_KEY_ID`;
3. update both production values together;
4. run manual create and verify, then the disposable restore;
5. retain the old offline key, labeled by key ID, until every object encrypted by it has expired
   under retention; never overwrite or guess an old key.

Rotate R2 credentials independently. A credential rotation does not re-encrypt objects. If any
value is exposed, disable it at the provider, preserve evidence, rotate, and prove a new backup.

## Weekly disposable restore

The committed workflow starts disposable local Supabase, resets that local database only, restores
the latest encrypted backup, verifies exact durable counts/hash and absence of excluded provider
state, then always destroys the local stack. It must use the loopback database URL and:

```powershell
pnpm run backup:owner:restore-local
```

Never change this command to accept a hosted URL. Never run `supabase db reset --linked`. A passing
decrypt alone is insufficient; only the complete restore and relationship/count proof demonstrates
recoverability.

## Production recovery incident

There is intentionally no one-command production restore. Recovery is a destructive data-write
operation and requires a reviewed incident change:

1. Stop application writes and pause scheduled refresh without deleting Vault values or data.
2. Record the incident time, last known good release/schema, current durable counts, latest verified
   backup receipt/key ID/object hash, and any partial data still present. Do not log payloads.
3. Take and verify a fresh encrypted backup of the current state when possible, even if damaged.
4. Restore the selected object into disposable local Supabase with the exact historical key. Verify
   payload hash, owner binding, counts, foreign-key order, and business invariants.
5. Reproduce the production schema version locally. If schema repair is required, write and review a
   forward-only compensating migration. Do not reverse migrations or reset the linked project.
6. Add or use a code-reviewed, one-transaction production import path that preserves IDs and rejects
   a nonempty/conflicting target. The normal `restore-local` guard must not be weakened.
7. Run migration preservation, unit/integration/E2E gates and a second disposable restore.
8. Apply the reviewed forward migration/import once, verify exact counts and hashes, then run only
   read-only production smoke before resuming writes.
9. Create a new encrypted backup and record sanitized closeout evidence.

If the target contains conflicting owner rows, stop. Do not merge records by hand, delete data to
make the import pass, or substitute a match-data rebuild for owner recovery.

## Rebuildable match data

Match/provider data is deliberately not in the owner backup. After database loss, restore owner
data first, then rerun the already approved source pipeline to hydrate current match data. Provider
availability can delay this rebuild, but it cannot justify inventing fixtures, raw provider IDs, or
copying staging owner rows.

## Recovery evidence

Record only object key/hash, key ID, receipt ID, schema/release identities, durable record counts,
test result, operator/time, and sanitized error codes. Never record the encryption key, database
URL, access credentials, plaintext owner fields, session cookies, or exported payload.

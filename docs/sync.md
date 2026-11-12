# Offline sync

The device database is the source of truth. The server is a durable, per-user replica that lets several devices converge and survives losing a phone.

## Local writes

Every write goes through `Store` in `@jewelry/core`:

1. The fields are validated with the shared zod schema.
2. The row is written and its `(table, id)` is added to the `outbox`, in the same SQLite transaction.
3. `updatedAt` always increases, even if the clock goes backwards.
4. Subscribers are notified once per transaction, so open screens re-query.

## Sync run

`SyncEngine.sync()` runs one pass at a time (concurrent callers share it):

1. **Purge**: expired Trash entries are purged or archived locally (and queued).
2. **Push**: outbox records are sent in batches of up to 100.
   - The server applies **last-write-wins** on the client `updatedAt` and stamps `serverUpdatedAt`.
   - A purged record is terminal: nothing overwrites a tombstone.
   - New pieces and orders receive their human-readable code from a per-user atomic counter.
   - Each record is acknowledged as `applied` or `stale`. The device takes the server code and clears the outbox entry, unless the record changed again while the request was in flight.
3. **Pull**: everything changed since the last seen `serverUpdatedAt` is fetched in pages of up to 500.
   - The cursor goes back 60 seconds to cover writes that landed out of order.
   - Applying a remote record is idempotent.
   - A remote record is skipped when the local copy is newer and still queued.
   - Tombstones delete the local row.

Photo uploads run before each sync, so the new `storageKey` goes out in the same push.

## When sync runs (mobile)

- On launch, after sign-in
- When connectivity returns
- When the app returns to the foreground
- A few seconds after local edits (debounced)
- Every five minutes while open
- On demand, from the sync indicator in the header

The header indicator always pairs an icon with text: *Synced*, *3 to sync*, *Syncing*, *Offline · 3*, *Sync issue*.

## Server layout (DynamoDB single table)

| Item | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| Record | `USER#<sub>` | `REC#<table>#<id>` | `USER#<sub>` | `<serverUpdatedAt>#<table>#<id>` |
| Code counter | `USER#<sub>` | `COUNTER#<table>` | | |

Pull queries `GSI1` for `GSI1SK > since`. Writes use conditional puts with a few retries, so concurrent pushes can't overwrite newer data.

## Guarantees and limits

- Convergence is per record: the newest `updatedAt` wins as a whole record, with no field-level merging. This suits a single user on one or two devices.
- Codes are unique per user and never reused. Until a record has synced once it shows *New*.
- Integration tests (`packages/core/test/integration`) run two devices against the real handler and a DynamoDB emulator. They cover codes, conflicts, deletes and tombstones.

# Architecture

```
┌──────────────────────── Android phone ────────────────────────┐
│  Expo Router screens                                          │
│        │ live queries (re-run on change)                      │
│  @jewelry/core Store ── SQLite (source of truth)              │
│        │ outbox                                               │
│  SyncEngine ── push / pull ─────────────┐                     │
│  Photo queue ── presigned PUT ──────────┼──────────┐          │
└─────────────────────────────────────────┼──────────┼──────────┘
                                          │ HTTPS    │
                 ┌────────────────────────▼───┐      │
 Cognito (JWT) ─▶│ Lambda Function URL        │      │
                 │ Node 24 · arm64            │      │
                 └──┬──────────────┬──────────┘      │
                    │              │                  │
              DynamoDB       Cloudflare Workers AI    │
            (single table)   (FLUX.1 schnell,         │
                              Llama 3.3 70B)          │
                                          Cloudflare R2 (photos)
```

## Principles

- **Offline-first.** Every read and write goes to the on-device SQLite database. The network is only used to sync, upload photos, generate AI designs and read order messages with AI. The app never waits on the server to show or save data.
- **One schema, three places.** `@jewelry/shared` defines every table once, as zod schemas. The device store, the sync protocol and the server all validate with them.
- **Always-free hosting.** Each service is used within a permanent free tier. Infrastructure tests fail the build if provisioned capacity goes over free-tier limits or a paid-by-default service (API Gateway, NAT, RDS, Secrets Manager, S3) appears.
- **Thin server.** The Lambda authenticates, applies last-write-wins, keeps its code counter ahead of codes numbered on devices, and signs URLs. Business rules live in `@jewelry/core` on the device.

## Packages

| Package | Responsibility |
|---|---|
| `packages/shared` | Record schemas, option lists with labels, money in centavos, units (mm storage, in/cm and US/ISO display), Philippine phone parsing, order totals, API request/response types |
| `packages/core` | `Store` (validated writes, outbox, change notifications, nested transactions), lifecycle (soft delete with cascades, restore, purge or archive after 7 days), aggregate saves (piece with parts/stones/costs/photos, purchase with lines, order with items), read models for every screen, `SyncEngine`, photo upload queue, order assistant and its on-device message reader |
| `backend` | Router, Cognito JWT verification, sync push/pull against DynamoDB, presigned R2 URLs, Workers AI clients for designs and order messages |
| `infra` | `JewelryStack` (Cognito, DynamoDB, Lambda + Function URL, log retention, budget alert) and `JewelryGithubDeploy` (OIDC provider + deploy role limited to `main`) |
| `mobile` | Screens, theme, accessible UI primitives, expo-sqlite adapter, Cognito client, API client, photo compression, PDF receipts, local reminders |

## Mobile app structure

```
mobile/src
  app/            routes (Expo Router): (tabs) pieces · orders · clients · more, plus detail/edit stacks
  components/     themed, accessible primitives: Text, Button, fields, layout, ListToolbar
  features/       larger form sections: jewelry (parts, stones, costs, photos, AI), orders, materials
  hooks/          useLiveQuery, useSettings, useImageSource, picker options
  lib/            db adapter, auth, api, images, form helpers, device preferences, reminders
  providers/      AppProvider: store, auth state, sync triggers
  theme/          tokens (palettes, type, spacing) and responsive layout hook
```

Screens read through `useLiveQuery`, which re-runs its query whenever the store reports a change. That covers local edits and records applied by sync. Edit screens copy the record into form state once, so a background sync never overwrites what the user is typing.

## Authentication

There is a single owner account, created by an administrator (self sign-up is disabled). The app signs in with `USER_PASSWORD_AUTH` directly against Cognito. The refresh token is stored in the Android keystore (expo-secure-store) and is valid for a year. The app needs a new access token only when it syncs, so it keeps working offline indefinitely after the first sign-in. The Lambda verifies access tokens with `aws-jwt-verify`, and every record key is partitioned by the token's `sub`.

Without an API URL configured, the app runs in **offline-only mode**: no sign-in, no sync. This mode is used for e2e tests and demos.

## Photos and AI designs

1. Picked or captured photos are resized to at most 1600 px and saved as WebP in the app's document directory. The `localUri` column is device-only and never synced.
2. When online, the upload queue asks the API for a presigned R2 `PUT` URL and uploads the file natively. It then records the object key, which does sync.
3. Other devices display the photo through short-lived presigned `GET` URLs, cached until shortly before they expire.
4. Design generation sends the description to the Lambda. Llama 3.1 8B optionally rewrites it into a jewelry-photography prompt, then FLUX.1 schnell renders it. The image comes back inline as base64 and is never stored on the server. A draft stays in the cache directory until the user keeps it (it then becomes a normal photo) or discards it.
5. When a photo record is purged, the server deletes the R2 object.

## Order assistant

Orders can be created by describing them in a sentence ("Maria Santos wants an 18K white gold ring with a 3mm diamond, ₱18,000, ₱5,000 down via GCash"). The work is split so that the model never touches the records:

```
message ──▶ read ──▶ OrderIntent ──▶ match on the phone ──▶ ask what's missing ──▶ summary ──▶ Create order
            │                         clients by phone or name
            ├ online: Workers AI      available pieces by code or description
            │  (JSON schema answer)   suggested price from cost and markup
            └ offline: rule-based reader in @jewelry/core
```

1. **Read.** A message becomes an `OrderIntent` (`@jewelry/shared`): client name and phone, pieces with metal, karat and price, down payment, payment method and notes. Online, the Lambda asks Llama 3.3 70B on Workers AI to answer in a JSON schema. The answer is validated with the same zod schema, and any field it can't use becomes null. Offline, or if the model fails, a rule-based reader on the phone does the same job for the common shapes of a note (it knows "18K gold" is a karat and "18k down" is money).
2. **Match.** `OrderAssistant` (`@jewelry/core`) matches the intent against the phone's own database: a client by phone number or name, pieces by code or by the words in their description. Close matches are offered as choices; otherwise it prepares a new client or a new made-to-order piece.
3. **Ask.** It asks one question at a time for whatever is still missing: which client, their number, which piece, a price, the down payment. Answers can be typed, dictated with the keyboard's microphone, or tapped.
4. **Confirm.** Nothing is written until the summary is confirmed. The client, any new pieces, the order and the down payment are then saved in one transaction and sync like any other edit.

Because matching happens on the device, the server never sees the client list, and the assistant works offline.

## Receipts and reminders

- **Receipts.** The order page renders a one-page HTML receipt (pieces, payments, balance; never cost or profit), prints it to a PDF with `expo-print` and opens the share sheet, so it can be sent over Messenger, Viber or email.
- **Reminders.** For an order with a balance, a day can be picked to be reminded to collect it. A local notification (`expo-notifications`) arrives at 9 AM that day and opens the order. Reminders are kept on the phone only and need no server.

## Design choices

| Choice | Why |
|---|---|
| SQLite on the phone is the source of truth | A shop owner records sales where the signal is poor. Writes are instant and never lost; sync is a background detail |
| Outbox + last-write-wins per record | One owner on one or two phones rarely edits the same record twice at once. Per-record LWW is simple to reason about and test, and the outbox survives restarts |
| Codes numbered on the device | Pieces and orders need a name the moment they are created, even offline. The server keeps device codes and moves its own counter past them |
| Business rules in `@jewelry/core`, not the server | The same code runs in the app and in Node tests against an in-memory SQLite, so rules are tested without a device |
| AI reads, the phone decides | The model only turns text into fields. Matching records, prices and saving stay deterministic, testable and private, and the feature degrades to an on-device reader offline |
| One Lambda behind a Function URL | No API Gateway cost, few cold starts for a single user, and a tiny router is enough |
| Always-free services, enforced by tests | CDK assertions fail the build if capacity or a paid-by-default service would cost money |

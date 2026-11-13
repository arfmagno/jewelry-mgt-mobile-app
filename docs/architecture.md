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
            (single table)   (FLUX.1 schnell)         │
                                          Cloudflare R2 (photos)
```

## Principles

- **Offline-first.** Every read and write goes to the on-device SQLite database. The network is only used to sync, upload photos, and generate AI designs. The app never waits on the server to show or save data.
- **One schema, three places.** `@jewelry/shared` defines every table once, as zod schemas. The device store, the sync protocol and the server all validate with them.
- **Always-free hosting.** Each service is used within a permanent free tier. Infrastructure tests fail the build if provisioned capacity goes over free-tier limits or a paid-by-default service (API Gateway, NAT, RDS, Secrets Manager, S3) appears.
- **Thin server.** The Lambda authenticates, applies last-write-wins, keeps its code counter ahead of codes numbered on devices, and signs URLs. Business rules live in `@jewelry/core` on the device.

## Packages

| Package | Responsibility |
|---|---|
| `packages/shared` | Record schemas, option lists with labels, money in centavos, units (mm storage, in/cm and US/ISO display), Philippine phone parsing, order totals, API request/response types |
| `packages/core` | `Store` (validated writes, outbox, change notifications, nested transactions), lifecycle (soft delete with cascades, restore, purge or archive after 7 days), aggregate saves (piece with parts/stones/costs/photos, purchase with lines, order with items), read models for every screen, `SyncEngine`, photo upload queue |
| `backend` | Router, Cognito JWT verification, sync push/pull against DynamoDB, presigned R2 URLs, Workers AI client |
| `infra` | `JewelryStack` (Cognito, DynamoDB, Lambda + Function URL, log retention, budget alert) and `JewelryGithubDeploy` (OIDC provider + deploy role limited to `main`) |
| `mobile` | Screens, theme, accessible UI primitives, expo-sqlite adapter, Cognito client, API client, photo compression |

## Mobile app structure

```
mobile/src
  app/            routes (Expo Router): (tabs) pieces · orders · clients · more, plus detail/edit stacks
  components/     themed, accessible primitives: Text, Button, fields, layout, SyncIndicator
  features/       larger form sections: jewelry (parts, stones, costs, photos, AI), orders, materials
  hooks/          useLiveQuery, useSettings, useImageSource, picker options
  lib/            db adapter, auth, api, images, form helpers
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

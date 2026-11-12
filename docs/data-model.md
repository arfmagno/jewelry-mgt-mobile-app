# Data model

All tables are defined once in [`packages/shared/src/records.ts`](../packages/shared/src/records.ts). Every record has the same metadata:

| Column | Meaning |
|---|---|
| `id` | ULID generated on the device, so records can be created offline |
| `createdAt`, `updatedAt` | ISO timestamps; `updatedAt` decides last-write-wins |
| `deletedAt` | In Trash (soft deleted) |
| `archivedAt` | Past the Trash window but still referenced by history; hidden from lists |
| `purgedAt` | Permanently removed; only a tombstone remains so the removal syncs |

Conventions:

- **Money** is integer centavos (`₱1,250.50` → `125050`).
- **Lengths** are millimetres. The app shows inches or centimetres.
- **Ring sizes** are inner diameter in mm. The app shows US sizes (`d = 11.63 + 0.8128 × size`) or ISO sizes (inner circumference).
- **Phone numbers** are E.164. Philippine mobiles (`+639…`) and landlines are accepted, one per person.
- **Optional values** are `null`, never `undefined`, to mirror SQL.

## Entities

```
clients ──< jobOrders ──< jobOrderItems >── jewelries ──< jewelryComponents ──< jewelryStones
                 │                              │
                 └──< payments                  ├──< jewelryCosts >── suppliers / materials
                                                └──< jewelryImages

suppliers ──< purchases ──< purchaseLines >── materials ──< stockAdjustments
```

### Pieces

| Table | Notes |
|---|---|
| `jewelries` | One sellable piece or set. `code` (`JW-00001`) is assigned by the server on first sync. `origin` is `on_hand` (made for stock) or `made_to_order`. `manufactureDate` lives on the piece, because on-hand pieces exist before any order. When `sameMetalForAll` is set, metal, purity, colour and total weight are stored on the piece. |
| `jewelryComponents` | The parts of a piece: `ring`, `earrings`, `pendant`, `chain`, `bracelet`. A necklace is a pendant plus a chain; a set is several parts. Type-specific fields: ring size, earring back, chain/bracelet style, length, width. Metal fields are used when parts differ. |
| `jewelryStones` | Stones set on a specific part: kind (natural or lab-grown diamond, moissanite, cubic zirconia, coloured gemstone), shape, count, size, total carat, colour/clarity grade, setting style, supplier. |
| `jewelryCosts` | Cost lines. Material categories (metal, stone, finding, chain) can reference a supplier and material. Service categories (CAD design, casting, stone setting, polishing, plating/*tubog*, engraving, enamel, resizing, certification, packaging…) record the worker's name as free text. |
| `jewelryImages` | Photos and kept AI designs. `storageKey` points to R2 once uploaded; `source` is `upload` or `ai`, with the prompt kept for AI images. |

The piece type shown in lists (ring, necklace, set…) is derived from its parts. It is never stored.

### Sales

| Table | Notes |
|---|---|
| `clients` | Name, phone, optional address and notes. |
| `jobOrders` | Client, order date, manual status (`in_production` / `completed`), server-assigned `code` (`JO-00001`). |
| `jobOrderItems` | A piece in an order, with its selling price. A piece belongs to at most one active order. |
| `payments` | Down payments and later payments: amount, date, method (cash, GCash, Maya, bank transfer, card, other). |

Order totals are computed, not stored: cost (sum of piece costs), selling, profit, margin, paid, balance.

### Purchasing and stock

| Table | Notes |
|---|---|
| `suppliers` | Sources of materials. Workers who provide labour are not stored, only named on cost lines. |
| `materials` | Things bought: kind, pricing unit (g, pc, ct), optional metal and purity. |
| `purchases`, `purchaseLines` | What was bought, when, from whom and at what unit price. A material's **current price** is the unit price of its most recent purchase. |
| `stockAdjustments` | Opening balances, losses, scrap, returns and corrections. |
| `settings` | A single synced row: currency, default markup, length unit, ring size system, stock tracking toggle. |

When stock tracking is on, **stock on hand** = purchased + adjustments − quantities used on cost lines of live pieces.

## Deleting, restoring and purging

Deletes are soft. Deleting a record moves it to Trash together with its *cascade* children: a piece with its parts, stones, costs and photos; an order with its items and payments; a purchase with its lines. Restoring brings the same group back.

Other references keep history intact: deleting a client does not touch their orders, and deleting a supplier keeps past costs and purchases.

Rules enforced in `@jewelry/core`:

- A piece that is in an active order cannot be deleted; remove it from the order first.
- Removing a piece from an order deletes it if it was made to order, or returns it to stock if it was on hand.
- Deleting an order frees its on-hand pieces. The user chooses whether its made-to-order pieces are deleted too.
- An order can't be restored if one of its pieces has since joined another order.

After **7 days** in Trash, each record is either **purged** (nothing references it) or **archived** (referenced by history; hidden but kept). Purges sync to other devices as tombstones.

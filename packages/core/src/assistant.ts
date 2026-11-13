import {
  formatMoney,
  formatPhPhone,
  parsePhPhone,
  PAYMENT_METHODS,
  PIECE_TYPES,
  suggestedPrice,
  type Client,
  type JewelryComponent,
  type OrderIntent,
  type OrderIntentPiece,
  type Payment,
  type PieceType,
} from "@jewelry/shared";
import { getSettings, saveJewelry, saveJobOrder, type ComponentDraft } from "./aggregates";
import { listJewelry, type JewelrySummary } from "./queries";
import { findAmounts, readOrderMessage } from "./reader";
import type { Store } from "./store";

/**
 * A short conversation that turns a description of an order into a saved order.
 * Each message is read into an OrderIntent (by the AI model or the on-device
 * reader), matched against the clients and pieces on the phone, and the
 * assistant asks for whatever is still missing. Nothing is saved until create().
 */

type PaymentMethod = Payment["method"];

export type DraftClient =
  | { kind: "existing"; id: string; name: string; phone: string }
  | { kind: "new"; firstName: string; lastName: string; phone: string | null };

export type DraftPiece =
  | { kind: "existing"; piece: JewelrySummary }
  | { kind: "new"; description: string; type: PieceType | null; metal: OrderIntentPiece["metal"]; purity: string | null; metalColor: OrderIntentPiece["metalColor"] };

export type DraftItem = {
  key: string;
  piece: DraftPiece | null;
  /** Available pieces that fit the description, offered before making a new one. */
  candidates: JewelrySummary[];
  said: OrderIntentPiece;
  /** Centavos. */
  price: number | null;
  priceSuggested: boolean;
};

export type AssistantDraft = {
  client: DraftClient | null;
  clientCandidates: Client[];
  items: DraftItem[];
  /** Centavos; 0 once the user says there is none. */
  downPayment: number | null;
  method: PaymentMethod;
  notes: string | null;
};

export type Choice = { label: string; value: string; hint?: string };

export type Expecting = "anything" | "client" | "pickClient" | "clientPhone" | "pieces" | "pickPiece" | "pieceType" | "price" | "downPayment" | "ready";

export type AssistantTurn = {
  text: string;
  choices: Choice[];
  expecting: Expecting;
  /** True when the order can be created. */
  ready: boolean;
};

export type DraftSummary = {
  client: string;
  phone: string | null;
  newClient: boolean;
  items: { label: string; detail: string; price: number; suggested: boolean; isNew: boolean }[];
  total: number;
  downPayment: number;
  balance: number;
  method: string;
  notes: string | null;
};

export type Interpret = (message: string) => Promise<OrderIntent>;

const NEW_PIECE_TYPES: PieceType[] = ["ring", "earrings", "pendant", "necklace", "chain", "bracelet"];
const NO_WORDS = /^\s*(?:no|none|nope|wala|zero|0|skip|not yet|no down ?payment|walang down)\b/i;
const WORD = /[a-z0-9ñ]+/gi;
const IGNORED = new Set(["with", "and", "the", "for", "na", "may", "of", "a", "an", "gold", "piece"]);

const tokens = (s: string) => (s.toLowerCase().match(WORD) ?? []).filter((t) => t.length > 1 && !IGNORED.has(t));

export const pieceName = (p: DraftPiece): string =>
  p.kind === "existing" ? `${p.piece.code ?? "Piece"} · ${p.piece.description}` : p.description;

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  // Philippine surnames often start with a particle: "Juan dela Cruz".
  const particle = parts.findIndex((p, i) => i > 0 && /^(?:de|del|dela|delos|san|sta\.?)$/i.test(p));
  const at = particle > 0 ? particle : parts.length - 1;
  return { firstName: parts.slice(0, at).join(" "), lastName: parts.slice(at).join(" ") };
}

function componentsFor(type: PieceType): ComponentDraft[] {
  const types: JewelryComponent["type"][] =
    type === "necklace" ? ["chain", "pendant"] : type === "set" ? ["earrings", "pendant", "chain"] : [type];
  return types.map((t) => ({
    type: t,
    metal: null,
    purity: null,
    metalColor: null,
    weightG: null,
    ringSizeMm: null,
    earringBack: null,
    lengthMm: null,
    style: null,
    widthMm: null,
    notes: null,
    stones: [],
  }));
}

export class OrderAssistant {
  draft: AssistantDraft = { client: null, clientCandidates: [], items: [], downPayment: null, method: "cash", notes: null };
  private expecting: Expecting = "anything";
  private focus: string | null = null;
  private seq = 0;
  /** Things to say before the next question, such as what was matched. */
  private said: string[] = [];

  constructor(
    private readonly store: Store,
    private readonly opts: { today: string; interpret?: Interpret },
  ) {}

  start(): AssistantTurn {
    this.expecting = "anything";
    return {
      text: "Tell me about the order: who it's for, the piece, the price, and any down payment. For example: “Maria Santos wants an 18K gold ring with a 3mm diamond, ₱18,000, ₱5,000 down via GCash.”",
      choices: [],
      expecting: "anything",
      ready: false,
    };
  }

  /** Handles a typed or dictated message. */
  async send(message: string): Promise<AssistantTurn> {
    const text = message.trim();
    if (!text) return this.next();
    if (!(await this.answer(text))) {
      const intent = await this.read(text);
      // A short reply to "Who is it for?" is the client's name.
      if (this.expecting === "client" && !intent.clientName && !intent.pieces.length && /^[\p{L} .'-]{2,60}$/u.test(text)) {
        intent.clientName = text;
      }
      await this.apply(intent, text);
    }
    return this.next();
  }

  /** Handles a tapped choice from the last turn. */
  async choose(value: string): Promise<AssistantTurn> {
    const [kind, a, b] = value.split(":");
    if (kind === "client" && a === "new") {
      const name = this.pendingClientName ?? "";
      this.draft.client = { kind: "new", ...splitName(name), phone: this.pendingPhone };
      this.draft.clientCandidates = [];
    } else if (kind === "client" && a) {
      const c = this.draft.clientCandidates.find((x) => x.id === a);
      if (c) this.useClient(c);
    } else if (kind === "piece" && a) {
      const item = this.draft.items.find((i) => i.key === a);
      if (item) {
        if (b === "new") this.makeNew(item);
        else {
          const p = item.candidates.find((c) => c.id === b);
          if (p) await this.useExisting(item, p);
        }
        item.candidates = [];
      }
    } else if (kind === "type" && a && b) {
      const item = this.draft.items.find((i) => i.key === a);
      if (item?.piece?.kind === "new") item.piece.type = b as PieceType;
    } else if (kind === "price" && a) {
      const item = this.draft.items.find((i) => i.key === a);
      if (item && item.piece?.kind === "existing") {
        item.price = await this.suggested(item.piece.piece);
        item.priceSuggested = true;
      }
    } else if (kind === "down" && a === "none") {
      this.draft.downPayment = 0;
    } else if (kind === "remove" && a) {
      this.draft.items = this.draft.items.filter((i) => i.key !== a);
    }
    return this.next();
  }

  summary(): DraftSummary {
    const d = this.draft;
    const total = d.items.reduce((t, i) => t + (i.price ?? 0), 0);
    const down = d.downPayment ?? 0;
    return {
      client: d.client ? (d.client.kind === "existing" ? d.client.name : `${d.client.firstName} ${d.client.lastName}`.trim()) : "",
      phone: d.client?.phone ? formatPhPhone(parsePhPhone(d.client.phone)?.e164 ?? d.client.phone) : null,
      newClient: d.client?.kind === "new",
      items: d.items
        .filter((i) => i.piece)
        .map((i) => ({
          label: i.piece!.kind === "existing" ? (i.piece!.piece.code ?? "Piece") : "New · made to order",
          detail: i.piece!.kind === "existing" ? i.piece!.piece.description : i.piece!.description,
          price: i.price ?? 0,
          suggested: i.priceSuggested,
          isNew: i.piece!.kind === "new",
        })),
      total,
      downPayment: down,
      balance: Math.max(0, total - down),
      method: PAYMENT_METHODS.labels[d.method],
      notes: d.notes,
    };
  }

  /** Saves the client, any new pieces, the order and its down payment together. Returns the order id. */
  async create(): Promise<string> {
    const d = this.draft;
    if (!this.complete() || !d.client) throw new Error("The order is not complete yet.");
    const client = d.client;
    return this.store.transaction(async () => {
      const clientId =
        client.kind === "existing"
          ? client.id
          : (await this.store.insert("clients", { firstName: client.firstName, lastName: client.lastName || "-", phone: client.phone!, address: null, notes: null })).id;
      const items: { jewelryId: string; sellingPrice: number }[] = [];
      for (const i of d.items) {
        const p = i.piece!;
        const jewelryId =
          p.kind === "existing"
            ? p.piece.id
            : await saveJewelry(this.store, {
                description: p.description,
                origin: "made_to_order",
                manufactureDate: null,
                sameMetalForAll: true,
                metal: p.metal,
                purity: p.purity,
                metalColor: p.metalColor,
                weightG: null,
                notes: null,
                components: componentsFor(p.type ?? "ring"),
                costs: [],
                images: [],
              });
        items.push({ jewelryId, sellingPrice: i.price ?? 0 });
      }
      const orderId = await saveJobOrder(this.store, {
        clientId,
        orderDate: this.opts.today,
        status: "in_production",
        notes: d.notes,
        items,
      });
      if (d.downPayment) {
        await this.store.insert("payments", { jobOrderId: orderId, amount: d.downPayment, paidAt: this.opts.today, method: d.method, notes: "Down payment" });
      }
      return orderId;
    });
  }

  // ── Reading ───────────────────────────────────────────────────────────

  private pendingClientName: string | null = null;
  private pendingPhone: string | null = null;
  /** Whether the offered clients match every word of the name, or only some. */
  private fullMatch = false;

  private async read(text: string): Promise<OrderIntent> {
    if (this.opts.interpret) {
      try {
        return await this.opts.interpret(text);
      } catch {
        // Offline or the model failed: read it on the device instead.
      }
    }
    return readOrderMessage(text);
  }

  /** A direct answer to the question just asked, without reading the whole message. */
  private async answer(text: string): Promise<boolean> {
    const item = this.draft.items.find((i) => i.key === this.focus);
    switch (this.expecting) {
      case "clientPhone": {
        const phone = parsePhPhone(text.replace(/[^\d+]/g, ""));
        if (!phone || this.draft.client?.kind !== "new") return false;
        this.draft.client.phone = phone.e164;
        return true;
      }
      case "price": {
        const amount = findAmounts(text)[0] ?? (/^\s*\d[\d,]*(?:\.\d{1,2})?\s*$/.test(text) ? { pesos: Number(text.replace(/[,\s]/g, "")) } : null);
        if (!amount || !item) return false;
        item.price = Math.round(amount.pesos * 100);
        item.priceSuggested = false;
        return true;
      }
      case "downPayment": {
        this.readMethod(text);
        if (NO_WORDS.test(text)) {
          this.draft.downPayment = 0;
          return true;
        }
        const amount = findAmounts(text)[0] ?? (/^\s*\d[\d,]*\s*$/.test(text) ? { pesos: Number(text.replace(/[,\s]/g, "")) } : null);
        if (!amount) return false;
        this.draft.downPayment = Math.round(amount.pesos * 100);
        return true;
      }
      case "pieceType": {
        const type = NEW_PIECE_TYPES.find((t) => new RegExp(`\\b${t.replace(/s$/, "")}`, "i").test(text));
        if (!type || item?.piece?.kind !== "new") return false;
        item.piece.type = type;
        return true;
      }
      default:
        return false;
    }
  }

  private readMethod(text: string) {
    const m = readOrderMessage(text).paymentMethod;
    if (m) this.draft.method = m;
  }

  private async apply(intent: OrderIntent, text: string) {
    await this.applyClient(intent, text);

    const pricesOnly = intent.pieces.filter((p) => !p.code && !p.description && !p.type);
    const pieces = intent.pieces.filter((p) => !pricesOnly.includes(p));
    for (const said of pieces) await this.addItem(said);
    // "₱15,000" on its own prices the piece still waiting for one.
    for (const p of pricesOnly) {
      const items = this.draft.items;
      const waiting = items.find((i) => i.price === null || i.priceSuggested) ?? (items.length === 1 ? items[0] : undefined);
      if (waiting && p.price !== null) {
        waiting.price = Math.round(p.price * 100);
        waiting.priceSuggested = false;
      }
    }

    if (intent.downPayment !== null) this.draft.downPayment = Math.round(intent.downPayment * 100);
    if (intent.paymentMethod) this.draft.method = intent.paymentMethod;
    if (intent.notes) this.draft.notes = this.draft.notes ? `${this.draft.notes}. ${intent.notes}` : intent.notes;
  }

  private async applyClient(intent: OrderIntent, text: string) {
    const phone = intent.clientPhone ? parsePhPhone(intent.clientPhone) : null;
    if (phone) this.pendingPhone = phone.e164;
    if (this.draft.client && !intent.clientName && !phone) return;
    const clients = await this.store.select("clients", "deletedAt IS NULL AND purgedAt IS NULL");

    if (phone) {
      const byPhone = clients.find((c) => c.phone === phone.e164);
      if (byPhone) return this.useClient(byPhone);
      if (this.draft.client?.kind === "new" && !intent.clientName) {
        this.draft.client.phone = phone.e164;
        return;
      }
    }

    // A client's full name anywhere in the message wins over a guessed name.
    const lower = ` ${text.toLowerCase()} `;
    const named = clients.filter((c) => lower.includes(` ${c.firstName.toLowerCase()} `) && lower.includes(` ${c.lastName.toLowerCase()}`));
    if (named.length === 1) return this.useClient(named[0]!);

    const query = intent.clientName;
    if (!query) return;
    const q = tokens(query);
    const scored = clients
      .map((c) => {
        const ct = tokens(`${c.firstName} ${c.lastName}`);
        return { c, score: q.filter((t) => ct.some((x) => x === t || (t.length >= 3 && x.startsWith(t)))).length };
      })
      .filter((s) => s.score > 0)
      .sort((x, y) => y.score - x.score);
    const best = scored[0]?.score ?? 0;
    const top = scored.filter((s) => s.score === best).map((s) => s.c);
    this.pendingClientName = query;
    if (top.length === 1 && best === q.length) return this.useClient(top[0]!);
    if (top.length) {
      this.fullMatch = best === q.length;
      this.draft.client = null;
      this.draft.clientCandidates = top.slice(0, 4);
      return;
    }
    this.draft.client = { kind: "new", ...splitName(query), phone: this.pendingPhone };
    this.draft.clientCandidates = [];
  }

  private useClient(c: Client) {
    this.draft.client = { kind: "existing", id: c.id, name: `${c.firstName} ${c.lastName}`, phone: c.phone };
    this.draft.clientCandidates = [];
    this.said.push(`Found ${c.firstName} ${c.lastName}.`);
  }

  private async addItem(said: OrderIntentPiece) {
    const item: DraftItem = { key: `i${++this.seq}`, piece: null, candidates: [], said, price: said.price !== null ? Math.round(said.price * 100) : null, priceSuggested: false };
    const available = await listJewelry(this.store, { availability: "available", limit: 1000 });
    if (this.draft.items.some((i) => i.piece?.kind === "existing" && said.code && i.piece.piece.code === said.code)) return;

    if (said.code) {
      const found = available.find((j) => j.code === said.code);
      if (!found) {
        const exists = (await this.store.select("jewelries", "code = ? AND deletedAt IS NULL", [said.code]))[0];
        this.said.push(exists ? `${said.code} is already in another order.` : `I couldn't find ${said.code}.`);
        return;
      }
      await this.useExisting(item, found);
    } else {
      const wanted = tokens(said.description ?? "");
      const taken = new Set(this.draft.items.flatMap((i) => (i.piece?.kind === "existing" ? [i.piece.piece.id] : [])));
      const matches = available
        .filter((j) => !taken.has(j.id) && (!said.type || j.pieceType === said.type))
        .map((j) => {
          const jt = tokens(j.description);
          return { j, score: wanted.filter((t) => jt.includes(t)).length };
        })
        .filter((m) => m.score >= Math.min(2, wanted.length) && m.score > 0)
        .sort((a, b) => b.score - a.score);
      item.candidates = matches.slice(0, 3).map((m) => m.j);
      if (!item.candidates.length) this.makeNew(item);
    }
    this.draft.items.push(item);
  }

  private makeNew(item: DraftItem) {
    const s = item.said;
    item.piece = {
      kind: "new",
      description: s.description ?? (s.type ? PIECE_TYPES.labels[s.type] : "Custom piece"),
      type: s.type,
      metal: s.metal,
      purity: s.purity,
      metalColor: s.metalColor,
    };
  }

  private async useExisting(item: DraftItem, piece: JewelrySummary) {
    item.piece = { kind: "existing", piece };
    if (item.price === null) {
      item.price = await this.suggested(piece);
      item.priceSuggested = item.price > 0;
      if (!item.price) item.price = null;
    }
  }

  private async suggested(piece: JewelrySummary) {
    const settings = await getSettings(this.store);
    return suggestedPrice(piece.totalCost, settings.defaultMarkupPct);
  }

  private complete(): boolean {
    const d = this.draft;
    return (
      !!d.client &&
      !!d.client.phone &&
      d.items.length > 0 &&
      d.items.every((i) => i.piece && i.price !== null && (i.piece.kind === "existing" || i.piece.type)) &&
      d.downPayment !== null &&
      d.downPayment <= d.items.reduce((t, i) => t + (i.price ?? 0), 0)
    );
  }

  // ── Asking ────────────────────────────────────────────────────────────

  private ask(expecting: Expecting, text: string, choices: Choice[] = [], focus: string | null = null): AssistantTurn {
    this.expecting = expecting;
    this.focus = focus;
    const lead = this.said.splice(0).join(" ");
    return { text: lead ? `${lead} ${text}` : text, choices, expecting, ready: expecting === "ready" };
  }

  private next(): AssistantTurn {
    const d = this.draft;
    if (!d.client) {
      if (d.clientCandidates.length) {
        return this.ask(
          "pickClient",
          this.fullMatch
            ? `Which ${this.pendingClientName ?? "client"} is it?`
            : `I don't have a client named ${this.pendingClientName ?? "that"}. Is it one of these, or someone new?`,
          [
            ...d.clientCandidates.map((c) => ({ label: `${c.firstName} ${c.lastName}`, hint: formatPhPhone(c.phone), value: `client:${c.id}` })),
            { label: `New client: ${this.pendingClientName ?? ""}`.trim(), value: "client:new" },
          ],
        );
      }
      return this.ask("client", d.items.length ? "Who is the order for?" : "Who is the order for, and what are they getting?");
    }
    if (d.client.kind === "new" && !d.client.phone) {
      return this.ask("clientPhone", `${d.client.firstName} ${d.client.lastName} is a new client. What's their mobile number?`.replace(/\s+/g, " "));
    }
    if (!d.items.length) {
      return this.ask("pieces", "What are they ordering? Describe the piece, or give a code like JW-00012.");
    }
    for (const i of d.items) {
      if (!i.piece && i.candidates.length) {
        return this.ask(
          "pickPiece",
          `I have ${i.candidates.length === 1 ? "an available piece" : "available pieces"} like “${i.said.description}”. Use one, or make a new one to order?`,
          [
            ...i.candidates.map((c) => ({ label: c.code ?? "Piece", hint: `${c.description} · cost ${formatMoney(c.totalCost)}`, value: `piece:${i.key}:${c.id}` })),
            { label: "Make a new one to order", value: `piece:${i.key}:new` },
          ],
          i.key,
        );
      }
      if (i.piece?.kind === "new" && !i.piece.type) {
        return this.ask(
          "pieceType",
          `What kind of piece is “${i.piece.description}”?`,
          NEW_PIECE_TYPES.map((t) => ({ label: PIECE_TYPES.labels[t], value: `type:${i.key}:${t}` })),
          i.key,
        );
      }
      if (i.price === null) {
        const name = i.piece ? pieceName(i.piece) : "the piece";
        return this.ask("price", `What's the selling price for ${name}?`, [], i.key);
      }
    }
    if (d.downPayment === null) {
      return this.ask("downPayment", "Is there a down payment today?", [{ label: "No down payment", value: "down:none" }]);
    }
    const s = this.summary();
    if (d.downPayment > s.total) {
      d.downPayment = null;
      return this.ask("downPayment", `That's more than the ${formatMoney(s.total)} total. How much was paid?`, [{ label: "No down payment", value: "down:none" }]);
    }
    return this.ask("ready", "Here's the order. Create it, or tell me what to change.");
  }
}

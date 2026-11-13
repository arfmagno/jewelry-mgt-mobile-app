import { emptyIntent, parsePhPhone, PURITIES, type OrderIntent, type OrderIntentPiece, type PieceType } from "@jewelry/shared";

/**
 * Rule-based reading of a message about an order, used on the device when the
 * AI model can't be reached. It understands the common shapes of a shop owner's
 * note ("Maria Santos wants an 18K gold ring, ₱18,000, ₱5,000 down via GCash"),
 * not free conversation.
 */

const TYPE_WORDS: [RegExp, PieceType][] = [
  [/\b(?:earrings?|hikaw|studs?|hoops?)\b/i, "earrings"],
  [/\b(?:necklaces?|kwintas)\b/i, "necklace"],
  [/\b(?:pendants?|lockets?)\b/i, "pendant"],
  [/\b(?:bracelets?|bangles?|pulseras?)\b/i, "bracelet"],
  [/\b(?:chains?)\b/i, "chain"],
  [/\b(?:rings?|singsing|bands?)\b/i, "ring"],
];
const TYPE_WORD = /\b(?:earrings?|hikaw|studs?|hoops?|necklaces?|kwintas|pendants?|lockets?|bracelets?|bangles?|pulseras?|chains?|rings?|singsing|bands?)\b/gi;

const KARATS = PURITIES.gold.map((k) => k.slice(0, -1));
const DOWN_WORDS = /\b(?:down|dp|deposit|downpayment|advance|paid|initial)\b/i;
/** Words that end the description of a piece when reading backwards from its type. */
const STOP_WORDS = new Set(["a", "an", "the", "wants", "want", "needs", "need", "ordered", "orders", "order", "for", "of", "like", "would", "and", "is", "pa", "ng", "ang", "isang", "gusto", "new", "custom", "another", "pair", "set"]);
const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const PHONE = /(?:\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/;
const PHONE_ANYWHERE = new RegExp(PHONE.source, "g");

type Amount = { pesos: number; start: number; end: number };

/** Peso amounts, telling "18K" gold apart from "18k" pesos. */
export function findAmounts(message: string): Amount[] {
  const found: Amount[] = [];
  // Phone numbers are blanked out first so their digit groups aren't read as prices.
  const text = message.replace(PHONE_ANYWHERE, (m) => " ".repeat(m.length));
  const re = /(₱|\bphp\s?|\bp(?=\d))?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?\s?(k\b)?(\s?(?:pesos?|php)\b)?/gi;
  for (const m of text.matchAll(re)) {
    const [whole, symbol, digits = "", decimals, k, word] = m;
    const n = Number(digits.replace(/,/g, "") + (decimals ?? ""));
    const start = m.index ?? 0;
    const after = text.slice(start + whole.length, start + whole.length + 14);
    const isMoneyWord = !!symbol || !!word;
    if (k) {
      // "18K gold" is a karat; "18k down" or "₱18k" is money.
      const karatLike = KARATS.includes(digits) && !isMoneyWord && !DOWN_WORDS.test(after.split(/[,.;]/)[0] ?? "");
      if (karatLike) continue;
      found.push({ pesos: n * 1000, start, end: start + whole.trimEnd().length });
      continue;
    }
    // Sizes, weights, years and phone numbers are not money.
    if (/^\s?(?:mm|cm|g|grams?|ct|carats?|in|inch|")/i.test(after)) continue;
    if (/^0\d{9,}/.test(digits) || /^9\d{9}$/.test(digits)) continue;
    if (!isMoneyWord && (n < 100 || /,/.test(digits) === false && digits.length >= 9)) continue;
    // A bare recent year is a date; a round "2000 down" is money.
    const isYear = /^\d{4}$/.test(digits) && n >= 2020 && n <= 2040 && !decimals;
    if (!isMoneyWord && isYear && !DOWN_WORDS.test(after)) continue;
    found.push({ pesos: n, start, end: start + whole.trimEnd().length });
  }
  return found;
}

function isDown(text: string, a: Amount): boolean {
  const before = text.slice(Math.max(0, a.start - 24), a.start);
  const after = text.slice(a.end, a.end + 16);
  return /\b(?:down(?:\s?payment)?|dp|deposit|advance|paid|initial(?:\s?payment)?)\b(?:\s+(?:of|is|na))?\s*$/i.test(before) || /^\s*(?:down|dp|deposit|downpayment|advance|paid|na down)\b/i.test(after);
}

function readPiece(text: string, typeMatch: RegExpMatchArray): OrderIntentPiece {
  const start = typeMatch.index ?? 0;
  const end = start + typeMatch[0].length;
  // Words before the type, back to an article or verb: "an 18K white gold" ring.
  const words = text.slice(0, start).split(/\s+/).filter(Boolean);
  const lead: string[] = [];
  for (let i = words.length - 1; i >= 0 && lead.length < 6; i--) {
    const w = words[i]!;
    if (/[,.;:!?]$/.test(w) || STOP_WORDS.has(w.toLowerCase()) || /^(?:₱|php)/i.test(w)) break;
    lead.unshift(w);
  }
  // Leading words that are a client's name ("Maria Santos ring") are dropped by the caller's name match.
  // A "with ..." tail after the type: "ring with a 3mm diamond".
  const tail = /^\s+(?:with|na may|w\/)\s+[^,.;₱]+?(?=\s*(?:,|\.|;|₱|\bfor\b|\bat\b|\bdue\b|\bdown\b|\bdp\b|\bph?p\b|\d{1,3},\d{3}|$))/i.exec(text.slice(end));
  const description = [...lead, typeMatch[0], tail ? tail[0].trim() : ""].join(" ").trim();

  const purityMatch = /\b(10|12|14|18|21|22|24)\s?k\b/i.exec(description) ?? /\b(925|950|999)\b/.exec(description);
  const purity = purityMatch ? (purityMatch[1]!.length === 2 ? `${purityMatch[1]}K` : purityMatch[1]!) : null;
  const metal = /\bsilver\b|\b925\b/i.test(description) ? "silver" : purity?.endsWith("K") || /\bgold\b/i.test(description) ? "gold" : null;
  const metalColor = /\btwo[- ]?tone\b/i.test(description)
    ? "two_tone"
    : /\bwhite\b/i.test(description)
      ? "white"
      : /\brose\b/i.test(description)
        ? "rose"
        : /\byellow\b/i.test(description)
          ? "yellow"
          : null;
  const type = TYPE_WORDS.find(([re]) => re.test(typeMatch[0]))?.[1] ?? null;
  return { code: null, description: description.replace(/^\w/, (c) => c.toUpperCase()), type, metal, purity, metalColor: metal === "gold" ? metalColor : null, price: null };
}

function readName(text: string): string | null {
  const name = "([A-ZÑ][a-zñ]+(?:\\s+(?:de|del|dela|de la|delos|san|sta\\.?|[A-ZÑ][a-zñ.'-]+)){1,3})";
  const patterns = [
    new RegExp(`^\\s*${name}\\s+(?:wants|would|needs|ordered|orders|is ordering|asked|gusto|wants to)\\b`),
    new RegExp(`\\b(?:[Cc]lient|[Cc]ustomer|[Ff]or|[Pp]ara kay|[Pp]ara sa|[Kk]ay|[Ss]i|[Ff]rom)\\s+${name}`),
    new RegExp(`^\\s*${name}\\s*[,:-]`),
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m?.[1] && !TYPE_WORD.test(m[1])) return m[1].trim();
    TYPE_WORD.lastIndex = 0;
  }
  return null;
}

/** Reads one message. Fields it can't find stay null. */
export function readOrderMessage(message: string): OrderIntent {
  const text = message.replace(/\s+/g, " ").trim();
  const intent = emptyIntent();

  const phone = PHONE.exec(text);
  if (phone && parsePhPhone(phone[0])) intent.clientPhone = phone[0].replace(/[\s-]/g, "");

  intent.clientName = readName(text);

  const codes = [...text.matchAll(/\bJW-?\s?(\d{1,6})\b/gi)].map((m) => `JW-${m[1]!.padStart(5, "0")}`);
  for (const code of codes) intent.pieces.push({ code, description: null, type: null, metal: null, purity: null, metalColor: null, price: null });
  if (!codes.length) {
    for (const m of text.matchAll(TYPE_WORD)) {
      // "ring with ... and earrings" is two pieces; "earring backs" or a name ending in a type word is not.
      intent.pieces.push(readPiece(text, m));
    }
  }
  intent.pieces = intent.pieces.filter((p, i, all) => all.findIndex((q) => q.description === p.description && q.code === p.code) === i);
  // A piece that sits inside another one's "with ..." tail ("pendant with a chain") is part of it.
  intent.pieces = intent.pieces.filter((p) => !intent.pieces.some((q) => q !== p && q.description && p.description && q.description.length > p.description.length && q.description.toLowerCase().includes(p.description.toLowerCase())));

  const amounts = findAmounts(text);
  const prices: number[] = [];
  for (const a of amounts) {
    if (isDown(text, a)) intent.downPayment ??= a.pesos;
    else prices.push(a.pesos);
  }
  // Prices follow the pieces in the order they were said; a single price with several pieces is the order total for the first.
  intent.pieces.forEach((p, i) => {
    p.price = prices[i] ?? null;
  });
  if (!intent.pieces.length && prices.length) {
    intent.pieces.push({ code: null, description: null, type: null, metal: null, purity: null, metalColor: null, price: prices[0]! });
  }

  if (/\bg-?cash\b/i.test(text)) intent.paymentMethod = "gcash";
  else if (/\b(?:pay)?maya\b/i.test(text)) intent.paymentMethod = "maya";
  else if (/\b(?:bank|transfer|bdo|bpi|metrobank|instapay)\b/i.test(text)) intent.paymentMethod = "bank_transfer";
  else if (/\b(?:card|credit|debit)\b/i.test(text)) intent.paymentMethod = "card";
  else if (/\bcash\b/i.test(text)) intent.paymentMethod = "cash";

  const notes: string[] = [];
  const due = new RegExp(`\\b(?:due|deadline|needed by|needs it by|pick ?up|by)\\s+((?:${MONTHS})\\.?\\s+\\d{1,2}|\\d{1,2}\\s+(?:${MONTHS})|\\d{4}-\\d{2}-\\d{2}|next \\w+|this \\w+|tomorrow)`, "i").exec(text);
  if (due) notes.push(`Due ${due[1]}`);
  const engrave = /\bengrav(?:e|ed|ing)\s+(?:with\s+)?(["“'][^"”']+["”'])/i.exec(text);
  if (engrave) notes.push(`Engrave ${engrave[1]}`);
  intent.notes = notes.length ? notes.join(". ") : null;

  return intent;
}

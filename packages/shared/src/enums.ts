/**
 * Fixed option lists. Values are stable identifiers stored in the database;
 * labels are what the app shows. Every list has an "other" escape hatch,
 * paired with a free-text notes/description field on the record.
 */

const options = <const T extends readonly string[]>(values: T, labels: Record<T[number], string>) => ({
  values,
  labels,
});

export const METALS = options(["gold", "silver", "other"] as const, {
  gold: "Gold",
  silver: "Silver",
  other: "Other",
});
export type Metal = (typeof METALS.values)[number];

/** Gold is graded in karats; silver by fineness (parts per 1000). */
export const PURITIES: Record<Metal, readonly string[]> = {
  gold: ["10K", "12K", "14K", "18K", "21K", "22K", "24K"],
  silver: ["925", "950", "999"],
  other: [],
};

/** Gold alloys come in colours; silver and other metals do not. */
export const METAL_COLORS = options(["yellow", "white", "rose", "two_tone"] as const, {
  yellow: "Yellow",
  white: "White",
  rose: "Rose",
  two_tone: "Two-tone",
});

export const hasMetalColor = (metal: Metal | null): boolean => metal === "gold";

export const COMPONENT_TYPES = options(
  ["ring", "earrings", "pendant", "chain", "bracelet"] as const,
  {
    ring: "Ring",
    earrings: "Earrings",
    pendant: "Pendant",
    chain: "Chain",
    bracelet: "Bracelet",
  },
);

/** Derived from components: one component → its type; chain + pendant → necklace; else set. */
export const PIECE_TYPES = options(
  ["ring", "earrings", "pendant", "chain", "bracelet", "necklace", "set"] as const,
  {
    ring: "Ring",
    earrings: "Earrings",
    pendant: "Pendant",
    chain: "Chain",
    bracelet: "Bracelet",
    necklace: "Necklace",
    set: "Set",
  },
);

export const EARRING_BACKS = options(
  [
    "push_back",
    "push_pull",
    "screw_back",
    "hook",
    "lever_back",
    "huggie",
    "latch_back",
    "clip_on",
    "other",
  ] as const,
  {
    push_back: "Push back (butterfly)",
    push_pull: "Push & pull",
    screw_back: "Screw back",
    hook: "Hook (fish hook)",
    lever_back: "Lever back",
    huggie: "Huggie / hinged",
    latch_back: "Latch back",
    clip_on: "Clip-on",
    other: "Other",
  },
);

export const CHAIN_STYLES = options(
  [
    "cable",
    "box",
    "rope",
    "cuban",
    "curb",
    "figaro",
    "franco",
    "singapore",
    "snake",
    "rolo",
    "wheat",
    "herringbone",
    "bead",
    "other",
  ] as const,
  {
    cable: "Cable",
    box: "Box",
    rope: "Rope",
    cuban: "Cuban",
    curb: "Curb",
    figaro: "Figaro",
    franco: "Franco",
    singapore: "Singapore",
    snake: "Snake",
    rolo: "Rolo",
    wheat: "Wheat",
    herringbone: "Herringbone",
    bead: "Bead",
    other: "Other",
  },
);

export const BRACELET_STYLES = options(
  ["chain", "bangle", "cuff", "tennis", "charm", "beaded", "other"] as const,
  {
    chain: "Chain",
    bangle: "Bangle",
    cuff: "Cuff",
    tennis: "Tennis",
    charm: "Charm",
    beaded: "Beaded",
    other: "Other",
  },
);

export const STONE_KINDS = options(
  [
    "natural_diamond",
    "lab_grown_diamond",
    "moissanite",
    "cubic_zirconia",
    "gemstone",
    "other",
  ] as const,
  {
    natural_diamond: "Natural diamond",
    lab_grown_diamond: "Lab-grown diamond",
    moissanite: "Moissanite",
    cubic_zirconia: "Cubic zirconia (Russian diamond)",
    gemstone: "Colored gemstone",
    other: "Other",
  },
);

export const STONE_SHAPES = options(
  [
    "round",
    "princess",
    "oval",
    "cushion",
    "emerald",
    "pear",
    "marquise",
    "heart",
    "radiant",
    "asscher",
    "baguette",
    "trillion",
    "cabochon",
    "other",
  ] as const,
  {
    round: "Round",
    princess: "Princess",
    oval: "Oval",
    cushion: "Cushion",
    emerald: "Emerald cut",
    pear: "Pear",
    marquise: "Marquise",
    heart: "Heart",
    radiant: "Radiant",
    asscher: "Asscher",
    baguette: "Baguette",
    trillion: "Trillion",
    cabochon: "Cabochon",
    other: "Other",
  },
);

export const STONE_SETTINGS = options(
  ["prong", "bezel", "pave", "channel", "halo", "tension", "flush", "invisible", "other"] as const,
  {
    prong: "Prong",
    bezel: "Bezel",
    pave: "Pavé",
    channel: "Channel",
    halo: "Halo",
    tension: "Tension",
    flush: "Flush",
    invisible: "Invisible",
    other: "Other",
  },
);

export const MATERIAL_COST_CATEGORIES = ["metal", "stone", "finding", "chain", "other_material"] as const;
export const SERVICE_COST_CATEGORIES = [
  "design_cad",
  "casting",
  "fabrication",
  "soldering",
  "stone_setting",
  "polishing",
  "plating",
  "engraving",
  "enameling",
  "resizing_repair",
  "certification",
  "packaging",
  "other_service",
] as const;

export const COST_CATEGORIES = options(
  [...MATERIAL_COST_CATEGORIES, ...SERVICE_COST_CATEGORIES] as const,
  {
    metal: "Metal",
    stone: "Stones",
    finding: "Findings (clasps, backs, jump rings)",
    chain: "Ready-made chain",
    other_material: "Other material",
    design_cad: "Design / 3D model / wax",
    casting: "Casting",
    fabrication: "Fabrication (goldsmith work)",
    soldering: "Soldering / laser welding",
    stone_setting: "Stone setting",
    polishing: "Polishing / finishing",
    plating: "Plating (tubog)",
    engraving: "Engraving",
    enameling: "Enameling",
    resizing_repair: "Resizing / repair",
    certification: "Certification / appraisal",
    packaging: "Packaging",
    other_service: "Other service",
  },
);

export type CostCategory = (typeof COST_CATEGORIES.values)[number];
export const isServiceCost = (c: CostCategory) =>
  (SERVICE_COST_CATEGORIES as readonly string[]).includes(c);

export const MATERIAL_KINDS = options(["metal", "stone", "finding", "chain", "other"] as const, {
  metal: "Metal",
  stone: "Stone",
  finding: "Finding",
  chain: "Chain",
  other: "Other",
});

export const UNITS = options(["g", "pc", "ct"] as const, {
  g: "grams",
  pc: "pieces",
  ct: "carats",
});

export const STOCK_REASONS = options(
  ["opening", "loss", "scrap", "return", "correction"] as const,
  {
    opening: "Opening balance",
    loss: "Loss",
    scrap: "Scrap",
    return: "Returned to supplier",
    correction: "Correction",
  },
);

export const ORIGINS = options(["on_hand", "made_to_order"] as const, {
  on_hand: "On-hand (stock)",
  made_to_order: "Made to order",
});

export const ORDER_STATUSES = options(["in_production", "completed"] as const, {
  in_production: "In production",
  completed: "Completed",
});

export const PAYMENT_METHODS = options(
  ["cash", "gcash", "maya", "bank_transfer", "card", "other"] as const,
  {
    cash: "Cash",
    gcash: "GCash",
    maya: "Maya",
    bank_transfer: "Bank transfer",
    card: "Card",
    other: "Other",
  },
);

export const LENGTH_UNITS = options(["in", "cm"] as const, { in: "Inches", cm: "Centimeters" });

export const RING_SIZE_SYSTEMS = options(["us", "iso"] as const, {
  us: "US",
  iso: "ISO (circumference, mm)",
});

export const IMAGE_SOURCES = options(["upload", "ai"] as const, {
  upload: "Photo",
  ai: "AI design",
});

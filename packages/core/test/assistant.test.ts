import { emptyIntent } from "@jewelry/shared";
import { describe, expect, it } from "vitest";
import { saveJewelry } from "../src/aggregates";
import { OrderAssistant } from "../src/assistant";
import { getOrder, listClients } from "../src/queries";
import { clientInput, ringDraft, testStore } from "./helpers";

const today = "2026-11-13";

async function setup() {
  const { store } = await testStore();
  const maria = await store.insert("clients", clientInput({ firstName: "Maria", lastName: "Santos", phone: "09171112222" }));
  const ring = await saveJewelry(store, ringDraft({ description: "18K white gold ring with a 3mm diamond" }));
  return { store, maria, ring, bot: new OrderAssistant(store, { today }) };
}

describe("OrderAssistant", () => {
  it("creates an order from one message, offering an available piece first", async () => {
    const { store, maria, ring, bot } = await setup();
    let turn = await bot.send("Maria Santos wants an 18K white gold ring with a 3mm diamond, ₱18,000, ₱5,000 down via GCash. Due Dec 20");
    expect(turn.text).toContain("Found Maria Santos");
    expect(turn.expecting).toBe("pickPiece");
    expect(turn.choices.map((c) => c.value)).toContain(`piece:i1:${ring}`);

    turn = await bot.choose(`piece:i1:${ring}`);
    expect(turn.ready).toBe(true);
    expect(bot.summary()).toMatchObject({ client: "Maria Santos", total: 1_800_000, downPayment: 500_000, balance: 1_300_000, method: "GCash", notes: "Due Dec 20" });

    const order = await getOrder(store, await bot.create());
    expect(order?.order.clientId).toBe(maria.id);
    expect(order?.items.map((i) => i.jewelry.id)).toEqual([ring]);
    expect(order?.payments.map((p) => [p.amount, p.method])).toEqual([[500_000, "gcash"]]);
  });

  it("asks for what is missing, one question at a time", async () => {
    const { store, bot } = await setup();
    let turn = await bot.send("silver bracelet");
    expect(turn.expecting).toBe("client");
    turn = await bot.send("Paolo Reyes");
    expect(turn.expecting).toBe("clientPhone");
    turn = await bot.send("0918 555 1234");
    expect(turn.expecting).toBe("price");
    turn = await bot.send("3,500");
    expect(turn.expecting).toBe("downPayment");
    turn = await bot.send("none");
    expect(turn.ready).toBe(true);

    const order = await getOrder(store, await bot.create());
    expect(order?.items[0]?.jewelry).toMatchObject({ description: "Silver bracelet", origin: "made_to_order", pieceType: "bracelet" });
    expect(order?.items[0]?.sellingPrice).toBe(350_000);
    expect(order?.payments).toHaveLength(0);
    expect((await listClients(store)).map((c) => c.lastName)).toContain("Reyes");
  });

  it("asks which client when a name fits several", async () => {
    const { store, bot } = await setup();
    await store.insert("clients", clientInput({ firstName: "Maria", lastName: "Reyes", phone: "09173334444" }));
    const turn = await bot.send("ring for Maria, 10,000");
    expect(turn.expecting).toBe("pickClient");
    expect(turn.choices.map((c) => c.label)).toEqual(expect.arrayContaining(["Maria Santos", "Maria Reyes"]));
  });

  it("finds a piece by code and suggests its price from cost and markup", async () => {
    const { bot } = await setup();
    await bot.send("JW-00001 for Maria Santos");
    const turn = await bot.send("no down payment");
    expect(turn.ready).toBe(true);
    const s = bot.summary();
    expect(s.items[0]).toMatchObject({ label: "JW-00001", suggested: true });
    expect(s.total).toBeGreaterThan(0);
  });

  it("refuses a down payment larger than the total", async () => {
    const { bot } = await setup();
    const turn = await bot.send("Maria Santos, pendant 2,000, 5,000 down");
    expect(turn.expecting).toBe("downPayment");
    expect(turn.text).toContain("more than");
  });

  it("uses the AI reading when given, and the device reader when it fails", async () => {
    const { store } = await setup();
    const ai = new OrderAssistant(store, {
      today,
      interpret: async () => ({ ...emptyIntent(), clientName: "Maria Santos", pieces: [{ code: null, description: "Pearl earrings", type: "earrings", metal: null, purity: null, metalColor: null, price: 7000 }], downPayment: 0 }),
    });
    expect((await ai.send("anything")).ready).toBe(true);

    const offline = new OrderAssistant(store, { today, interpret: () => Promise.reject(new Error("offline")) });
    const turn = await offline.send("Maria Santos: pearl earrings 7,000, no dp");
    expect(turn.expecting).toBe("downPayment");
    expect(offline.summary().items[0]?.price).toBe(700_000);
  });

  it("won't create an incomplete order", async () => {
    const { bot } = await setup();
    await bot.send("ring");
    await expect(bot.create()).rejects.toThrow();
  });
});

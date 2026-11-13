import type { OrderDetail } from "@jewelry/core";
import { receiptHtml } from "../receipt";

jest.mock("expo-print", () => ({}));
jest.mock("expo-sharing", () => ({}));

const meta = { createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", deletedAt: null, archivedAt: null, purgedAt: null };

const order: OrderDetail = {
  order: { ...meta, id: "o1", code: "JO-00012", clientId: "c1", orderDate: "2026-11-13", status: "in_production", notes: "Engrave <B & M>" },
  client: { ...meta, id: "c1", firstName: "Bea", lastName: "Ramos", phone: "+639175551234", address: null, notes: null },
  items: [
    {
      itemId: "i1",
      sellingPrice: 1_800_000,
      cost: 1_200_000,
      jewelry: { id: "j1", code: "JW-00031", description: "18K white gold solitaire ring", origin: "on_hand", pieceType: "ring", totalCost: 1_200_000, availability: "in_order", orderId: "o1", image: null, createdAt: meta.createdAt },
    },
  ],
  payments: [{ ...meta, id: "p1", jobOrderId: "o1", amount: 500_000, paidAt: "2026-11-13", method: "gcash", notes: null }],
  totals: { cost: 1_200_000, selling: 1_800_000, profit: 600_000, margin: 1 / 3, paid: 500_000, balance: 1_300_000 },
};

describe("receipt", () => {
  it("lists the pieces, payments and balance for the client", () => {
    const html = receiptHtml(order);
    expect(html).toContain("JO-00012");
    expect(html).toContain("Bea Ramos");
    expect(html).toContain("0917 555 1234");
    expect(html).toContain("18K white gold solitaire ring");
    expect(html).toContain("₱18,000.00");
    expect(html).toContain("GCash");
    expect(html).toContain("Balance due");
    expect(html).toContain("₱13,000.00");
  });

  it("never shows cost or profit, and escapes text", () => {
    const html = receiptHtml(order);
    expect(html).not.toContain("₱12,000.00");
    expect(html).not.toContain("₱6,000.00");
    expect(html).toContain("Engrave &lt;B &amp; M&gt;");
  });

  it("says fully paid when nothing is left", () => {
    const html = receiptHtml({ ...order, totals: { ...order.totals, paid: 1_800_000, balance: 0 } });
    expect(html).toContain("Fully paid");
  });
});

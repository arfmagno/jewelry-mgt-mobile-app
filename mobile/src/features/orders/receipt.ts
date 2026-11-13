import type { OrderDetail } from "@jewelry/core";
import { formatMoney, formatPhPhone, PAYMENT_METHODS } from "@jewelry/shared";
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { pieceLabel } from "@/components/JewelryCard";
import { formatDate } from "@/components/fields";
import { fullName } from "@/lib/format";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * A one-page receipt for the client, in the app's ivory and gold: the pieces,
 * what was paid and what is left. Costs and profit are never included.
 */
export function receiptHtml(d: OrderDetail): string {
  const { order, totals } = d;
  const code = escape(order.code ?? "Job order");
  const rows = d.items
    .map(
      (i) => `<tr><td><span class="eyebrow">${escape(pieceLabel(i.jewelry))}</span><br>${escape(i.jewelry.description)}</td><td class="num">${formatMoney(i.sellingPrice)}</td></tr>`,
    )
    .join("");
  const payments = d.payments
    .map((p) => `<tr><td>${escape(formatDate(p.paidAt))} · ${escape(PAYMENT_METHODS.labels[p.method])}</td><td class="num">${formatMoney(p.amount)}</td></tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${code}</title><style>
  @page { margin: 0; }
  html { background: #FAF8F3; }
  body { font-family: Georgia, "Times New Roman", serif; color: #17150F; background: #FAF8F3; margin: 0; padding: 56px; min-height: 100vh; box-sizing: border-box; font-variant-numeric: lining-nums; }
  .eyebrow { font-family: Helvetica, Arial, sans-serif; font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; color: #80631B; }
  .muted { color: #5F594E; }
  h1 { font-weight: 600; font-size: 34px; margin: 6px 0 2px; }
  .rule { border: 0; border-top: 1px solid #B8933A; margin: 28px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  td { padding: 12px 0; border-bottom: 1px solid #E8E1D3; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; padding-left: 24px; }
  .total td { border-bottom: 0; font-size: 18px; padding-top: 16px; }
  .balance td { border-top: 1px solid #17150F; border-bottom: 0; font-size: 22px; font-weight: 600; }
  .label { font-family: Helvetica, Arial, sans-serif; font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase; color: #5F594E; }
  footer { margin-top: 40px; text-align: center; }
</style></head><body>
  <div class="eyebrow">Receipt · ${code} · ${escape(formatDate(order.orderDate))}</div>
  <h1>${escape(fullName(d.client))}</h1>
  ${d.client ? `<div class="muted">${escape(formatPhPhone(d.client.phone))}</div>` : ""}
  <hr class="rule">
  <table>${rows}<tr class="total"><td class="label">Total</td><td class="num">${formatMoney(totals.selling)}</td></tr></table>
  ${payments ? `<hr class="rule"><div class="eyebrow">Payments</div><table>${payments}</table>` : ""}
  <table><tr class="balance"><td class="label">${totals.balance > 0 ? "Balance due" : "Fully paid"}</td><td class="num">${formatMoney(Math.max(0, totals.balance))}</td></tr></table>
  ${order.notes ? `<p class="muted">${escape(order.notes)}</p>` : ""}
  <footer><hr class="rule"><div class="eyebrow">Thank you</div></footer>
</body></html>`;
}

/** Prints the receipt to a PDF named after the order and opens the share sheet (Messenger, Viber, email…). */
export async function shareReceipt(d: OrderDetail): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: receiptHtml(d), width: 595, height: 842 });
  let file = new File(uri);
  try {
    const named = new File(Paths.cache, `${d.order.code ?? "receipt"}.pdf`);
    if (named.exists) named.delete();
    file.move(named);
    file = named;
  } catch {
    // Keep the generated name.
  }
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share receipt" });
}

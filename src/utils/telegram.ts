import { Sale, MartDetails, Product } from '../types';
import { formatUsd, formatKhr, formatKhmerDateTime } from './formatters';

export function formatReceiptForTelegram(sale: Sale, mart: MartDetails): string {
  const dateStr = formatKhmerDateTime(sale.createdAt);

  let itemsText = '';
  sale.items.forEach((item, index) => {
    itemsText += `${index + 1}. <b>${item.nameKh}</b> (${item.nameEn})\n`;
    itemsText += `   <i>${item.quantity} ${item.unit} × ${formatUsd(item.sellingPriceUsd)} = ${formatUsd(item.totalPriceUsd)}</i>\n`;
  });

  const msg = `
🧾 <b>${mart.nameKh}</b>
<b>${mart.nameEn}</b>
--------------------------------------
<b>លេខវិក្កយបត្រ (Invoice):</b> <code>${sale.receiptNo}</code>
<b>កាលបរិច្ឆេទ (Date):</b> ${dateStr}
<b>អ្នកគិតប្រាក់ (Cashier):</b> ${sale.cashierName}
--------------------------------------
<b>បញ្ជីទំនិញ (Items List):</b>
${itemsText}
--------------------------------------
💵 <b>សរុបរួម (Total USD):</b> <b>${formatUsd(sale.totalUsd)}</b>
៛ <b>សរុបរួម (Total KHR):</b> <b>${formatKhr(sale.totalKhr)}</b>
--------------------------------------
<b>បង់ជា (Payment Method):</b> ${sale.paymentMethod.toUpperCase()}
<b>បានបង់ ($):</b> ${formatUsd(sale.paidUsd)} | <b>(៛):</b> ${formatKhr(sale.paidKhr)}
<b>ប្រាក់អាប់ ($):</b> ${formatUsd(sale.changeUsd)} | <b>(៛):</b> ${formatKhr(sale.changeKhr)}
--------------------------------------
<i>${mart.receiptFooterMessageKh}</i>
`;

  return msg.trim();
}

export function formatDailyReportForTelegram(
  sales: Sale[],
  products: Product[],
  mart: MartDetails,
  dateRangeLabel: string = 'ថ្ងៃនេះ (Today)'
): string {
  const totalUsd = sales.reduce((acc, s) => acc + s.totalUsd, 0);
  const totalKhr = sales.reduce((acc, s) => acc + s.totalKhr, 0);
  const totalTransactions = sales.length;

  // Calculate top selling items
  const itemMap: Record<string, { nameKh: string; nameEn: string; qty: number; revenueUsd: number }> = {};
  sales.forEach((s) => {
    s.items.forEach((item) => {
      if (!itemMap[item.barcode]) {
        itemMap[item.barcode] = {
          nameKh: item.nameKh,
          nameEn: item.nameEn,
          qty: 0,
          revenueUsd: 0,
        };
      }
      itemMap[item.barcode].qty += item.quantity;
      itemMap[item.barcode].revenueUsd += item.totalPriceUsd;
    });
  });

  const topItems = Object.values(itemMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  let topItemsText = '';
  topItems.forEach((item, idx) => {
    topItemsText += `${idx + 1}. <b>${item.nameKh}</b> - ${item.qty} Pcs (${formatUsd(item.revenueUsd)})\n`;
  });

  if (!topItemsText) {
    topItemsText = '<i>ពុំទាន់មានការលក់នៅឡើយ</i>\n';
  }

  // Low stock products
  const lowStock = products.filter((p) => p.stockQuantity <= p.minStockLevel);
  let lowStockText = '';
  lowStock.forEach((p, idx) => {
    lowStockText += `⚠️ ${p.nameKh} (${p.barcode}): នៅសល់តែ <b>${p.stockQuantity} ${p.unit}</b>\n`;
  });

  if (!lowStockText) {
    lowStockText = '✅ គ្មានទំនិញខ្វះស្តុកទេ\n';
  }

  const nowStr = formatKhmerDateTime(new Date());

  const msg = `
📊 <b>របាយការណ៍លក់ - ${mart.nameKh}</b>
🗓 <b>ពេលវេលារបាយការណ៍:</b> ${dateRangeLabel} (${nowStr})
--------------------------------------
💰 <b>ចំណូលសរុប (Total Revenue):</b>
  👉 <b>${formatUsd(totalUsd)}</b>
  👉 <b>${formatKhr(totalKhr)}</b>

🧾 <b>ចំនួនប្រតិបត្តិការ (Transactions):</b> <b>${totalTransactions} លើក</b>
--------------------------------------
🏆 <b>ទំនិញលក់ដាច់បំផុត Top 5:</b>
${topItemsText}
--------------------------------------
🚨 <b>ទំនិញជិតអស់ពីស្តុក (Low Stock Alert):</b>
${lowStockText}
--------------------------------------
🤖 <i>របាយការណ៍ស្វ័យប្រវត្តិចេញពីប្រព័ន្ធ Mart POS</i>
`;

  return msg.trim();
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken,
        chatId,
        message,
        parseMode: 'HTML',
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to dispatch Telegram API call' };
  }
}

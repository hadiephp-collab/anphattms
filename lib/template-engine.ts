// Template engine: hỗ trợ {var}, {#if var}...{/if}, {#each items}...{/each}

export type TemplateItem = Record<string, string>;

export interface TemplateVars {
  [key: string]: string | TemplateItem[] | undefined;
}

// Core renderer: process loops → conditionals → simple vars
export function renderTemplate(template: string, vars: TemplateVars): string {
  let result = template;

  // 1. {#each key}...{/each} — loop over array
  result = result.replace(/\{#each (\w+)\}([\s\S]*?)\{\/each\}/g, (_m, key, body) => {
    const items = vars[key];
    if (!Array.isArray(items)) return '';
    return items.map(item => substituteSimple(body, item)).join('');
  });

  // 2. {#if key}...{/if} — show block only when value is non-empty, non-zero
  result = result.replace(/\{#if (\w+)\}([\s\S]*?)\{\/if\}/g, (_m, key, body) => {
    const val = vars[key];
    if (!val || val === '' || val === '0' || val === '—') return '';
    // substitute vars inside the body before returning
    return substituteSimple(body, vars as Record<string, string>);
  });

  // 3. Simple {var} substitution
  result = substituteSimple(result, vars as Record<string, string>);

  return result;
}

function substituteSimple(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => {
    const v = vars[key];
    return typeof v === 'string' ? v : _m;
  });
}

// ── Items table generator ─────────────────────────────────────────────────────

export interface OrderItemRow {
  stt: number;
  name: string;
  code: string;
  qty: number;
  unit: string;
  price: number;
  discountPct: number;
  total: number;
}

export function generateItemsTable(items: OrderItemRow[]): string {
  const hasDiscount = items.some(i => i.discountPct > 0);
  const fmtN = (n: number) => Number(n).toLocaleString('vi-VN');
  const ckTh = hasDiscount ? `<th style="padding:6px 8px;text-align:center;width:50px;font-weight:600">CK%</th>` : '';
  const rows = items.map(item => {
    const ckTd = hasDiscount
      ? `<td style="padding:5px 8px;text-align:center;color:#dc2626">${item.discountPct > 0 ? item.discountPct + '%' : ''}</td>`
      : '';
    return `<tr style="border-bottom:1px solid #eee">
      <td style="padding:5px 8px;text-align:center;color:#777">${item.stt}</td>
      <td style="padding:5px 8px"><div style="font-weight:500">${item.name}</div><div style="font-size:10px;color:#888">${item.code}</div></td>
      <td style="padding:5px 8px;text-align:center;color:#555">${item.unit}</td>
      <td style="padding:5px 8px;text-align:center;font-weight:600">${item.qty}</td>
      <td style="padding:5px 8px;text-align:right">${fmtN(item.price)}</td>
      ${ckTd}
      <td style="padding:5px 8px;text-align:right;font-weight:600">${fmtN(item.total)}</td>
    </tr>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12px">
  <thead>
    <tr style="background:#f5f5f5;border-top:1px solid #ccc;border-bottom:1px solid #ccc">
      <th style="padding:6px 8px;text-align:center;width:28px;font-weight:600">STT</th>
      <th style="padding:6px 8px;text-align:left;font-weight:600">Tên sản phẩm</th>
      <th style="padding:6px 8px;text-align:center;width:44px;font-weight:600">ĐVT</th>
      <th style="padding:6px 8px;text-align:center;width:40px;font-weight:600">SL</th>
      <th style="padding:6px 8px;text-align:right;width:100px;font-weight:600">Đơn giá</th>
      ${ckTh}
      <th style="padding:6px 8px;text-align:right;width:110px;font-weight:600">Thành tiền</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

// ── Number to Vietnamese words ────────────────────────────────────────────────

export function numberToWords(n: number): string {
  if (n === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const teens = ['mười', 'mười một', 'mười hai', 'mười ba', 'mười bốn', 'mười lăm', 'mười sáu', 'mười bảy', 'mười tám', 'mười chín'];

  function readGroup(num: number): string {
    if (num === 0) return '';
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;
    let s = '';
    if (h > 0) s += units[h] + ' trăm ';
    if (t === 1) { s += teens[u] + ' '; }
    else if (t > 1) {
      s += units[t] + ' mươi ';
      if (u === 5) s = s.replace('mươi ', 'mươi lăm ').replace('lăm lăm', 'lăm');
      else if (u > 0) s += units[u] + ' ';
    } else if (u > 0 && h > 0) { s += 'lẻ ' + units[u] + ' '; }
    else if (u > 0) { s += units[u] + ' '; }
    return s;
  }

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;
  let result = '';
  if (billions > 0) result += readGroup(billions) + 'tỷ ';
  if (millions > 0) result += readGroup(millions) + 'triệu ';
  if (thousands > 0) result += readGroup(thousands) + 'nghìn ';
  if (remainder > 0) result += readGroup(remainder);
  result = result.trim() + ' đồng';
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ── Local date helpers ────────────────────────────────────────────────────────

export function localDateStr(d?: Date): string {
  const dt = d ?? new Date();
  return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`;
}

export function localDateTimeStr(d?: Date): string {
  const dt = d ?? new Date();
  return `${localDateStr(dt)} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
}

// ── Build full HTML document for iframe preview ───────────────────────────────

export function buildPrintDocument(bodyHtml: string, paperSize = 'A4'): string {
  const maxWidth = paperSize === 'A5' ? '540px' : '740px';
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}
.wrap{max-width:${maxWidth};margin:0 auto;padding:20px}
@media print{@page{size:${paperSize} portrait;margin:12mm 15mm}body{background:#fff}}
</style></head><body><div class="wrap">${bodyHtml}</div></body></html>`;
}

// ── Payment method code → label ───────────────────────────────────────────────

export const PM_LABEL: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', momo: 'MoMo',
  TM: 'Tiền mặt', CK: 'Chuyển khoản', MM: 'MoMo', KH: 'Khác', other: 'Khác',
};

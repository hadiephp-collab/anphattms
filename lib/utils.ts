// Trả về ngày local dạng YYYY-MM-DD — KHÔNG dùng toISOString() vì sẽ lệch UTC+7
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtMoney(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Math.abs(n));
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN');
}

export function getPresetDates(preset: string): { from: string; to: string } {
  const today = new Date();
  const pad = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  switch (preset) {
    case 'today': return { from: pad(today), to: pad(today) };
    case 'yesterday': { const d = new Date(today); d.setDate(d.getDate() - 1); return { from: pad(d), to: pad(d) }; }
    case 'this_week': { const day = today.getDay(); const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); return { from: pad(mon), to: pad(today) }; }
    case 'last_week': { const day = today.getDay(); const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1) - 7); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return { from: pad(mon), to: pad(sun) }; }
    case 'this_month': return { from: pad(new Date(today.getFullYear(), today.getMonth(), 1)), to: pad(today) };
    case 'last_month': { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1); const l = new Date(today.getFullYear(), today.getMonth(), 0); return { from: pad(f), to: pad(l) }; }
    default: return { from: '', to: '' };
  }
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { transactionsApi, branchesApi } from '@/lib/transactions';

interface TxRecord {
  id: number; code: string; type: 'receipt' | 'payment';
  amount: number; paymentMethod: string; category: string | null;
  note: string | null; createdAt: string; date: string | null;
  partner?: { id: number; name: string } | null;
}
interface Period { totalReceipt: number; totalPayment: number; net: number; }
interface PtttPeriod { receipt: number; payment: number; net: number; count: number; }
interface Stats {
  currentPeriod: Period; prevPeriod: Period;
  trend: { receiptPct: number | null; paymentPct: number | null; netPct: number | null; };
  ptttBalance:  Record<string, number>;
  ptttPeriod:   Record<string, PtttPeriod>;
  ptttOpening:  Record<string, number>;
  periodDates:     { from: string; to: string };
  prevPeriodDates: { from: string; to: string };
  recent: TxRecord[];
}

const PM_LABEL: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', momo: 'MoMo', other: 'Khác',
};

type Preset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',         label: 'Hôm nay' },
  { key: 'this_week',    label: 'Tuần này' },
  { key: 'this_month',   label: 'Tháng này' },
  { key: 'last_month',   label: 'Tháng trước' },
  { key: 'this_quarter', label: 'Quý này' },
  { key: 'this_year',    label: 'Năm nay' },
  { key: 'custom',       label: 'Tùy chỉnh' },
];

function getDateRange(preset: Preset, cf = '', ct = '') {
  const d = new Date();
  const fmt = (x: Date) => {
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = fmt(d);
  switch (preset) {
    case 'today':         return { from: today, to: today };
    case 'this_week':     { const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: fmt(mon), to: today }; }
    case 'this_month':    return { from: fmt(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
    case 'last_month':    return { from: fmt(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: fmt(new Date(d.getFullYear(), d.getMonth(), 0)) };
    case 'this_quarter':  { const q = Math.floor(d.getMonth() / 3); return { from: fmt(new Date(d.getFullYear(), q * 3, 1)), to: today }; }
    case 'this_year':     return { from: fmt(new Date(d.getFullYear(), 0, 1)), to: today };
    case 'custom':        return { from: cf, to: ct };
  }
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}
function fmtDateShort(s: string | null) {
  if (!s) return '—';
  const [, m, day] = s.slice(0, 10).split('-');
  return `${day}/${m}`;
}
function fmtDate(s: string | null) {
  if (!s) return '—';
  const p = s.slice(0, 10).split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

/* ── Detail Modal ── */
function TxDetailModal({ tx, onClose }: { tx: TxRecord; onClose(): void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${tx.type === 'receipt' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {tx.type === 'receipt' ? 'Phiếu Thu' : 'Phiếu Chi'}
            </span>
            <span className="font-mono font-bold text-gray-700">{tx.code}</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          <div className="text-center py-2">
            <p className="text-xs text-gray-400 mb-1">{tx.type === 'receipt' ? 'Số tiền thu' : 'Số tiền chi'}</p>
            <p className={`text-3xl font-bold ${tx.type === 'receipt' ? 'text-emerald-600' : 'text-red-500'}`}>{fmtMoney(Number(tx.amount))}</p>
          </div>
          {[
            { label: 'Ngày',      value: fmtDate(tx.date || tx.createdAt) },
            { label: 'PTTT',      value: PM_LABEL[tx.paymentMethod] || tx.paymentMethod },
            { label: 'Danh mục',  value: tx.category || '—' },
            { label: 'Đối tác',   value: tx.partner?.name || '—' },
            { label: 'Diễn giải', value: tx.note || '—' },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-400 flex-shrink-0 w-20">{row.label}</span>
              <span className="text-xs text-gray-700 font-medium text-right flex-1 break-words">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Branch { id: number; name: string; }

export default function ThuChiOverviewPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [detailTx, setDetailTx] = useState<TxRecord | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    branchesApi.getAll().then(r => setBranches(r.data || r || [])).catch(() => {});
  }, []);

  const loadStats = useCallback(async (p: Preset, cf = customFrom, ct = customTo, bid = branchId) => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(p, cf, ct);
      const params: Record<string, string> = {};
      if (from) params.dateFrom = from;
      if (to)   params.dateTo   = to;
      if (bid)  params.branchId = bid;
      setStats(await transactionsApi.getStats(params));
    } catch {}
    finally { setLoading(false); }
  }, [customFrom, customTo, branchId]);

  useEffect(() => { loadStats(preset); }, []); // eslint-disable-line

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function selectPreset(p: Preset) {
    setPreset(p);
    if (p !== 'custom') { setShowDropdown(false); loadStats(p, customFrom, customTo, branchId); }
  }
  function applyCustom() {
    if (customFrom && customTo) { setShowDropdown(false); loadStats('custom', customFrom, customTo, branchId); }
  }
  function selectBranch(bid: string) {
    setBranchId(bid);
    loadStats(preset, customFrom, customTo, bid);
  }

  const cur  = stats?.currentPeriod;
  const prev = stats?.prevPeriod;
  const tr   = stats?.trend;
  const presetLabel = PRESETS.find(p => p.key === preset)?.label || 'Tháng này';
  const prevLabel = stats?.prevPeriodDates ? `${fmtDateShort(stats.prevPeriodDates.from)}–${fmtDateShort(stats.prevPeriodDates.to)}` : '';
  const curLabel  = stats?.periodDates    ? `${fmtDateShort(stats.periodDates.from)}–${fmtDateShort(stats.periodDates.to)}` : '';

  const recentReceipt = stats?.recent.filter(t => t.type === 'receipt') ?? [];
  const recentPayment = stats?.recent.filter(t => t.type === 'payment') ?? [];

  /* KPI cards — EXACT same pattern as Đối Tác / Sản Phẩm */
  const kpiCards = [
    { label: 'Tổng Thu',        value: fmtMoney(cur?.totalReceipt || 0), gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-100', href: '/dashboard/thu-chi/phieu-thu',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 11l5-5m0 0l5 5m-5-5v12M3 6a2 2 0 012-2h14a2 2 0 012 2" /> },
    { label: 'Tổng Chi',        value: fmtMoney(cur?.totalPayment || 0), gradient: 'from-red-500 to-red-700',          shadow: 'shadow-red-100',     href: '/dashboard/thu-chi/phieu-chi',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 13l-5 5m0 0l-5-5m5 5V6M21 18a2 2 0 01-2 2H5a2 2 0 01-2-2" /> },
    { label: 'Lợi Nhuận Ròng',  value: fmtMoney(cur?.net || 0),          gradient: (cur?.net || 0) >= 0 ? 'from-blue-500 to-blue-700' : 'from-orange-500 to-orange-700', shadow: 'shadow-blue-100', href: '/dashboard/thu-chi/so-quy',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
    { label: 'Số Dư Tiền Mặt',  value: fmtMoney(stats?.ptttBalance?.cash || 0), gradient: 'from-violet-500 to-violet-700', shadow: 'shadow-violet-100', href: '/dashboard/thu-chi/so-quy',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Tổng Quan Sổ Quỹ</h1>
          <p className="text-xs text-gray-400 mt-0.5">{curLabel ? `Đang xem: ${curLabel}` : 'Báo cáo thu chi tổng hợp'}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Branch selector */}
          <select value={branchId} onChange={e => selectBranch(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700 min-w-40">
            <option value="">Tất cả chi nhánh</option>
            {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>
          {/* Dropdown kỳ */}
          <div className="relative" ref={dropRef}>
            <button onClick={() => setShowDropdown(v => !v)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-xl hover:border-blue-400 transition shadow-sm min-w-36">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-gray-700 flex-1">{presetLabel}</span>
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                <div className="py-1.5">
                  {PRESETS.filter(p => p.key !== 'custom').map(p => (
                    <button key={p.key} onClick={() => selectPreset(p.key)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${preset === p.key ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                      {p.label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button onClick={() => selectPreset('custom')}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${preset === 'custom' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                      Tùy chỉnh...
                    </button>
                    {preset === 'custom' && (
                      <div className="px-4 pb-3 space-y-2">
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)}   className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <button onClick={applyCustom} disabled={!customFrom || !customTo} className="w-full py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg disabled:opacity-40">Áp dụng</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => router.push('/dashboard/thu-chi/phieu-thu')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Phiếu Thu
          </button>
          <button onClick={() => router.push('/dashboard/thu-chi/phieu-chi')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Phiếu Chi
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">

        {/* ── 1. KPI CARDS — khớp style Đối Tác / Sản Phẩm ── */}
        <div className="grid grid-cols-4 gap-3">
          {kpiCards.map(card => (
            <button key={card.label} onClick={() => router.push(card.href)}
              className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} shadow-sm ${card.shadow} flex items-center gap-3 px-4 py-4 text-left hover:opacity-90 transition group w-full`}>
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">{card.icon}</svg>
              </div>
              <div className="z-10">
                <p className="text-[11px] text-white/60 font-medium leading-none">{card.label}</p>
                {loading
                  ? <div className="h-6 w-28 bg-white/20 rounded mt-1 animate-pulse" />
                  : <p className="text-2xl font-bold text-white mt-1 leading-none">{card.value}</p>}
              </div>
            </button>
          ))}
        </div>

        {/* ── 2. SO SÁNH KỲ TRƯỚC ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-600">So sánh kỳ trước</span>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="px-2 py-0.5 bg-gray-100 rounded-md">Kỳ này: {curLabel}</span>
              <span className="text-gray-300">vs</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded-md">Kỳ trước: {prevLabel}</span>
            </div>
          </div>
          {/* Bảng so sánh */}
          {loading ? (
            <div className="px-5 py-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] text-gray-400 border-b border-gray-50">
                  <th className="px-5 py-2 text-left font-medium w-36">Chỉ số</th>
                  <th className="px-4 py-2 text-right font-medium">Kỳ này</th>
                  <th className="px-4 py-2 text-right font-medium">Kỳ trước</th>
                  <th className="px-5 py-2 text-right font-medium">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Tổng Thu',    dot: 'bg-emerald-400', cur: cur?.totalReceipt || 0, prev: prev?.totalReceipt || 0, pct: tr?.receiptPct ?? null, valColor: 'text-emerald-600' },
                  { label: 'Tổng Chi',    dot: 'bg-red-400',     cur: cur?.totalPayment || 0, prev: prev?.totalPayment || 0, pct: tr?.paymentPct ?? null, valColor: 'text-red-500'     },
                  { label: 'Lợi Nhuận',  dot: 'bg-blue-400',    cur: cur?.net || 0,           prev: prev?.net || 0,          pct: tr?.netPct ?? null,     valColor: 'text-blue-600'    },
                ].map((item, idx) => {
                  const diff = item.cur - item.prev;
                  const isUp = diff >= 0;
                  return (
                    <tr key={item.label} className={idx < 2 ? 'border-b border-gray-50' : ''}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dot}`} />
                          <span className="font-medium text-gray-600">{item.label}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold ${item.valColor}`}>{fmtMoney(item.cur)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{fmtMoney(item.prev)}</td>
                      <td className="px-5 py-2.5 text-right">
                        {diff === 0 ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {isUp ? '▲' : '▼'} {fmtMoney(Math.abs(diff))}
                            {item.pct !== null && <span className="opacity-60 font-normal">({Math.abs(item.pct)}%)</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 3. SỐ DƯ THEO PTTT — bảng kiểu GAS ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Biến Động Quỹ Theo Phương Thức Thanh Toán</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Theo dõi từng PTTT trong kỳ: {curLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400">Tổng số dư thực tế</p>
              <p className="text-sm font-bold text-blue-700">{fmtMoney(Object.values(stats?.ptttBalance || {}).reduce((a, b) => a + b, 0))}</p>
            </div>
          </div>
          <div className="overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500">Tài khoản / PTTT</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500">Số dư đầu kỳ</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-emerald-600">↑ Tổng thu kỳ</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-red-500">↓ Tổng chi kỳ</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-violet-600">± Chênh lệch kỳ</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-gray-400">Số GD</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-blue-700">Số dư cuối kỳ</th>
                  </tr>
                </thead>
                <tbody>
                  {stats && Object.entries(PM_LABEL).map(([pm, label]) => {
                    const opening = stats.ptttOpening?.[pm] ?? 0;
                    const period  = stats.ptttPeriod?.[pm]  ?? { receipt: 0, payment: 0, net: 0, count: 0 };
                    const closing = opening + period.receipt - period.payment;
                    const hasActivity = period.receipt > 0 || period.payment > 0;
                    return (
                      <tr key={pm} className={`border-t border-gray-50 ${hasActivity ? 'hover:bg-gray-50' : 'opacity-40'}`}>
                        <td className="px-5 py-2.5 font-medium text-gray-700">{label}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{opening !== 0 ? fmtMoney(opening) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                          {period.receipt > 0 ? `+${fmtMoney(period.receipt)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-500">
                          {period.payment > 0 ? `−${fmtMoney(period.payment)}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {period.net === 0
                            ? <span className="text-gray-300">—</span>
                            : <span className={period.net > 0 ? 'text-emerald-600' : 'text-red-500'}>
                                {period.net > 0 ? '+' : '−'}{fmtMoney(Math.abs(period.net))}
                              </span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-400">
                          {period.count > 0 ? <span className="px-1.5 py-0.5 bg-gray-100 rounded font-medium text-[11px]">{period.count}</span> : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={`font-bold ${closing > 0 ? 'text-blue-700' : closing < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {fmtMoney(closing)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Tổng cộng */}
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-5 py-2.5 font-bold text-gray-700">Tổng cộng</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-600">
                      {fmtMoney(Object.values(stats?.ptttOpening || {}).reduce((a, b) => a + b, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                      {(cur?.totalReceipt || 0) > 0 ? `+${fmtMoney(cur?.totalReceipt ?? 0)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-red-500">
                      {(cur?.totalPayment || 0) > 0 ? `−${fmtMoney(cur?.totalPayment ?? 0)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold">
                      {(() => {
                        const totalNet = (cur?.totalReceipt || 0) - (cur?.totalPayment || 0);
                        return totalNet === 0
                          ? <span className="text-gray-300">—</span>
                          : <span className={totalNet > 0 ? 'text-emerald-600' : 'text-red-500'}>
                              {totalNet > 0 ? '+' : '−'}{fmtMoney(Math.abs(totalNet))}
                            </span>;
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-gray-500">
                      {Object.values(stats?.ptttPeriod || {}).reduce((a, b) => a + (b.count || 0), 0)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold text-blue-700">
                      {fmtMoney(Object.values(stats?.ptttBalance || {}).reduce((a, b) => a + b, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── 4. GIAO DỊCH GẦN ĐÂY — tách Thu / Chi ── */}
        <div className="grid grid-cols-2 gap-3 pb-4">
          {[
            { title: 'Phiếu Thu Gần Đây', rows: recentReceipt, href: '/dashboard/thu-chi/phieu-thu', dotColor: 'bg-emerald-500', linkColor: 'text-emerald-600', amtColor: 'text-emerald-600', sign: '+', empty: 'Chưa có phiếu thu nào' },
            { title: 'Phiếu Chi Gần Đây', rows: recentPayment, href: '/dashboard/thu-chi/phieu-chi', dotColor: 'bg-red-500',     linkColor: 'text-red-500',     amtColor: 'text-red-500',     sign: '−', empty: 'Chưa có phiếu chi nào' },
          ].map(col => (
            <div key={col.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <h3 className="text-sm font-semibold text-gray-700">{col.title}</h3>
                </div>
                <button onClick={() => router.push(col.href)} className={`text-xs ${col.linkColor} hover:underline`}>Xem tất cả →</button>
              </div>
              <div className="px-4 py-2">
                {loading ? (
                  <div className="space-y-2 p-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
                ) : col.rows.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">{col.empty}</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {col.rows.slice(0, 6).map(tx => (
                      <div key={tx.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition group"
                        onClick={() => setDetailTx(tx)}>
                        {/* Col 1: Mã + Đối tác */}
                        <div className="w-24 flex-shrink-0">
                          <p className={`font-mono text-xs font-bold group-hover:underline leading-tight ${col.amtColor}`}>{tx.code}</p>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5 leading-tight">
                            {tx.partner?.name || <span className="italic text-gray-300">—</span>}
                          </p>
                        </div>
                        {/* Col 2: Danh mục + Diễn giải */}
                        <div className="flex-1 min-w-0">
                          {tx.category && (
                            <span className="inline-block text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md leading-tight mb-0.5">{tx.category}</span>
                          )}
                          <p className="text-[10px] text-gray-400 truncate leading-tight">
                            {tx.note || (!tx.category && <span className="italic">Không có diễn giải</span>)}
                          </p>
                        </div>
                        {/* Col 3: Số tiền + Ngày */}
                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-bold leading-tight ${col.amtColor}`}>{col.sign}{fmtMoney(Number(tx.amount))}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{fmtDateShort(tx.date || tx.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {detailTx && <TxDetailModal tx={detailTx} onClose={() => setDetailTx(null)} />}
    </div>
  );
}

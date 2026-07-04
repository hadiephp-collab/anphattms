'use client';
import { useState, useEffect, useCallback } from 'react';
import { crmApi, CrmReport, CrmKpi, CrmStaffReport } from '@/lib/reports';
import { localDateStr } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtShort = (n: number) =>
  n >= 1_000_000_000
    ? `${(n / 1_000_000_000).toFixed(1)}B`
    : n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(0)}K`
        : String(n);

function getDefaultDates(preset: string) {
  const today = localDateStr();
  const d = new Date();
  if (preset === '7d') {
    const from = localDateStr(new Date(d.getTime() - 6 * 86400000));
    return { from, to: today };
  }
  if (preset === '30d') {
    const from = localDateStr(new Date(d.getTime() - 29 * 86400000));
    return { from, to: today };
  }
  if (preset === 'month') {
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    return { from, to: today };
  }
  if (preset === 'prev_month') {
    const pm = new Date(d.getFullYear(), d.getMonth(), 0);
    const from = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}-01`;
    const to   = localDateStr(pm);
    return { from, to };
  }
  return { from: localDateStr(new Date(d.getTime() - 29 * 86400000)), to: today };
}

const RANK_COLORS: Record<string, string> = {
  new:    'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  loyal:  'bg-purple-100 text-purple-700',
  vip:    'bg-amber-100 text-amber-700',
};

// ── Period selector (dùng chung Tab 1 + Tab 3) ───────────────────────────────

function PeriodSelector({
  preset, from, to, onPreset, onFrom, onTo, onApply,
}: {
  preset: string; from: string; to: string;
  onPreset: (p: string) => void;
  onFrom: (v: string) => void;
  onTo:   (v: string) => void;
  onApply: () => void;
}) {
  const presets = [
    { key: '7d',         label: '7 ngày qua' },
    { key: '30d',        label: '30 ngày qua' },
    { key: 'month',      label: 'Tháng này' },
    { key: 'prev_month', label: 'Tháng trước' },
    { key: 'custom',     label: 'Tùy chọn' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500">Kỳ:</span>
      {presets.map((p) => (
        <button
          key={p.key}
          onClick={() => onPreset(p.key)}
          className={`px-3 py-1.5 rounded text-sm border transition-colors ${
            preset === p.key
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
          }`}
        >
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <>
          <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">–</span>
          <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
        </>
      )}
      <button
        onClick={onApply}
        className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
      >
        Áp dụng
      </button>
    </div>
  );
}

// ── Tab 1 — Đối Tác & Khách Hàng ─────────────────────────────────────────────

function TabKH() {
  const [preset, setPreset]   = useState('30d');
  const [from,   setFrom]     = useState(() => getDefaultDates('30d').from);
  const [to,     setTo]       = useState(() => getDefaultDates('30d').to);
  const [data,   setData]     = useState<CrmReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,  setError]    = useState('');

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true); setError('');
    try {
      setData(await crmApi.getReport({ from: f, to: t }));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(from, to); }, []); // eslint-disable-line

  function handlePreset(p: string) {
    setPreset(p);
    if (p !== 'custom') {
      const d = getDefaultDates(p);
      setFrom(d.from); setTo(d.to);
    }
  }

  function handleApply() { load(from, to); }

  function exportTopKH() {
    if (!data) return;
    const header = 'Hạng,Mã KH,Tên KH,Phân hạng,Số đơn,Doanh thu';
    const rows = data.topKH.map((r, i) =>
      `${i + 1},"${r.partnerCode}","${r.partnerName}","${r.rankLabel}",${r.soDon},${r.doanhThu}`,
    );
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `top-kh-${from}-${to}.csv`; a.click();
  }

  const kpi = data?.kpi;

  return (
    <div className="space-y-4">
      <PeriodSelector
        preset={preset} from={from} to={to}
        onPreset={handlePreset} onFrom={setFrom} onTo={setTo} onApply={handleApply}
      />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>}

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'KH Mua Trong Kỳ',  value: kpi?.tongKHMuaKy  ?? '—', color: '#2563eb' },
          { label: 'KH Mới',            value: kpi?.khMoiCount   ?? '—', color: '#16a34a' },
          { label: 'KH Quay Lại',       value: kpi?.khQuayLaiCount ?? '—', color: '#7c3aed' },
          { label: 'Tỷ Lệ Quay Lại',   value: kpi ? `${kpi.tyLeQuayLai}%` : '—', color: '#0891b2' },
        ].map((c) => (
          <div key={c.label} className="bg-white border rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className="text-2xl font-bold" style={{ color: loading ? '#9ca3af' : c.color }}>
              {loading ? '...' : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Grid: bảng top KH + panel KH mới */}
      <div className="grid grid-cols-5 gap-4">
        {/* Cột trái: Top 20 KH */}
        <div className="col-span-3 bg-white border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-medium text-gray-800">Top 20 Khách Hàng Doanh Thu</h3>
            <button
              onClick={exportTopKH}
              disabled={!data}
              className="text-xs text-blue-600 hover:underline disabled:opacity-40"
            >
              Xuất CSV
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Đang tải...</div>
          ) : !data?.topKH.length ? (
            <div className="p-8 text-center text-gray-400">Không có dữ liệu trong kỳ</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-right w-8">#</th>
                  <th className="px-3 py-2 text-left">Khách Hàng</th>
                  <th className="px-3 py-2 text-center">Hạng</th>
                  <th className="px-3 py-2 text-right">Số Đơn</th>
                  <th className="px-3 py-2 text-right">Ngày Cuối</th>
                  <th className="px-3 py-2 text-right">Doanh Thu</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.topKH.map((r, i) => (
                  <tr key={r.partnerId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-right text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800 truncate max-w-[180px]">{r.partnerName}</div>
                      <div className="text-xs text-gray-400 font-mono">{r.partnerCode}</div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RANK_COLORS[r.rank] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.rankLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{r.soDon}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{r.lastOrderDate}</td>
                    <td className="px-3 py-2 text-right font-medium text-blue-700">{fmtShort(r.doanhThu)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cột phải: KH mới */}
        <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-green-200">
            <h3 className="font-medium text-green-800">
              KH Mới Trong Kỳ
              {kpi && <span className="ml-2 text-green-600 font-bold">({kpi.khMoiCount})</span>}
            </h3>
            <p className="text-xs text-green-600 mt-0.5">Chưa từng mua trước kỳ này</p>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Đang tải...</div>
          ) : !data?.khMoi.length ? (
            <div className="p-8 text-center text-gray-400 text-sm">Không có KH mới trong kỳ</div>
          ) : (
            <div className="divide-y divide-green-100 max-h-[480px] overflow-y-auto">
              {data.khMoi.map((r) => (
                <div key={r.partnerId} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800 truncate text-sm">{r.partnerName}</div>
                    <div className="text-xs text-gray-400 font-mono">{r.partnerCode}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-green-700">{fmtShort(r.doanhThu)}</div>
                    <div className="text-xs text-gray-400">{r.soDon} đơn</div>
                  </div>
                </div>
              ))}
              {(kpi?.khMoiCount ?? 0) > 10 && (
                <div className="px-4 py-2 text-xs text-gray-400 text-center">
                  ... và {(kpi?.khMoiCount ?? 0) - 10} KH mới khác
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab 2 — Tổng Quan KH ─────────────────────────────────────────────────────

function TabKPI() {
  const [data,    setData]    = useState<CrmKpi | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await crmApi.getKpi()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cards = data
    ? [
        { label: 'Tổng Khách Hàng',    value: data.tongKH.toLocaleString('vi'),          color: '#2563eb' },
        { label: 'KH VIP',              value: data.soKHVIP.toLocaleString('vi'),         color: '#d97706' },
        { label: 'KH Có Công Nợ',       value: data.soKHCoNo.toLocaleString('vi'),        color: '#dc2626' },
        { label: 'Tổng Công Nợ KH',     value: fmtShort(data.tongCongNo),                color: '#dc2626' },
        { label: 'KH Mới Tháng Này',    value: data.soKHMoiThangNay.toLocaleString('vi'), color: '#16a34a' },
      ]
    : Array(5).fill({ label: '—', value: '—', color: '#9ca3af' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Số liệu tại thời điểm hiện tại{data && ` — ${data.calculatedAt}`}</p>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm text-blue-600 hover:underline disabled:opacity-40"
        >
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="bg-white border rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className="text-2xl font-bold" style={{ color: loading ? '#9ca3af' : c.color }}>
              {loading ? '...' : c.value}
            </div>
          </div>
        ))}
      </div>

      {data && (
        <div className="bg-white border rounded-lg p-4 text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium">Tổng công nợ KH: </span>
            <span className="text-red-600 font-bold">{fmt(data.tongCongNo)}</span>
            {' '}từ {data.soKHCoNo} khách hàng còn nợ
          </p>
          {data.soKHVIP > 0 && (
            <p>
              <span className="font-medium">Khách VIP: </span>
              {data.soKHVIP} / {data.tongKH} KH
              {' '}({data.tongKH > 0 ? Math.round(data.soKHVIP / data.tongKH * 100) : 0}%)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 3 — Nhân Viên ─────────────────────────────────────────────────────────

function TabNV() {
  const [preset, setPreset]   = useState('30d');
  const [from,   setFrom]     = useState(() => getDefaultDates('30d').from);
  const [to,     setTo]       = useState(() => getDefaultDates('30d').to);
  const [data,   setData]     = useState<CrmStaffReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,  setError]    = useState('');

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true); setError('');
    try { setData(await crmApi.getStaffReport({ from: f, to: t })); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(from, to); }, []); // eslint-disable-line

  function handlePreset(p: string) {
    setPreset(p);
    if (p !== 'custom') {
      const d = getDefaultDates(p);
      setFrom(d.from); setTo(d.to);
    }
  }

  function exportCSV() {
    if (!data) return;
    const header = 'Hạng,Mã NV,Họ tên,Số đơn,Số KH,DT TB/đơn,Doanh thu,% Tổng';
    const rows = data.nvList.map((r, i) =>
      `${i + 1},"${r.employeeCode}","${r.hoTen}",${r.soDon},${r.soKH},${r.doanhThuTB},${r.doanhThu},${r.doanhThuPct}%`,
    );
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `hieu-suat-nv-${from}-${to}.csv`; a.click();
  }

  const maxDt = data?.nvList[0]?.doanhThu ?? 1;

  return (
    <div className="space-y-4">
      <PeriodSelector
        preset={preset} from={from} to={to}
        onPreset={handlePreset} onFrom={setFrom} onTo={setTo}
        onApply={() => load(from, to)}
      />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>}

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'NV Có Đơn',      value: data ? data.nvList.length : '—',          color: '#2563eb' },
          { label: 'Tổng Đơn',       value: data ? data.tongDon : '—',                color: '#7c3aed' },
          { label: 'DT TB/Đơn',      value: data ? fmtShort(data.doanhThuTBDon) : '—', color: '#0891b2' },
        ].map((c) => (
          <div key={c.label} className="bg-white border rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className="text-2xl font-bold" style={{ color: loading ? '#9ca3af' : c.color }}>
              {loading ? '...' : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Bảng xếp hạng NV */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-medium text-gray-800">Bảng Xếp Hạng Nhân Viên</h3>
          <button
            onClick={exportCSV}
            disabled={!data}
            className="text-xs text-blue-600 hover:underline disabled:opacity-40"
          >
            Xuất CSV
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Đang tải...</div>
        ) : !data?.nvList.length ? (
          <div className="p-8 text-center text-gray-400">Không có dữ liệu trong kỳ</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-right w-8">#</th>
                <th className="px-3 py-2 text-left">Nhân Viên</th>
                <th className="px-3 py-2 text-right">Số Đơn</th>
                <th className="px-3 py-2 text-right">Số KH</th>
                <th className="px-3 py-2 text-right">DT TB/Đơn</th>
                <th className="px-3 py-2 text-left min-w-[160px]">Doanh Thu</th>
                <th className="px-3 py-2 text-right">% Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.nvList.map((r, i) => (
                <tr key={r.employeeId ?? i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-right text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{r.hoTen}</div>
                    {r.employeeCode && <div className="text-xs text-gray-400 font-mono">{r.employeeCode}</div>}
                  </td>
                  <td className="px-3 py-2 text-right">{r.soDon}</td>
                  <td className="px-3 py-2 text-right">{r.soKH}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmtShort(r.doanhThuTB)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[80px]">
                        <div
                          className="h-2 rounded-full bg-emerald-400"
                          style={{ width: `${Math.round((r.doanhThu / maxDt) * 100)}%` }}
                        />
                      </div>
                      <span className="text-right font-medium text-gray-700 whitespace-nowrap">
                        {fmtShort(r.doanhThu)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">{r.doanhThuPct}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 text-sm font-medium border-t">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-gray-600">Tổng cộng</td>
                <td className="px-3 py-2 text-right">{data.tongDon}</td>
                <td colSpan={2} />
                <td className="px-3 py-2">
                  <span className="font-bold text-blue-700">{fmt(data.tongDoanhThu)}</span>
                </td>
                <td className="px-3 py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'kh',  label: 'Đối Tác & Khách Hàng' },
  { key: 'kpi', label: 'Tổng Quan KH' },
  { key: 'nv',  label: 'Nhân Viên' },
];

export default function BaoCaoCRMPage() {
  const [tab, setTab] = useState<'kh' | 'kpi' | 'nv'>('kh');

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Báo Cáo CRM</h1>
      </div>

      {/* Tab bar */}
      <div className="border-b flex gap-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'kh'  && <TabKH />}
      {tab === 'kpi' && <TabKPI />}
      {tab === 'nv'  && <TabNV />}
    </div>
  );
}

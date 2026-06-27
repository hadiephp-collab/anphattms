'use client';

import { useCallback, useEffect, useState } from 'react';
import { reportsApi, ReportSummary, MonthlyPoint } from '@/lib/reports';
import { branchesApi, Branch } from '@/lib/branches';
import { localDateStr } from '@/lib/utils';

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const compact = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  return new Intl.NumberFormat('vi-VN').format(n);
};

const MONTHS_VI = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

type Preset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year';

function getDateRange(preset: Preset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = localDateStr;

  switch (preset) {
    case 'this_month':
      return { dateFrom: fmt(new Date(y, m, 1)), dateTo: fmt(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { dateFrom: fmt(new Date(y, m - 1, 1)), dateTo: fmt(new Date(y, m, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return { dateFrom: fmt(new Date(y, q * 3, 1)), dateTo: fmt(new Date(y, q * 3 + 3, 0)) };
    }
    case 'last_quarter': {
      const q = Math.floor(m / 3) - 1;
      const lq = q < 0 ? 3 : q;
      const ly = q < 0 ? y - 1 : y;
      return { dateFrom: fmt(new Date(ly, lq * 3, 1)), dateTo: fmt(new Date(ly, lq * 3 + 3, 0)) };
    }
    case 'this_year':
      return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
  }
}

const PRESET_LABELS: Record<Preset, string> = {
  this_month: 'Tháng này',
  last_month: 'Tháng trước',
  this_quarter: 'Quý này',
  last_quarter: 'Quý trước',
  this_year: 'Năm nay',
};

// ── SVG Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ data, year }: { data: MonthlyPoint[]; year: number }) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const W = 640, H = 180, PAD_L = 8, PAD_R = 8, PAD_TOP = 12, BAR_AREA_H = 140;
  const barW = (W - PAD_L - PAD_R) / 12;
  const [hovered, setHovered] = useState<number | null>(null);
  const curMonth = new Date().getMonth();

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 340 }}>
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const gy = PAD_TOP + BAR_AREA_H * (1 - frac);
          return (
            <line key={frac} x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy}
              stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
          );
        })}
        {data.map((d, i) => {
          const barH = (d.revenue / maxRevenue) * BAR_AREA_H;
          const x = PAD_L + i * barW;
          const y = PAD_TOP + BAR_AREA_H - barH;
          const cx = x + barW / 2;
          const isHov = hovered === i;
          const isCurrent = d.month - 1 === curMonth && year === new Date().getFullYear();

          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {isHov && (
                <rect x={x + 2} y={PAD_TOP} width={barW - 4} height={BAR_AREA_H}
                  fill="currentColor" fillOpacity={0.04} rx={4} />
              )}
              {d.revenue > 0 && (
                <rect
                  x={cx - barW * 0.28}
                  y={y}
                  width={barW * 0.56}
                  height={barH}
                  rx={3}
                  fill={isCurrent ? '#3b82f6' : '#2563eb'}
                  fillOpacity={isCurrent ? 1 : isHov ? 0.85 : 0.55}
                />
              )}
              <text x={cx} y={H - 4} textAnchor="middle"
                fontSize={9} fill="currentColor"
                fillOpacity={isCurrent ? 0.8 : 0.4}
                fontWeight={isCurrent ? 700 : 400}>
                {MONTHS_VI[i]}
              </text>
              {isHov && d.revenue > 0 && (
                <g>
                  <rect x={Math.min(cx - 40, W - 90)} y={Math.max(y - 36, 4)}
                    width={84} height={28} rx={5}
                    fill="#1e293b" fillOpacity={0.92} />
                  <text x={Math.min(cx, W - 48)} y={Math.max(y - 18, 18)}
                    textAnchor="middle" fontSize={9} fill="white" fillOpacity={0.7}>
                    {MONTHS_VI[i]}/{year}
                  </text>
                  <text x={Math.min(cx, W - 48)} y={Math.max(y - 7, 29)}
                    textAnchor="middle" fontSize={9.5} fill="white" fontWeight={600}>
                    {compact(d.revenue)}₫
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string; value: string; sub?: string;
  color: 'blue' | 'green' | 'red' | 'purple' | 'amber' | 'teal' | 'rose' | 'indigo';
  icon: React.ReactNode;
}
const COLORS: Record<KpiProps['color'], { bg: string; text: string; iconBg: string }> = {
  blue:   { bg: 'from-blue-500/10 to-blue-600/5',    text: 'text-blue-600',   iconBg: 'bg-blue-100' },
  green:  { bg: 'from-green-500/10 to-green-600/5',   text: 'text-green-600',  iconBg: 'bg-green-100' },
  red:    { bg: 'from-red-500/10 to-red-600/5',       text: 'text-red-600',    iconBg: 'bg-red-100' },
  purple: { bg: 'from-purple-500/10 to-purple-600/5', text: 'text-purple-600', iconBg: 'bg-purple-100' },
  amber:  { bg: 'from-amber-500/10 to-amber-600/5',   text: 'text-amber-600',  iconBg: 'bg-amber-100' },
  teal:   { bg: 'from-teal-500/10 to-teal-600/5',     text: 'text-teal-600',   iconBg: 'bg-teal-100' },
  rose:   { bg: 'from-rose-500/10 to-rose-600/5',     text: 'text-rose-600',   iconBg: 'bg-rose-100' },
  indigo: { bg: 'from-indigo-500/10 to-indigo-600/5', text: 'text-indigo-600', iconBg: 'bg-indigo-100' },
};

function KpiCard({ label, value, sub, color, icon }: KpiProps) {
  const c = COLORS[color];
  return (
    <div className={`bg-gradient-to-br ${c.bg} border border-white/60 rounded-2xl p-4 flex items-start gap-3`}>
      <div className={`${c.iconBg} rounded-xl p-2 flex-shrink-0 ${c.text}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-0.5 truncate">{label}</p>
        <p className={`text-xl font-bold ${c.text} leading-tight`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icon = {
  money: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  order: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  up: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>,
  down: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>,
  transfer: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  card: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  box: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  users: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BaoCaoTongHopPage() {
  const curYear = new Date().getFullYear();
  const [preset, setPreset] = useState<Preset>('this_month');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [trend, setTrend] = useState<MonthlyPoint[]>([]);
  const [trendYear, setTrendYear] = useState(curYear);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(undefined);

  useEffect(() => {
    branchesApi.getAll(true).then(setBranches).catch(() => {});
  }, []);

  const loadSummary = useCallback(async (p: Preset, branchId?: number) => {
    setLoading(true);
    setError('');
    try {
      const { dateFrom, dateTo } = getDateRange(p);
      const data = await reportsApi.getSummary(dateFrom, dateTo, branchId);
      setSummary(data);
    } catch (e: any) {
      setError(e.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async (year: number, branchId?: number) => {
    setTrendLoading(true);
    try {
      const data = await reportsApi.getMonthlyTrend(year, branchId);
      setTrend(data);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(preset, selectedBranchId); }, [preset, selectedBranchId, loadSummary]);
  useEffect(() => { loadTrend(trendYear, selectedBranchId); }, [trendYear, selectedBranchId, loadTrend]);

  const s = summary;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header + period chips */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo Cáo Tổng Hợp</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tổng quan kinh doanh theo kỳ</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Branch filter */}
          {branches.length > 0 && (
            <select
              value={selectedBranchId ?? ''}
              onChange={e => setSelectedBranchId(e.target.value ? Number(e.target.value) : undefined)}
              className="h-8 pl-2.5 pr-7 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 font-medium focus:outline-none focus:border-blue-400 cursor-pointer">
              <option value="">Tất cả chi nhánh</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {/* Date range badge */}
          {(() => {
            const { dateFrom, dateTo } = getDateRange(preset);
            const fmt = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            return (
              <span className="text-xs text-gray-400 bg-gray-100 rounded-lg px-2.5 py-1.5 font-mono">
                {fmt(dateFrom)} → {fmt(dateTo)}
              </span>
            );
          })()}
          {(Object.keys(PRESET_LABELS) as Preset[]).map(p => (
            <button key={p} onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}>
              {PRESET_LABELS[p]}
            </button>
          ))}
          <button onClick={() => loadSummary(preset, selectedBranchId)}
            className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
            title="Làm mới">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* KPI Row 1 — Kinh doanh */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-0.5">Kinh Doanh</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Doanh Thu" icon={Icon.money} color="blue"
            value={loading ? '...' : compact(s?.tongDoanhThu ?? 0) + '₫'}
            sub={loading ? '' : `${s?.soDon ?? 0} đơn hàng`} />
          <KpiCard label="Khách Hàng Mua" icon={Icon.users} color="indigo"
            value={loading ? '...' : String(s?.soKhachHang ?? 0)}
            sub="KH có đơn trong kỳ" />
          <KpiCard label="Tổng Thu" icon={Icon.up} color="green"
            value={loading ? '...' : compact(s?.tongThu ?? 0) + '₫'}
            sub="Phiếu thu trong kỳ" />
          <KpiCard label="Tổng Chi" icon={Icon.down} color="red"
            value={loading ? '...' : compact(s?.tongChi ?? 0) + '₫'}
            sub="Phiếu chi trong kỳ" />
        </div>
      </div>

      {/* KPI Row 2 — Tài chính & Tồn kho */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-0.5">Tài Chính & Tồn Kho</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Lưu Chuyển Tiền"
            icon={Icon.transfer}
            color={(s?.luuChuyenTienTe ?? 0) >= 0 ? 'teal' : 'rose'}
            value={loading ? '...' : compact(Math.abs(s?.luuChuyenTienTe ?? 0)) + '₫'}
            sub={loading ? '' : (s?.luuChuyenTienTe ?? 0) >= 0 ? 'Dương — tiền vào > ra' : 'Âm — tiền ra > vào'} />
          <KpiCard label="Phải Thu (KH)" icon={Icon.card} color="amber"
            value={loading ? '...' : compact(s?.tongPhaiThu ?? 0) + '₫'}
            sub="Toàn hệ thống" />
          <KpiCard label="Phải Trả (NCC)" icon={Icon.card} color="purple"
            value={loading ? '...' : compact(s?.tongPhaiTra ?? 0) + '₫'}
            sub="Toàn hệ thống" />
          <KpiCard
            label="SP Sắp / Hết Hàng"
            icon={Icon.box}
            color={(s?.spSapHet ?? 0) + (s?.spHetHang ?? 0) > 0 ? 'rose' : 'green'}
            value={loading ? '...' : `${s?.spSapHet ?? 0} / ${s?.spHetHang ?? 0}`}
            sub="Sắp hết / đã hết" />
        </div>
      </div>

      {/* Chart + Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Monthly revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Doanh Thu Theo Tháng</h3>
              <p className="text-xs text-gray-400 mt-0.5">Đơn hàng không bị huỷ</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setTrendYear(y => y - 1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-gray-700 w-10 text-center">{trendYear}</span>
              <button onClick={() => setTrendYear(y => y + 1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          {trendLoading ? (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Đang tải...</div>
          ) : (
            <BarChart data={trend} year={trendYear} />
          )}
        </div>

        {/* Low stock alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Cảnh Báo Tồn Kho</h3>
          <p className="text-xs text-gray-400 mb-3">SP dưới mức tối thiểu</p>
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-8">Đang tải...</div>
          ) : !s?.lowStockItems.length ? (
            <div className="text-center py-8">
              <svg className="w-8 h-8 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-400">Tồn kho ổn định</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {s.lowStockItems.map(item => (
                <div key={item.code}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                    item.stockQuantity <= 0
                      ? 'bg-red-50 border border-red-100'
                      : 'bg-amber-50 border border-amber-100'
                  }`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-gray-400">{item.code}</p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <span className={`font-bold ${item.stockQuantity <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {item.stockQuantity <= 0 ? 'Hết' : item.stockQuantity}
                    </span>
                    {item.stockQuantity > 0 && (
                      <p className="text-gray-400">/ {item.lowStockThreshold}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top 5 products + Top 5 partners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Top 5 Sản Phẩm Bán Chạy</h3>
          <p className="text-xs text-gray-400 mb-4">Theo số lượng đã bán trong kỳ</p>
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-6">Đang tải...</div>
          ) : !s?.topProducts.length ? (
            <div className="text-center text-gray-400 text-sm py-6">Không có dữ liệu</div>
          ) : (
            <div className="space-y-3">
              {s.topProducts.map((p, i) => {
                const pct = Math.round((p.soLuong / s.topProducts[0].soLuong) * 100);
                return (
                  <div key={p.maSanPham} className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-800 truncate max-w-[160px]">{p.tenSanPham}</span>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{p.soLuong} cái</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{compact(p.doanhThu)}₫</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-0.5">Top 5 Khách Hàng</h3>
          <p className="text-xs text-gray-400 mb-4">Theo doanh thu trong kỳ</p>
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-6">Đang tải...</div>
          ) : !s?.topPartners.length ? (
            <div className="text-center text-gray-400 text-sm py-6">Không có dữ liệu</div>
          ) : (
            <div className="space-y-3">
              {s.topPartners.map((p, i) => {
                const pct = Math.round((p.doanhThu / s.topPartners[0].doanhThu) * 100);
                return (
                  <div key={p.maKhachHang} className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-800 truncate max-w-[160px]">{p.tenKhachHang}</span>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{p.soDon} đơn</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{compact(p.doanhThu)}₫</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Net debt position strip */}
      {s && (
        <div className={`rounded-2xl border p-4 flex items-center gap-4 flex-wrap ${
          s.viTheRong >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'
        }`}>
          <span className={`text-sm font-medium ${s.viTheRong >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            Vị Thế Công Nợ Ròng (toàn hệ thống):
          </span>
          <span className={`text-lg font-bold ${s.viTheRong >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            {s.viTheRong >= 0 ? '+' : ''}{vnd(s.viTheRong)}
          </span>
          <span className="text-xs text-gray-400 ml-auto">
            Phải thu {vnd(s.tongPhaiThu)} − Phải trả {vnd(s.tongPhaiTra)}
          </span>
        </div>
      )}
    </div>
  );
}

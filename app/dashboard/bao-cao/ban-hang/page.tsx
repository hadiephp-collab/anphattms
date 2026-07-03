'use client';
import { useState, useEffect, useCallback } from 'react';
import { reportsApi, SalesReport } from '@/lib/reports';
import { localDateStr } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
  return new Intl.NumberFormat('vi-VN').format(n);
};

const PTTT_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  other: 'Khác',
};

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function firstOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return localDateStr(d);
}

function firstOfLastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return localDateStr(d);
}

function lastOfLastMonth(): string {
  const d = new Date();
  d.setDate(0);
  return localDateStr(d);
}

type Preset = '7d' | '30d' | 'this_month' | 'last_month' | 'custom';

function presetDates(p: Preset): { from: string; to: string } {
  const today = localDateStr();
  if (p === '7d') return { from: nDaysAgo(6), to: today };
  if (p === '30d') return { from: nDaysAgo(29), to: today };
  if (p === 'this_month') return { from: firstOfMonth(), to: today };
  if (p === 'last_month') return { from: firstOfLastMonth(), to: lastOfLastMonth() };
  return { from: nDaysAgo(29), to: today };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  trend,
  sub,
}: {
  label: string;
  value: string;
  trend?: number;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
      {trend !== undefined && (
        <p className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% so kỳ trước
        </p>
      )}
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniBarChart({ series }: { series: { period: string; doanhThu: number; soDon: number }[] }) {
  if (!series.length) return <p className="text-sm text-gray-400 py-8 text-center">Không có dữ liệu</p>;
  const max = Math.max(...series.map((s) => s.doanhThu), 1);
  return (
    <div className="flex items-end gap-px h-32 mt-2 overflow-x-auto pb-1">
      {series.map((s) => {
        const pct = Math.max((s.doanhThu / max) * 100, 2);
        return (
          <div
            key={s.period}
            className="flex flex-col items-center flex-1 min-w-[6px] group"
            title={`${s.period}\n${fmtShort(s.doanhThu)} (${s.soDon} đơn)`}
          >
            <div
              className="w-full bg-blue-500 group-hover:bg-blue-600 rounded-t transition-colors"
              style={{ height: `${pct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BaoCaoBanHangPage() {
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState(nDaysAgo(29));
  const [customTo, setCustomTo] = useState(localDateStr());
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const [data, setData] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { from, to } = preset === 'custom' ? { from: customFrom, to: customTo } : presetDates(preset);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.getSalesReport(from, to, groupBy);
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Lỗi tải báo cáo');
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy]);

  useEffect(() => {
    if (preset !== 'custom') load();
  }, [preset, groupBy]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleApply() {
    load();
  }

  function exportXlsx() {
    if (!data) return;
    import('xlsx').then((XLSX) => {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Series
      const s1 = [
        ['Kỳ', 'Số đơn', 'Doanh thu (VNĐ)'],
        ...data.series.map((r) => [r.period, r.soDon, r.doanhThu]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s1), 'Theo Kỳ');

      // Sheet 2: Top SP
      const s2 = [
        ['Mã SP', 'Tên SP', 'Danh mục', 'Số lượng', 'Doanh thu (VNĐ)'],
        ...data.topProducts.map((r) => [r.productCode, r.productName, r.category, r.tongSoLuong, r.doanhThu]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s2), 'Top Sản Phẩm');

      // Sheet 3: Top Khách Hàng
      const s3 = [
        ['Mã KH', 'Tên khách hàng', 'Số đơn', 'Doanh thu (VNĐ)'],
        ...data.byCustomer.map((r) => [r.customerCode, r.customerName, r.soDon, r.doanhThu]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s3), 'Top Khách Hàng');

      // Sheet 4: Top Nhân Viên
      const s4 = [
        ['Mã NV', 'Họ tên', 'Số đơn', 'Doanh thu (VNĐ)'],
        ...data.byEmployee.map((r) => [r.employeeCode, r.employeeName, r.soDon, r.doanhThu]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s4), 'Top Nhân Viên');

      XLSX.writeFile(wb, `BaoCaoBanHang_${from}_${to}.xlsx`);
    });
  }

  const kpi = data?.kpi;
  const maxDoanhThu = data ? Math.max(...data.byCategory.map((c) => c.doanhThu), 1) : 1;
  const maxPttt = data ? Math.max(...data.byPaymentMethod.map((p) => p.tongThanhToan), 1) : 1;
  const maxEmp = data?.byEmployee.length ? Math.max(...data.byEmployee.map((e) => e.doanhThu), 1) : 1;
  const maxCust = data?.byCustomer.length ? Math.max(...data.byCustomer.map((c) => c.doanhThu), 1) : 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Báo Cáo Bán Hàng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Phân tích doanh thu theo kỳ · sản phẩm · danh mục · thanh toán</p>
        </div>
        <button
          onClick={exportXlsx}
          disabled={!data}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Xuất Excel
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3">
        {/* Preset */}
        <div className="flex gap-1">
          {([
            { v: '7d', l: '7 ngày' },
            { v: '30d', l: '30 ngày' },
            { v: 'this_month', l: 'Tháng này' },
            { v: 'last_month', l: 'Tháng trước' },
            { v: 'custom', l: 'Tùy chọn' },
          ] as { v: Preset; l: string }[]).map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setPreset(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
            />
            <span className="text-gray-400 text-xs">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
            />
            <button
              onClick={handleApply}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
            >
              Áp dụng
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Group by */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Nhóm theo:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="day">Ngày</option>
            <option value="week">Tuần</option>
            <option value="month">Tháng</option>
          </select>
        </div>

        {/* Date range display */}
        {data && (
          <span className="text-xs text-gray-400 ml-1">
            {from} → {to}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span>⚠️ {error}</span>
          <button onClick={load} className="ml-auto text-xs underline">Thử lại</button>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              label="Số Đơn"
              value={data.kpi.soDon.toLocaleString('vi-VN')}
              trend={kpi!.trendSoDon}
              sub={`Kỳ trước: ${kpi!.soDonPrev} đơn`}
            />
            <KpiCard
              label="Doanh Thu"
              value={fmtShort(data.kpi.doanhThu)}
              trend={kpi!.trendDoanhThu}
              sub={`Kỳ trước: ${fmtShort(kpi!.doanhThuPrev)}`}
            />
            <KpiCard
              label="Trung Bình / Đơn"
              value={fmtShort(data.kpi.doanhThuTrungBinh)}
            />
            <KpiCard
              label="Trả Hàng (đã duyệt)"
              value={`${data.returnsKpi.soPhieuTra} phiếu`}
              sub={data.returnsKpi.tongHoanTien > 0 ? `Hoàn: ${fmtShort(data.returnsKpi.tongHoanTien)}` : 'Không có hoàn tiền'}
            />
          </div>

          {/* Grid: Chart + PTTT */}
          <div className="grid grid-cols-5 gap-4">
            {/* Chart */}
            <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-800">Doanh Thu Theo Kỳ</h3>
                <span className="text-xs text-gray-400">{data.series.length} điểm</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">Bao gồm đơn đang xử lý (không tính đơn hủy)</p>
              <MiniBarChart series={data.series} />
              {/* Table below chart */}
              <div className="mt-3 overflow-auto max-h-44">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-100">
                      <th className="pb-1 font-medium">Kỳ</th>
                      <th className="pb-1 font-medium text-right">Số đơn</th>
                      <th className="pb-1 font-medium text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((s) => (
                      <tr key={s.period} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1 font-mono text-gray-600">{s.period}</td>
                        <td className="py-1 text-right text-gray-700">{s.soDon}</td>
                        <td className="py-1 text-right text-gray-900 font-medium">{fmtShort(s.doanhThu)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PTTT */}
            <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Theo Phương Thức Thanh Toán</h3>
              {data.byPaymentMethod.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Không có dữ liệu</p>
              ) : (
                <div className="space-y-3">
                  {data.byPaymentMethod.map((p) => {
                    const pct = Math.round((p.tongThanhToan / maxPttt) * 100);
                    return (
                      <div key={p.paymentMethod}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700">{PTTT_LABEL[p.paymentMethod] ?? p.paymentMethod}</span>
                          <span className="text-gray-500">{fmtShort(p.tongThanhToan)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full">
                          <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{p.soLanThanhToan} lần thanh toán</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Grid: Top Khách Hàng + Top Nhân Viên */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top Khách Hàng */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Top 10 Khách Hàng</h3>
              {data.byCustomer.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Không có dữ liệu</p>
              ) : (
                <div className="space-y-2.5 overflow-auto max-h-72">
                  {data.byCustomer.map((c, i) => {
                    const pct = Math.round((c.doanhThu / maxCust) * 100);
                    return (
                      <div key={c.customerId ?? `lẻ-${i}`}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-gray-400 font-mono w-4 shrink-0">{i + 1}</span>
                            <span className="font-medium text-gray-800 truncate">{c.customerName}</span>
                            {c.customerCode && (
                              <span className="text-[10px] text-gray-400 shrink-0">{c.customerCode}</span>
                            )}
                          </span>
                          <span className="text-gray-700 font-medium shrink-0 ml-2">{fmtShort(c.doanhThu)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{c.soDon} đơn hàng</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Nhân Viên */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Top 10 Nhân Viên</h3>
              {data.byEmployee.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Không có dữ liệu</p>
              ) : (
                <div className="space-y-2.5 overflow-auto max-h-72">
                  {data.byEmployee.map((e, i) => {
                    const pct = Math.round((e.doanhThu / maxEmp) * 100);
                    return (
                      <div key={e.employeeId ?? `none-${i}`}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-gray-400 font-mono w-4 shrink-0">{i + 1}</span>
                            <span className="font-medium text-gray-800 truncate">{e.employeeName}</span>
                            {e.employeeCode && (
                              <span className="text-[10px] text-gray-400 shrink-0">{e.employeeCode}</span>
                            )}
                          </span>
                          <span className="text-gray-700 font-medium shrink-0 ml-2">{fmtShort(e.doanhThu)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{e.soDon} đơn hàng</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Grid: Top SP + Danh mục */}
          <div className="grid grid-cols-5 gap-4">
            {/* Top SP */}
            <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Top 20 Sản Phẩm Bán Chạy</h3>
              {data.topProducts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Không có dữ liệu</p>
              ) : (
                <div className="overflow-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="pb-1 font-medium w-6">#</th>
                        <th className="pb-1 font-medium">Sản phẩm</th>
                        <th className="pb-1 font-medium text-right">SL</th>
                        <th className="pb-1 font-medium text-right">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => {
                        const maxDT = data.topProducts[0]?.doanhThu || 1;
                        const barPct = Math.round((p.doanhThu / maxDT) * 100);
                        return (
                          <tr key={p.productCode} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-1.5 text-gray-400 font-mono">{i + 1}</td>
                            <td className="py-1.5 max-w-[160px]">
                              <p className="font-medium text-gray-800 truncate">{p.productName}</p>
                              <p className="text-[10px] text-gray-400">{p.productCode} · {p.category}</p>
                              <div className="mt-0.5 h-1 bg-gray-100 rounded-full">
                                <div className="h-1 bg-blue-400 rounded-full" style={{ width: `${barPct}%` }} />
                              </div>
                            </td>
                            <td className="py-1.5 text-right text-gray-600">{p.tongSoLuong}</td>
                            <td className="py-1.5 text-right font-medium text-gray-900">{fmtShort(p.doanhThu)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* By category */}
            <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Theo Danh Mục</h3>
              {data.byCategory.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Không có dữ liệu</p>
              ) : (
                <div className="space-y-3 overflow-auto max-h-80">
                  {data.byCategory.map((c) => {
                    const pct = Math.round((c.doanhThu / maxDoanhThu) * 100);
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`font-medium ${c.category === 'Chưa phân loại' ? 'text-gray-400' : 'text-gray-700'}`}>
                            {c.category}
                          </span>
                          <span className="text-gray-500">{fmtShort(c.doanhThu)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full">
                          <div
                            className={`h-2 rounded-full ${c.category === 'Chưa phân loại' ? 'bg-gray-300' : 'bg-purple-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{c.tongSoLuong} sản phẩm</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Chọn kỳ và nhấn Áp dụng để tải báo cáo</p>
        </div>
      )}
    </div>
  );
}

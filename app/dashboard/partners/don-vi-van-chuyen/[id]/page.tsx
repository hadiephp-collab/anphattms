'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { partnersApi } from '@/lib/partners';
import { purchaseOrdersApi } from '@/lib/purchase-orders';
import { transactionsApi } from '@/lib/transactions';

const fmtMoney = (v?: number | string | null) => {
  const n = Number(v ?? 0);
  return n > 0 ? n.toLocaleString('vi-VN') : '—';
};

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
};

const VC_LABEL: Record<string, string> = { bien: 'Đường biển', bo: 'Đường bộ', ket_hop: 'Kết hợp' };
const VC_STYLE: Record<string, string> = {
  bien:    'bg-blue-50 text-blue-700 border border-blue-100',
  bo:      'bg-amber-50 text-amber-700 border border-amber-100',
  ket_hop: 'bg-teal-50 text-teal-700 border border-teal-100',
};

const PO_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', ordered: 'Đặt hàng', received: 'Đã nhận', cancelled: 'Đã huỷ',
};
const PO_STATUS_STYLE: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  ordered:   'bg-blue-50 text-blue-600',
  received:  'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-red-50 text-red-400',
};

const PAGE_SIZE = 20;

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/60">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-2 py-1 border-b border-gray-50 last:border-0">
      <span className="text-[11px] text-gray-400 flex-shrink-0 w-24">{label}</span>
      <span className={`text-[11px] text-right flex-1 leading-relaxed ${mono ? 'font-mono text-gray-600' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  );
}

interface Partner {
  id: number; code: string; name: string; isActive: boolean;
  phone?: string; contactPhone2?: string; email?: string; contactPerson?: string;
  address?: string; province?: string;
  bankAccount?: string; bankName?: string; bankAccountHolder?: string; bankBranch?: string;
  supplierDebt?: number; rating?: number;
  phuongThucVanChuyen?: string | null;
  phuongThucTinhCuoc?: string | null;
  dacDiem?: string | null;
  diaChiKhoVN?: string | null;
  diaChiKhoTQ?: string | null;
}

interface PO {
  id: number; code: string; status: string;
  expectedDate?: string; receivedDate?: string;
  supplierName?: string;
  shippingFee?: number; shippingFeePaid?: number; shippingFeeDebt?: number;
}

interface TrendItem {
  key: string;
  label: string;
  count: number;
  fee: number;
}

interface TxRecord {
  id: number;
  code?: string;
  date: string;
  amount: number;
  type: string;
  paymentMethod?: string;
  reference?: string;
  category?: string;
  description?: string;
  notes?: string;
  createdByName?: string;
}

export default function FreightPartnerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(true);

  // All-time orders — for KPI + trend chart
  const [allOrders, setAllOrders] = useState<PO[]>([]);

  // Filtered/paged orders — for the table
  const [orders, setOrders] = useState<PO[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Trend view mode
  const [trendMode, setTrendMode] = useState<'month' | 'quarter'>('month');

  // Left-panel tab
  const [activeTab, setActiveTab] = useState<'po' | 'payments'>('po');

  // Payment history (phiếu chi linked to this freight partner)
  const [payments, setPayments] = useState<TxRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsFetched, setPaymentsFetched] = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // KPI derived from all-time orders
  const kpi = useMemo(() => ({
    totalFee:  allOrders.reduce((s, o) => s + Number(o.shippingFee  ?? 0), 0),
    totalPaid: allOrders.reduce((s, o) => s + Number(o.shippingFeePaid ?? 0), 0),
    totalDebt: allOrders.reduce((s, o) => s + Number(o.shippingFeeDebt ?? 0), 0),
  }), [allOrders]);

  // Trend data — group by month or quarter
  const trendData: TrendItem[] = useMemo(() => {
    const map = new Map<string, TrendItem>();
    for (const po of allOrders) {
      const dateStr = po.receivedDate ?? po.expectedDate;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      let key: string, label: string;
      if (trendMode === 'month') {
        key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
      } else {
        const q = Math.ceil((d.getMonth() + 1) / 3);
        key   = `${d.getFullYear()}-Q${q}`;
        label = `Q${q}/${String(d.getFullYear()).slice(2)}`;
      }
      const ex = map.get(key) ?? { key, label, count: 0, fee: 0 };
      ex.count += 1;
      ex.fee   += Number(po.shippingFee ?? 0);
      map.set(key, ex);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [allOrders, trendMode]);

  const maxFee   = Math.max(...trendData.map(d => d.fee), 1);
  const peakItem = trendData.reduce<TrendItem | null>((a, b) => (!a || b.fee > a.fee ? b : a), null);

  // Trend direction: compare last 3 vs previous 3 periods
  const trendPct = useMemo(() => {
    if (trendData.length < 4) return null;
    const recent = trendData.slice(-3).reduce((s, d) => s + d.fee, 0) / 3;
    const prev   = trendData.slice(-6, -3).reduce((s, d) => s + d.fee, 0) / 3;
    if (prev <= 0) return null;
    return Math.round((recent - prev) / prev * 100);
  }, [trendData]);

  // Fetch partner info once
  useEffect(() => {
    if (!id) return;
    partnersApi.getOne(Number(id))
      .then((p) => setPartner(p as Partner))
      .catch(() => {})
      .finally(() => setPartnerLoading(false));
  }, [id]);

  // Fetch all-time orders for KPI + trend (sorted oldest-first)
  useEffect(() => {
    if (!id) return;
    purchaseOrdersApi.getAll({ freightAgentId: id, limit: '500', sortBy: 'createdAt', sortOrder: 'asc' })
      .then((res) => {
        const list: PO[] = (res as any)?.data ?? res;
        if (Array.isArray(list)) setAllOrders(list);
      })
      .catch(() => {});
  }, [id]);

  // Fetch filtered/paged PO list for the table
  const fetchOrders = useCallback(() => {
    if (!id) return;
    setOrdersLoading(true);
    const qp: Record<string, string> = {
      freightAgentId: id,
      page:      String(page),
      limit:     String(PAGE_SIZE),
      sortBy:    'createdAt',
      sortOrder: 'desc',
    };
    if (statusFilter) qp.status   = statusFilter;
    if (dateFrom)     qp.dateFrom = dateFrom;
    if (dateTo)       qp.dateTo   = dateTo;

    purchaseOrdersApi.getAll(qp)
      .then((res) => {
        const data: PO[] = (res as any)?.data ?? res;
        const tot: number = (res as any)?.total ?? (Array.isArray(data) ? data.length : 0);
        setOrders(Array.isArray(data) ? data : []);
        setTotal(tot);
      })
      .catch(() => { setOrders([]); setTotal(0); })
      .finally(() => setOrdersLoading(false));
  }, [id, page, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Fetch payment history once when tab is opened (lazy)
  useEffect(() => {
    if (activeTab !== 'payments' || paymentsFetched || !id) return;
    setPaymentsLoading(true);
    setPaymentsFetched(true);
    transactionsApi.getAll({ partnerId: id, type: 'payment', limit: '200', sortBy: 'date', sortOrder: 'desc' })
      .then((res) => {
        const list: TxRecord[] = Array.isArray(res) ? res : (res?.data ?? []);
        setPayments(list);
      })
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, [activeTab, paymentsFetched, id]);

  const clearFilters = () => { setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const hasFilter = statusFilter || dateFrom || dateTo;

  if (partnerLoading) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">Đang tải...</div>
  );
  if (!partner) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-gray-500 text-sm">Không tìm thấy đơn vị vận chuyển.</p>
      <button onClick={() => router.push('/dashboard/partners/don-vi-van-chuyen')} className="text-sm text-blue-600 hover:underline">← Quay lại</button>
    </div>
  );

  const debtDisplay = partner.supplierDebt ?? kpi.totalDebt;

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => router.push('/dashboard/partners/don-vi-van-chuyen')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Đơn Vị Vận Chuyển
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{partner.name}</span>
          <span className="text-[11px] text-gray-400 font-mono">{partner.code}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${partner.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
            {partner.isActive ? 'Hoạt động' : 'Ngừng'}
          </span>
          <button
            onClick={() => router.push(`/dashboard/partners/${partner.id}/edit`)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 transition">
            Sửa thông tin
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="px-4 pt-2.5 pb-0 flex gap-2 flex-shrink-0">
        {[
          { label: 'Tổng PO',       val: allOrders.length,        color: 'text-blue-600' },
          { label: 'Tổng phí VC',   val: fmtMoney(kpi.totalFee),  color: 'text-violet-600' },
          { label: 'Còn nợ',        val: fmtMoney(debtDisplay),   color: debtDisplay > 0 ? 'text-red-500' : 'text-gray-400' },
          { label: 'Đã thanh toán', val: fmtMoney(kpi.totalPaid), color: 'text-emerald-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-lg border border-gray-100 px-3 py-1.5 flex items-center gap-4">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide whitespace-nowrap">{k.label}</span>
            <span className={`text-xs font-bold ${k.color}`}>{k.val}</span>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-3 items-start">

          {/* LEFT — trend + PO table */}
          <div className="flex-1 min-w-0 bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden flex flex-col">

            {/* ── Tab bar ── */}
            <div className="flex items-center gap-0 border-b border-gray-100 px-4 pt-2 flex-shrink-0">
              {([
                { key: 'po',       label: 'Đơn hàng nhập', count: total },
                { key: 'payments', label: 'Thanh toán phí VC', count: payments.length },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 pb-1.5 text-xs font-semibold border-b-2 transition-colors mr-1 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {tab.label}
                  {(tab.key === 'po' ? total > 0 : payments.length > 0) && (
                    <span className={`ml-1 text-[10px] px-1 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400'}`}>
                      {tab.key === 'po' ? total : payments.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'po' && (<>

            {/* ── Trend chart (only when there's data) ── */}
            {trendData.length > 0 && (
              <div className="border-b border-gray-100 px-4 pt-3 pb-2">

                {/* Trend header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Xu hướng phí vận chuyển
                    </h4>
                    {trendPct !== null && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        trendPct > 5  ? 'bg-red-50 text-red-500' :
                        trendPct < -5 ? 'bg-emerald-50 text-emerald-600' :
                                        'bg-gray-50 text-gray-400'
                      }`}>
                        {trendPct > 5 ? '↑' : trendPct < -5 ? '↓' : '→'}&nbsp;
                        {Math.abs(trendPct)}% so với {trendMode === 'month' ? '3T' : '3Q'} trước
                      </span>
                    )}
                    {peakItem && peakItem.fee > 0 && (
                      <span className="text-[10px] text-gray-400">
                        Đỉnh:&nbsp;
                        <span className="font-semibold text-blue-600">{peakItem.label}</span>
                        &nbsp;({fmtShort(peakItem.fee)}₫ · {peakItem.count} PO)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5 flex-shrink-0">
                    {(['month', 'quarter'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setTrendMode(m)}
                        className={`text-[10px] px-2 py-0.5 rounded transition ${
                          trendMode === m
                            ? 'bg-white text-gray-700 shadow-sm font-semibold'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}>
                        {m === 'month' ? 'Tháng' : 'Quý'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bar chart */}
                <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: 86 }}>
                  {trendData.map((d, idx) => {
                    const pct    = maxFee > 0 ? (d.fee / maxFee) * 100 : 0;
                    const isPeak = d.key === peakItem?.key;
                    const isLast = idx === trendData.length - 1;
                    return (
                      <div
                        key={d.key}
                        className="flex flex-col items-center flex-shrink-0"
                        style={{ width: trendMode === 'quarter' ? 44 : 30 }}>
                        {/* value label above bar — only for peak + last */}
                        <span className="text-[8px] leading-none mb-0.5 h-3 text-center" style={{ color: isPeak ? '#2563eb' : '#d1d5db' }}>
                          {(isPeak || isLast) && d.fee > 0 ? fmtShort(d.fee) : ''}
                        </span>
                        {/* bar container */}
                        <div className="w-full flex items-end" style={{ height: 52 }}>
                          <div
                            className={`w-full rounded-t-sm transition-all ${isPeak ? 'bg-blue-500' : 'bg-blue-100 hover:bg-blue-200'}`}
                            style={{ height: d.fee > 0 ? `${Math.max(pct, 4)}%` : '2px' }}
                            title={`${d.label}: ${fmtMoney(d.fee)}₫ · ${d.count} PO`}
                          />
                        </div>
                        {/* month / quarter label */}
                        <span className={`text-[8px] leading-none mt-0.5 ${isPeak ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                          {d.label}
                        </span>
                        {/* PO count */}
                        <span className="text-[7px] text-gray-300 leading-none">
                          {d.count > 0 ? `${d.count}đ` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Filter bar ── */}
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
                  Lịch sử đơn hàng nhập
                  {total > 0 && <span className="ml-1.5 text-gray-300 font-normal">{total} đơn</span>}
                </h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="text-[11px] border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:border-blue-300">
                    <option value="">Tất cả trạng thái</option>
                    <option value="draft">Nháp</option>
                    <option value="ordered">Đặt hàng</option>
                    <option value="received">Đã nhận</option>
                    <option value="cancelled">Đã huỷ</option>
                  </select>
                  <input
                    type="date" value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="text-[11px] border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:border-blue-300 w-32"
                    title="Từ ngày"
                  />
                  <span className="text-[11px] text-gray-300">→</span>
                  <input
                    type="date" value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="text-[11px] border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:border-blue-300 w-32"
                    title="Đến ngày"
                  />
                  {hasFilter && (
                    <button onClick={clearFilters} className="text-[11px] text-gray-400 hover:text-red-400 px-1.5 py-1 rounded transition">
                      ✕ Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 overflow-x-auto">
              {ordersLoading ? (
                <div className="flex items-center justify-center py-10 text-xs text-gray-400">Đang tải...</div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-xs text-gray-300">
                    {hasFilter ? 'Không có đơn hàng phù hợp với bộ lọc' : 'Chưa có đơn hàng nhập nào gắn với đơn vị vận chuyển này'}
                  </p>
                  {hasFilter && (
                    <button onClick={clearFilters} className="text-xs text-blue-500 hover:underline mt-1">Xóa bộ lọc</button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Mã PO', 'Ngày', 'Nhà cung cấp', 'Phí VC', 'Đã TT', 'Còn nợ', 'Trạng thái'].map((h, i) => (
                        <th key={h} className={`px-4 py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide ${i >= 3 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((po) => (
                      <tr
                        key={po.id}
                        className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/don-hang-nhap/${po.id}`)}>
                        <td className="px-4 py-2">
                          <span className="font-mono text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{po.code}</span>
                        </td>
                        <td className="px-4 py-2 text-[11px] text-gray-500 whitespace-nowrap">
                          {po.receivedDate ?? po.expectedDate ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-gray-700">{po.supplierName ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-[11px] text-gray-700">{fmtMoney(po.shippingFee)}</td>
                        <td className="px-4 py-2 text-right text-[11px] text-emerald-600">{fmtMoney(po.shippingFeePaid)}</td>
                        <td className="px-4 py-2 text-right text-[11px] text-red-500 font-medium">{fmtMoney(po.shippingFeeDebt)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PO_STATUS_STYLE[po.status] ?? 'bg-gray-50 text-gray-400'}`}>
                            {PO_STATUS_LABEL[po.status] ?? po.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
                <span className="text-[11px] text-gray-400">Trang {page}/{totalPages} · {total} đơn</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 text-[11px] border border-gray-200 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    ‹ Trước
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | '...')[]>((acc, p, i, arr) => {
                      if (i > 0 && (arr[i - 1] as number) + 1 < p) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '...' ? (
                        <span key={`e-${i}`} className="px-1 text-[11px] text-gray-300">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`px-2 py-1 text-[11px] border rounded transition ${page === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-2 py-1 text-[11px] border border-gray-200 rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    Sau ›
                  </button>
                </div>
              </div>
            )}

            </>)}

            {/* ── Payment history tab ── */}
            {activeTab === 'payments' && (
              <div className="flex-1 overflow-x-auto">
                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-10 text-xs text-gray-400">Đang tải...</div>
                ) : payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                    <p className="text-xs text-gray-300">Chưa có phiếu chi nào liên kết với đơn vị vận chuyển này</p>
                    <p className="text-[11px] text-gray-300">Để có lịch sử, hãy chọn đơn vị VC khi tạo phiếu chi thanh toán phí vận chuyển</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Ngày', 'Mã phiếu', 'Nội dung', 'Số tiền', 'PTTT', 'Người tạo'].map((h, i) => (
                          <th key={h} className={`px-4 py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((tx) => (
                        <tr key={tx.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-2 text-[11px] text-gray-500 whitespace-nowrap">{tx.date ?? '—'}</td>
                          <td className="px-4 py-2">
                            {tx.code
                              ? <span className="font-mono text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{tx.code}</span>
                              : <span className="text-gray-300 text-[11px]">#{tx.id}</span>}
                          </td>
                          <td className="px-4 py-2 text-[11px] text-gray-700">
                            {tx.description || tx.category || (tx.reference ? `Ref: ${tx.reference}` : '—')}
                          </td>
                          <td className="px-4 py-2 text-right text-[11px] font-semibold text-red-500">
                            {Number(tx.amount) > 0 ? Number(tx.amount).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="px-4 py-2 text-[11px] text-gray-500">{tx.paymentMethod ?? '—'}</td>
                          <td className="px-4 py-2 text-[11px] text-gray-400">{tx.createdByName ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-100 bg-gray-50/40">
                        <td colSpan={3} className="px-4 py-2 text-[11px] text-gray-400 font-semibold">Tổng {payments.length} phiếu chi</td>
                        <td className="px-4 py-2 text-right text-[11px] font-bold text-red-500">
                          {payments.reduce((s, t) => s + Number(t.amount ?? 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td colSpan={2}/>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Info sidebar */}
          <div className="w-64 flex-shrink-0 space-y-2.5">

            <SideCard title="Vận chuyển">
              {partner.phuongThucVanChuyen ? (
                <div>
                  <Row label="Phương thức" value={
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${VC_STYLE[partner.phuongThucVanChuyen] ?? 'bg-gray-50 text-gray-500'}`}>
                      {VC_LABEL[partner.phuongThucVanChuyen] ?? partner.phuongThucVanChuyen}
                    </span>
                  } />
                  <Row label="Kho Việt Nam"   value={partner.diaChiKhoVN         || undefined} />
                  <Row label="Kho Trung Quốc" value={partner.diaChiKhoTQ         || undefined} />
                  <Row label="Tính cước"       value={partner.phuongThucTinhCuoc  || undefined} />
                  <Row label="Đặc điểm"        value={partner.dacDiem             || undefined} />
                </div>
              ) : (
                <div className="text-center py-1.5">
                  <p className="text-[11px] text-gray-300 mb-1">Chưa thiết lập</p>
                  <button
                    onClick={() => router.push(`/dashboard/partners/${partner.id}/edit`)}
                    className="text-[11px] text-blue-500 hover:underline">
                    + Thêm thông tin
                  </button>
                </div>
              )}
            </SideCard>

            <SideCard title="Liên hệ">
              {partner.rating != null && partner.rating > 0 && (
                <div className="flex justify-between items-center py-1 border-b border-gray-50">
                  <span className="text-[11px] text-gray-400 w-24">Đánh giá</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={`text-xs ${s <= (partner.rating ?? 0) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                </div>
              )}
              <Row label="Điện thoại"  value={partner.phone ? <a href={`tel:${partner.phone}`} className="text-blue-600 hover:underline">{partner.phone}</a> : undefined} />
              <Row label="Điện thoại 2" value={partner.contactPhone2} />
              <Row label="Email"        value={partner.email ? <a href={`mailto:${partner.email}`} className="text-blue-600 hover:underline truncate block max-w-[130px]">{partner.email}</a> : undefined} />
              <Row label="Người LH"     value={partner.contactPerson} />
              <Row label="Địa chỉ"      value={partner.address} />
              <Row label="Tỉnh / TP"    value={partner.province} />
            </SideCard>

            {(partner.bankAccount || partner.bankName) && (
              <SideCard title="Tài khoản NH">
                <Row label="Ngân hàng" value={partner.bankName} />
                <Row label="Số TK"     value={partner.bankAccount} mono />
                <Row label="Chủ TK"    value={partner.bankAccountHolder} />
                <Row label="Chi nhánh" value={partner.bankBranch} />
              </SideCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

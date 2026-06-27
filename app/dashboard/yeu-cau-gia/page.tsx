'use client';

import { useEffect, useState, useCallback } from 'react';
import { ycgApi, YeuCauGia, YCGKpi, TopSPRow, YCGStatus } from '@/lib/yeu-cau-gia';
import { productsApi } from '@/lib/products';
import { localDateStr } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const STATUS_LABEL: Record<YCGStatus, string> = {
  ChoXetDuyet: 'Chờ xét duyệt',
  DaDuyet: 'Đã duyệt',
  TuChoi: 'Từ chối',
  DaHuy: 'Đã hủy',
};

const STATUS_COLOR: Record<YCGStatus, string> = {
  ChoXetDuyet: 'bg-yellow-100 text-yellow-700',
  DaDuyet: 'bg-green-100 text-green-700',
  TuChoi: 'bg-red-100 text-red-700',
  DaHuy: 'bg-gray-100 text-gray-500',
};

function StatusBadge({ status }: { status: YCGStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface Product { id: number; code: string; name: string; sellingPrice: number }

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productQ, setProductQ] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [proposedPrice, setProposedPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [orderCode, setOrderCode] = useState('');
  const [reason, setReason] = useState('');
  const [saleNote, setSaleNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    productsApi.getAll().then((res: any) => setProducts(res.data ?? res)).catch(() => {});
  }, []);

  const filtered = products.filter(
    (p) =>
      p.code.toLowerCase().includes(productQ.toLowerCase()) ||
      p.name.toLowerCase().includes(productQ.toLowerCase()),
  );

  const currentPrice = selectedProduct?.sellingPrice ?? 0;
  const proposed = parseFloat(proposedPrice) || 0;
  const discountPct =
    currentPrice > 0 && proposed > 0 && proposed < currentPrice
      ? Math.round(((currentPrice - proposed) / currentPrice) * 100 * 100) / 100
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedProduct) { setError('Vui lòng chọn sản phẩm'); return; }
    if (!proposedPrice || proposed <= 0) { setError('Vui lòng nhập giá đề xuất hợp lệ'); return; }
    if (proposed >= currentPrice) { setError(`Giá đề xuất phải nhỏ hơn giá hiện tại (${fmt(currentPrice)})`); return; }
    if (!reason.trim()) { setError('Vui lòng nhập lý do'); return; }

    setSaving(true);
    try {
      await ycgApi.create({
        productId: selectedProduct.id,
        proposedPrice: proposed,
        quantity: parseInt(quantity) || 1,
        reason: reason.trim(),
        saleNote: saleNote.trim() || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message ?? 'Lỗi khi tạo yêu cầu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Tạo Yêu Cầu Giá</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Chọn sản phẩm */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sản phẩm <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={selectedProduct ? `${selectedProduct.code} — ${selectedProduct.name}` : productQ}
                onChange={(e) => { setProductQ(e.target.value); setSelectedProduct(null); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Tìm theo mã hoặc tên sản phẩm..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {selectedProduct && (
                <button type="button" onClick={() => { setSelectedProduct(null); setProductQ(''); }} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">✕</button>
              )}
              {showDropdown && !selectedProduct && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {filtered.slice(0, 20).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedProduct(p); setShowDropdown(false); setProductQ(''); }}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                    >
                      <span className="font-mono text-blue-600 text-xs">{p.code}</span>{' '}
                      <span>{p.name}</span>{' '}
                      <span className="text-gray-400 text-xs ml-1">— {fmt(p.sellingPrice)}</span>
                    </div>
                  ))}
                  {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Không tìm thấy</div>}
                </div>
              )}
            </div>
          </div>

          {/* Giá hiện tại */}
          {selectedProduct && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
              <span className="text-gray-500">Giá hiện tại</span>
              <span className="font-semibold text-gray-800">{fmt(currentPrice)}</span>
            </div>
          )}

          {/* Giá đề xuất + % giảm */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giá đề xuất <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={proposedPrice}
                onChange={(e) => setProposedPrice(e.target.value)}
                placeholder="0"
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">% Giảm</label>
              <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                {discountPct != null ? <span className="text-red-600 font-semibold">-{fmtPct(discountPct)}</span> : '—'}
              </div>
            </div>
          </div>

          {/* Số lượng */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Lý do */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lý do <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Khách VIP, đơn lớn, cạnh tranh với đối thủ..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Ghi chú sale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
            <input
              type="text"
              value={saleNote}
              onChange={(e) => setSaleNote(e.target.value)}
              placeholder="Thông tin thêm..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition">Hủy</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60">
              {saving ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail/Review Modal ──────────────────────────────────────────────────────

function DetailModal({
  record,
  onClose,
  onRefresh,
}: {
  record: YeuCauGia;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [mode, setMode] = useState<'view' | 'approve' | 'reject'>('view');
  const [approvedPrice, setApprovedPrice] = useState(String(record.proposedPrice));
  const [reviewNote, setReviewNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  const handleReview = async (result: 'DaDuyet' | 'TuChoi') => {
    setSaving(true);
    setError('');
    try {
      await ycgApi.review(record.id, {
        result,
        approvedPrice: result === 'DaDuyet' ? parseFloat(approvedPrice) || undefined : undefined,
        reviewNote: reviewNote.trim() || undefined,
      });
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Lỗi khi xét duyệt');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setSaving(true);
    setError('');
    try {
      await ycgApi.cancel(record.id, cancelReason.trim() || undefined);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Lỗi khi hủy');
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right font-medium">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold font-mono">{record.code}</h2>
            <StatusBadge status={record.status} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Sản phẩm */}
          <div className="bg-blue-50 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-1">Sản phẩm</p>
            <p className="font-semibold text-blue-800">{record.productName}</p>
            <p className="text-xs text-blue-500 font-mono">{record.productCode}</p>
          </div>

          {/* Chi tiết giá */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-0">
            <Row label="Giá hiện tại" value={fmt(record.currentPrice)} />
            <Row label="Giá đề xuất" value={<span className="text-orange-600">{fmt(record.proposedPrice)}</span>} />
            <Row label="% giảm" value={<span className="text-red-600 font-semibold">-{fmtPct(record.discountPct)}</span>} />
            <Row label="Số lượng" value={record.quantity} />
            {record.orderCode && <Row label="Đơn hàng" value={<span className="font-mono text-blue-600">{record.orderCode}</span>} />}
            {record.approvedPrice && (
              <Row label="Giá chấp thuận" value={<span className="text-green-700 font-semibold">{fmt(record.approvedPrice)}</span>} />
            )}
          </div>

          {/* Lý do */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Lý do</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{record.reason}</p>
          </div>

          {record.saleNote && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Ghi chú sale</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{record.saleNote}</p>
            </div>
          )}

          {/* Người tạo */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-0">
            <Row label="Người tạo" value={record.createdByName ?? '—'} />
            <Row label="Ngày tạo" value={new Date(record.createdAt).toLocaleString('vi-VN')} />
          </div>

          {/* Kết quả xét duyệt */}
          {record.status !== 'ChoXetDuyet' && record.reviewedAt && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-0">
              <Row label="Người xét duyệt" value={record.reviewedByName ?? '—'} />
              <Row label="Ngày xét duyệt" value={new Date(record.reviewedAt).toLocaleString('vi-VN')} />
              {record.reviewNote && <Row label="Ghi chú duyệt" value={record.reviewNote} />}
            </div>
          )}

          {record.cancelReason && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Lý do hủy</p>
              <p className="text-sm text-gray-600 bg-red-50 rounded-lg px-3 py-2">{record.cancelReason}</p>
            </div>
          )}

          {/* Actions khi ChoXetDuyet */}
          {record.status === 'ChoXetDuyet' && (
            <div className="space-y-3 border-t pt-4">
              {mode === 'view' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode('approve')}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 transition"
                  >
                    Duyệt
                  </button>
                  <button
                    onClick={() => setMode('reject')}
                    className="flex-1 bg-red-100 text-red-700 rounded-lg py-2 text-sm font-medium hover:bg-red-200 transition"
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => setShowCancel(true)}
                    className="px-4 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition"
                  >
                    Hủy YC
                  </button>
                </div>
              )}

              {mode === 'approve' && (
                <div className="space-y-3 bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800">Xác nhận duyệt</p>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Giá chấp thuận (để trống = dùng giá đề xuất)</label>
                    <input
                      type="number"
                      value={approvedPrice}
                      onChange={(e) => setApprovedPrice(e.target.value)}
                      className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Ghi chú (tùy chọn)</label>
                    <input
                      type="text"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Lý do duyệt, điều kiện kèm theo..."
                      className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  {record.orderCode && (
                    <p className="text-xs text-green-700 bg-green-100 rounded px-2 py-1">
                      Giá sẽ được cập nhật vào đơn hàng <span className="font-mono font-semibold">{record.orderCode}</span>
                    </p>
                  )}
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMode('view')} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">Quay lại</button>
                    <button type="button" onClick={() => handleReview('DaDuyet')} disabled={saving} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                      {saving ? 'Đang xử lý...' : 'Xác nhận duyệt'}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'reject' && (
                <div className="space-y-3 bg-red-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800">Xác nhận từ chối</p>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Lý do từ chối (tùy chọn)</label>
                    <input
                      type="text"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Giá quá thấp, không có căn cứ..."
                      className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMode('view')} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">Quay lại</button>
                    <button type="button" onClick={() => handleReview('TuChoi')} disabled={saving} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                      {saving ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cancel confirm */}
          {showCancel && (
            <div className="space-y-3 bg-orange-50 rounded-lg p-4 border-t">
              <p className="text-sm font-medium text-orange-800">Hủy yêu cầu giá này?</p>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Lý do hủy (tùy chọn)..."
                className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCancel(false)} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">Thôi</button>
                <button type="button" onClick={handleCancel} disabled={saving} className="flex-1 bg-orange-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-700 disabled:opacity-60">
                  {saving ? 'Đang hủy...' : 'Xác nhận hủy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color,
}: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 text-white ${color}`}>
      <p className="text-xs font-medium opacity-80 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function YeuCauGiaPage() {
  const [data, setData] = useState<YeuCauGia[]>([]);
  const [kpi, setKpi] = useState<YCGKpi | null>(null);
  const [topSP, setTopSP] = useState<TopSPRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<YeuCauGia | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (q) params.q = q;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await ycgApi.getAll(params);
      setData(res.data);
      setKpi(res.kpi);
      setTopSP(res.topSP);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, q, statusFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yêu Cầu Giá</h1>
          <p className="text-sm text-gray-500 mt-0.5">Workflow xin giá thấp hơn giá niêm yết — Manager phê duyệt</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span>
          Tạo yêu cầu
        </button>
      </div>

      {/* KPI bar */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <KpiCard label="Tổng" value={kpi.tong} color="bg-gray-600" />
          <KpiCard label="Chờ xét duyệt" value={kpi.choXetDuyet} color="bg-yellow-500" />
          <KpiCard label="Đã duyệt" value={kpi.daDuyet} sub={`Tỉ lệ: ${kpi.tyLeDuyet}%`} color="bg-green-500" />
          <KpiCard label="Từ chối" value={kpi.tuChoi} color="bg-red-500" />
          <KpiCard label="Đã hủy" value={kpi.daHuy} sub={kpi.giaGiamTBPct > 0 ? `TB giảm: ${fmtPct(kpi.giaGiamTBPct)}` : undefined} color="bg-gray-400" />
        </div>
      )}

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Filter bar */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Tìm mã YCG, sản phẩm, đơn hàng, người tạo..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ChoXetDuyet">Chờ xét duyệt</option>
              <option value="DaDuyet">Đã duyệt</option>
              <option value="TuChoi">Từ chối</option>
              <option value="DaHuy">Đã hủy</option>
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {(q || statusFilter || fromDate || toDate) && (
              <button
                onClick={() => { setQ(''); setStatusFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
                className="text-sm text-gray-500 hover:text-red-600 transition"
              >
                Xóa filter
              </button>
            )}
            <span className="ml-auto text-sm text-gray-400">{total} yêu cầu</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
            ) : data.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">Chưa có yêu cầu giá nào</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Mã YCG</th>
                    <th className="text-left px-4 py-3">Sản phẩm</th>
                    <th className="text-right px-4 py-3">Giá hiện tại</th>
                    <th className="text-right px-4 py-3">Giá đề xuất</th>
                    <th className="text-right px-4 py-3">% Giảm</th>
                    <th className="text-left px-4 py-3">Người tạo</th>
                    <th className="text-left px-4 py-3">Ngày tạo</th>
                    <th className="text-left px-4 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setDetail(row)}
                      className="hover:bg-blue-50/50 cursor-pointer transition text-sm"
                    >
                      <td className="px-4 py-3 font-mono text-blue-600 text-xs">{row.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 leading-tight">{row.productName}</p>
                        <p className="text-xs text-gray-400 font-mono">{row.productCode}</p>
                        {row.orderCode && (
                          <p className="text-xs text-blue-500 mt-0.5">Đơn: {row.orderCode}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(row.currentPrice)}</td>
                      <td className="px-4 py-3 text-right text-orange-600 font-medium">{fmt(row.proposedPrice)}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-semibold text-xs">-{fmtPct(row.discountPct)}</td>
                      <td className="px-4 py-3 text-gray-600">{row.createdByName ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(row.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
                <span>Trang {page}/{totalPages} — {total} yêu cầu</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top SP sidebar */}
        {topSP.length > 0 && (
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top SP yêu cầu giá</h3>
              <div className="space-y-3">
                {topSP.map((sp, i) => (
                  <div key={sp.productId} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{sp.productName}</p>
                      <p className="text-xs text-gray-400 font-mono">{sp.productCode}</p>
                    </div>
                    <span className="ml-auto text-xs font-bold text-orange-600 shrink-0">{sp.soLanYeuCau}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
      {detail && (
        <DetailModal
          record={detail}
          onClose={() => setDetail(null)}
          onRefresh={() => { setDetail(null); load(); }}
        />
      )}
    </div>
  );
}

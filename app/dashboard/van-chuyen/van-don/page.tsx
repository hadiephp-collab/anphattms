'use client';

import { useEffect, useState, useCallback } from 'react';
import { shippingApi, ShippingCarrier, Shipment, ShipmentKpi, ShipmentStatus, ShipmentType } from '@/lib/shipping';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: 'Chờ lấy hàng',
  picked_up: 'Đã lấy hàng',
  in_transit: 'Đang giao',
  delivered: 'Đã giao',
  returned: 'Hoàn hàng',
  cancelled: 'Huỷ',
};

const STATUS_COLOR: Record<ShipmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  picked_up: 'bg-blue-100 text-blue-600',
  in_transit: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  returned: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_FLOW: ShipmentStatus[] = ['pending', 'picked_up', 'in_transit', 'delivered', 'returned', 'cancelled'];

function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  carriers,
  onClose,
  onSaved,
}: {
  carriers: ShippingCarrier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [carrierId, setCarrierId] = useState('');
  const [type, setType] = useState<ShipmentType>('cod');
  const [trackingCode, setTrackingCode] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverAddress, setReceiverAddress] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-set type when carrier changes
  const selectedCarrier = carriers.find((c) => c.id === Number(carrierId));
  useEffect(() => {
    if (selectedCarrier && selectedCarrier.type !== 'both') {
      setType(selectedCarrier.type as ShipmentType);
    }
  }, [carrierId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierId) { setError('Vui lòng chọn đơn vị vận chuyển'); return; }
    if (!receiverName.trim()) { setError('Vui lòng nhập tên người nhận'); return; }
    setSaving(true);
    setError('');
    try {
      await shippingApi.createShipment({
        carrierId: Number(carrierId),
        type,
        trackingCode: trackingCode.trim() || undefined,
        codAmount: type === 'cod' && codAmount ? Number(codAmount) : undefined,
        shippingFee: shippingFee ? Number(shippingFee) : undefined,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim() || undefined,
        receiverAddress: receiverAddress.trim() || undefined,
        scheduledDate: scheduledDate || undefined,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message ?? 'Lỗi khi tạo vận đơn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">Tạo Vận Đơn</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto">
          {/* Carrier + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Đơn vị VC <span className="text-red-500">*</span>
              </label>
              <select
                value={carrierId}
                onChange={(e) => setCarrierId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn đơn vị...</option>
                {carriers.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
              <div className="flex gap-2 h-[38px]">
                {(['b2b', 'cod'] as ShipmentType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-lg text-sm font-medium border transition ${
                      type === t ? (t === 'b2b' ? 'bg-blue-100 text-blue-700 border-transparent' : 'bg-purple-100 text-purple-700 border-transparent') : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t === 'b2b' ? 'B2B' : 'COD'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã tracking</label>
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="GHTK1234567..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* COD Amount + Shipping fee */}
          <div className="grid grid-cols-2 gap-3">
            {type === 'cod' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiền COD (thu hộ)</label>
                <input
                  type="number"
                  value={codAmount}
                  onChange={(e) => setCodAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phí vận chuyển</label>
              <input
                type="number"
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                placeholder="0"
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Receiver */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Thông tin người nhận</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SĐT</label>
                <input
                  type="text"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="0901 234 567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
              <input
                type="text"
                value={receiverAddress}
                onChange={(e) => setReceiverAddress(e.target.value)}
                placeholder="123 Nguyễn Huệ, Q1, TP.HCM"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Scheduled date + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày giao dự kiến</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gọi trước khi giao..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition">Hủy</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60">
              {saving ? 'Đang tạo...' : 'Tạo vận đơn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  shipment,
  carriers,
  onClose,
  onRefresh,
}: {
  shipment: Shipment;
  carriers: ShippingCarrier[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState('');

  const handleStatus = async (status: ShipmentStatus) => {
    setUpdatingStatus(true);
    setError('');
    try {
      await shippingApi.updateStatus(shipment.id, status);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Lỗi');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const nextStatuses: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
    pending: ['picked_up', 'cancelled'],
    picked_up: ['in_transit', 'cancelled'],
    in_transit: ['delivered', 'returned'],
  };
  const actions = nextStatuses[shipment.status] ?? [];

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value ?? '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold font-mono">{shipment.code}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={shipment.status} />
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${shipment.type === 'cod' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {shipment.type === 'cod' ? 'COD' : 'B2B'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Đơn vị VC + tracking */}
          <div className="bg-blue-50 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-1">Đơn vị vận chuyển</p>
            <p className="font-semibold text-blue-800">{shipment.carrierName}</p>
            {shipment.trackingCode && (
              <p className="text-xs text-blue-500 font-mono mt-0.5">Tracking: {shipment.trackingCode}</p>
            )}
          </div>

          {/* Chi tiết */}
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            {shipment.orderCode && <Row label="Đơn hàng" value={<span className="font-mono text-blue-600">{shipment.orderCode}</span>} />}
            <Row label="Phí vận chuyển" value={fmt(shipment.shippingFee)} />
            {shipment.type === 'cod' && shipment.codAmount && (
              <Row label="Tiền COD" value={<span className="text-purple-700 font-semibold">{fmt(shipment.codAmount)}</span>} />
            )}
            <Row label="Ngày dự kiến" value={shipment.scheduledDate ?? '—'} />
            {shipment.deliveredDate && <Row label="Ngày giao thực tế" value={shipment.deliveredDate} />}
          </div>

          {/* Người nhận */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Người nhận</p>
            <div className="bg-gray-50 rounded-lg px-4 py-2">
              <Row label="Tên" value={<span className="font-medium">{shipment.receiverName}</span>} />
              <Row label="SĐT" value={shipment.receiverPhone} />
              <Row label="Địa chỉ" value={shipment.receiverAddress} />
            </div>
          </div>

          {shipment.notes && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Ghi chú</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{shipment.notes}</p>
            </div>
          )}

          <div className="text-xs text-gray-400">Tạo bởi {shipment.createdByName ?? '—'} · {new Date(shipment.createdAt).toLocaleString('vi-VN')}</div>

          {/* Status actions */}
          {actions.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Cập nhật trạng thái:</p>
              <div className="flex gap-2 flex-wrap">
                {actions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatus(s)}
                    disabled={updatingStatus}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-60 ${STATUS_COLOR[s]}`}
                  >
                    → {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VanDonPage() {
  const [data, setData] = useState<Shipment[]>([]);
  const [kpi, setKpi] = useState<ShipmentKpi | null>(null);
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<Shipment | null>(null);
  const [toast, setToast] = useState('');
  const [toastErr, setToastErr] = useState('');

  const showToast = (msg: string, err = false) => {
    if (err) setToastErr(msg); else setToast(msg);
    setTimeout(() => { setToast(''); setToastErr(''); }, 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (q) params.q = q;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (carrierFilter) params.carrierId = carrierFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await shippingApi.getShipments(params);
      setData(res.data);
      setKpi(res.kpi);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, q, statusFilter, typeFilter, carrierFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { shippingApi.getCarriers().then(setCarriers).catch(() => {}); }, []);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      {toastErr && <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toastErr}</div>}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vận Đơn</h1>
          <p className="text-sm text-gray-500 mt-0.5">Theo dõi trạng thái giao hàng — B2B & COD</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span>
          Tạo vận đơn
        </button>
      </div>

      {/* KPI */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Tổng vận đơn', value: kpi.tong, color: 'bg-gray-600' },
            { label: 'Đang giao', value: kpi.dangGiao, color: 'bg-indigo-500' },
            { label: 'Đã giao', value: kpi.daGiao, color: 'bg-green-500' },
            { label: 'Hoàn hàng', value: kpi.hoanHang, color: 'bg-orange-500' },
            { label: 'COD chờ thu', value: fmt(kpi.tongCOD), color: 'bg-purple-500' },
          ].map((k) => (
            <div key={k.label} className={`${k.color} text-white rounded-xl p-4`}>
              <p className="text-xs font-medium opacity-80 uppercase tracking-wide">{k.label}</p>
              <p className={`font-bold mt-1 ${typeof k.value === 'string' ? 'text-lg' : 'text-2xl'}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm mã VD, tracking, đơn hàng, người nhận..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">B2B + COD</option>
          <option value="b2b">B2B</option>
          <option value="cod">COD</option>
        </select>
        <select
          value={carrierFilter}
          onChange={(e) => { setCarrierFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Tất cả đơn vị VC</option>
          {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <span className="text-gray-400 text-sm">—</span>
        <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
        {(q || statusFilter || typeFilter || carrierFilter || fromDate || toDate) && (
          <button onClick={() => { setQ(''); setStatusFilter(''); setTypeFilter(''); setCarrierFilter(''); setFromDate(''); setToDate(''); setPage(1); }} className="text-sm text-gray-500 hover:text-red-600 transition">Xóa filter</button>
        )}
        <span className="ml-auto text-sm text-gray-400">{total} vận đơn</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
        ) : data.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Chưa có vận đơn nào</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Mã VD</th>
                <th className="text-left px-4 py-3">Đơn vị VC</th>
                <th className="text-left px-4 py-3">Người nhận</th>
                <th className="text-left px-4 py-3">Đơn hàng</th>
                <th className="text-left px-4 py-3">Loại</th>
                <th className="text-right px-4 py-3">Phí / COD</th>
                <th className="text-left px-4 py-3">Ngày dự kiến</th>
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
                  <td className="px-4 py-3">
                    <p className="font-mono text-blue-600 text-xs">{row.code}</p>
                    {row.trackingCode && <p className="text-xs text-gray-400 font-mono">{row.trackingCode}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.carrierName}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800">{row.receiverName}</p>
                    {row.receiverPhone && <p className="text-xs text-gray-400">{row.receiverPhone}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-blue-600 text-xs">{row.orderCode ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.type === 'cod' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {row.type === 'cod' ? 'COD' : 'B2B'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-gray-600">{fmt(row.shippingFee)}</p>
                    {row.type === 'cod' && row.codAmount && <p className="text-purple-600 font-medium text-xs">{fmt(row.codAmount)}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{row.scheduledDate ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>Trang {page}/{totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">Trước</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">Sau</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          carriers={carriers}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); showToast('Đã tạo vận đơn'); }}
        />
      )}
      {detail && (
        <DetailModal
          shipment={detail}
          carriers={carriers}
          onClose={() => setDetail(null)}
          onRefresh={() => { setDetail(null); load(); }}
        />
      )}
    </div>
  );
}

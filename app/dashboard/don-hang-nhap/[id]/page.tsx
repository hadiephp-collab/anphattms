'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { purchaseOrdersApi } from '@/lib/purchase-orders';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier {
  id: number; code: string; name: string; phone?: string | null; supplierType?: string | null;
  email?: string | null; address?: string | null; province?: string | null;
  taxCode?: string | null; contactPerson?: string | null;
  supplierDebt?: number; totalOrders?: number;
  bankAccount?: string | null; bankName?: string | null;
}
interface POItem {
  id?: number; productId?: number | null; productCode: string; productName: string;
  unit: string; quantity: number; priceForeign: number; discountPercent: number;
  totalForeign: number; priceVnd: number; totalVnd: number; notes?: string | null;
  imageUrl?: string | null;
}
interface POPayment {
  id: number; amount: number; paymentTarget: string; amountForeign: number;
  paymentMethod: string; date?: string | null;
  reference?: string | null; notes?: string | null; transactionId?: number | null;
  createdAt: string;
}
interface PurchaseOrder {
  id: number; code: string; orderType: string; date: string | null;
  expectedDeliveryDate: string | null; receivedDate: string | null;
  status: string; paymentStatus: string;
  currency: string; exchangeRate: number;
  subtotalForeign: number; subtotalVnd: number; discountAmount: number;
  shippingFee: number; totalAmountVnd: number;
  paidAmountVnd: number; debtAmountVnd: number;
  paidAmountForeign: number; debtAmountForeign: number;
  shippingFeePaid: number; shippingFeeDebt: number;
  notes: string | null; tags: string | null; reference: string | null; cancelReason: string | null;
  supplier?: Supplier | null;
  freightAgent?: Supplier | null; freightAgentId?: number | null;
  branch?: { id: number; name: string } | null;
  assignedTo?: { id: number; fullName?: string; username: string } | null;
  items: POItem[]; payments: POPayment[]; createdAt: string; updatedAt: string;
}
interface AuditLogEntry {
  action: string; field: string | null; oldValue: string | null; newValue: string | null; createdAt: string; actorName?: string | null;
}
interface POCost {
  id: number; purchaseOrderId: number; loaiChiPhi: string; soTien: number; ghiChu: string | null; createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', ordered: 'Đã đặt', received: 'Đã nhận', cancelled: 'Đã hủy',
};
const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-gray-50 text-gray-500 border border-gray-200',
  ordered:   'bg-blue-50 text-blue-600 border border-blue-100',
  received:  'bg-emerald-50 text-emerald-600 border border-emerald-100',
  cancelled: 'bg-red-50 text-red-400 border border-red-100',
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Chưa TT', partial: 'Một phần', paid: 'Đã TT',
};
const PAYMENT_STATUS_STYLE: Record<string, string> = {
  unpaid:  'bg-red-50 text-red-500 border border-red-100',
  partial: 'bg-amber-50 text-amber-600 border border-amber-100',
  paid:    'bg-emerald-50 text-emerald-600 border border-emerald-100',
};
const CURRENCY_LABEL: Record<string, string> = { VND: 'VND', CNY: 'CNY (¥)', USD: 'USD ($)' };
const LOAI_CHI_PHI: Record<string, string> = {
  VanChuyen: 'Vận chuyển', ThongQuan: 'Thông quan', KiemHoa: 'Kiểm hóa', BaoHiem: 'Bảo hiểm', Khac: 'Khác',
};
const LOAI_CHI_PHI_COLOR: Record<string, string> = {
  VanChuyen: 'bg-blue-100 text-blue-700', ThongQuan: 'bg-purple-100 text-purple-700',
  KiemHoa: 'bg-amber-100 text-amber-700', BaoHiem: 'bg-emerald-100 text-emerald-700', Khac: 'bg-gray-100 text-gray-600',
};
const PAY_METHOD_LABEL: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', momo: 'MoMo', other: 'Khác',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtMoney = (n: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n));
const fmtNum = (n: number | string, decimals = 0) =>
  Number(n).toLocaleString('vi-VN', { maximumFractionDigits: decimals });
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString('vi-VN') : '—';
const fmtDatetime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// ─── InfoRow ──────────────────────────────────────────────────────────────────
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0 w-28">{label}</span>
      <span className="text-xs text-gray-700 text-right">{children}</span>
    </div>
  );
}

// ─── PaymentPanel (inline modal overlay) ─────────────────────────────────────
function PaymentPanel({ po, onClose, onSaved }: { po: PurchaseOrder; onClose: () => void; onSaved: () => void }) {
  const hasFreight = !!po.freightAgentId;
  const [paymentTarget, setPaymentTarget] = useState<'supplier' | 'freight'>('supplier');
  const [amount, setAmount] = useState(Number(po.debtAmountVnd) > 0 ? String(po.debtAmountVnd) : '');
  const [amountForeign, setAmountForeign] = useState('');
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(today());
  const [notesVal, setNotesVal] = useState('');
  const [createTx, setCreateTx] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const isImport = po.orderType === 'import';
  const currSymbol = po.currency === 'CNY' ? '¥' : po.currency === 'USD' ? '$' : '₫';

  function handleTargetChange(t: 'supplier' | 'freight') {
    setPaymentTarget(t); setErr('');
    setAmount(t === 'freight'
      ? (Number(po.shippingFeeDebt) > 0 ? String(po.shippingFeeDebt) : '')
      : (Number(po.debtAmountVnd) > 0 ? String(po.debtAmountVnd) : ''));
    setAmountForeign('');
  }

  const debtSummary = paymentTarget === 'freight'
    ? { label: `Phí VC (${po.freightAgent?.name ?? ''})`, debt: po.shippingFeeDebt, paid: po.shippingFeePaid, total: po.shippingFee }
    : { label: `NCC (${po.supplier?.name ?? ''})`, debt: po.debtAmountVnd, paid: po.paidAmountVnd, total: Number(po.totalAmountVnd) - Number(po.shippingFee) };

  async function handleSave() {
    if (!amount || Number(amount) <= 0) { setErr('Nhập số tiền hợp lệ'); return; }
    setSaving(true); setErr('');
    try {
      await purchaseOrdersApi.addPayment(po.id, {
        amount: Number(amount), paymentTarget,
        amountForeign: amountForeign ? Number(amountForeign) : 0,
        paymentMethod: method, date,
        notes: notesVal || undefined, createTransaction: createTx,
      });
      onSaved();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Lỗi'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">Thêm khoản thanh toán</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {hasFreight && (
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => handleTargetChange('supplier')}
                className={`flex-1 py-2 text-xs font-medium transition ${paymentTarget === 'supplier' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                Thanh toán NCC
              </button>
              <button type="button" onClick={() => handleTargetChange('freight')}
                className={`flex-1 py-2 text-xs font-medium transition ${paymentTarget === 'freight' ? 'bg-amber-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                Phí vận chuyển
              </button>
            </div>
          )}
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm">
            <p className="text-xs text-blue-600 font-medium mb-2">{debtSummary.label}</p>
            <div className="flex justify-between text-gray-600"><span>Tổng</span><span>{fmtMoney(debtSummary.total)}</span></div>
            <div className="flex justify-between text-gray-600 mt-1"><span>Đã thanh toán</span><span>{fmtMoney(debtSummary.paid)}</span></div>
            <div className="flex justify-between font-semibold text-red-600 mt-1 pt-1 border-t border-blue-100">
              <span>Còn nợ</span>
              <span>{fmtMoney(debtSummary.debt)}{paymentTarget === 'supplier' && isImport && Number(po.debtAmountForeign) > 0 ? ` (${fmtNum(po.debtAmountForeign, 2)}${currSymbol})` : ''}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Số tiền (VND)</label>
            <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          {isImport && paymentTarget === 'supplier' && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Số {po.currency} đã trả (tuỳ chọn)</label>
              <input type="number" min="0" step="any" value={amountForeign} onChange={e => setAmountForeign(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Phương thức</label>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
                <option value="momo">MoMo</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Ngày thanh toán</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Ghi chú</label>
            <input value={notesVal} onChange={e => setNotesVal(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={createTx} onChange={e => setCreateTx(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            Tự động tạo phiếu chi liên kết
          </label>
          {err && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Đang lưu...' : 'Lưu thanh toán'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CancelPanel (inline modal overlay) ──────────────────────────────────────
function CancelPanel({ po, onClose, onSaved }: { po: PurchaseOrder; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleCancel() {
    setSaving(true); setErr('');
    try { await purchaseOrdersApi.cancel(po.id, reason || undefined); onSaved(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Lỗi'); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Huỷ đơn nhập</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {po.status === 'received' && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <strong>Cảnh báo:</strong> Đơn đã nhận hàng — huỷ sẽ <strong>hoàn kho</strong> và giảm công nợ NCC{po.freightAgentId ? ' + phí VC' : ''}.
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Lý do huỷ (tuỳ chọn)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              placeholder="Nhập lý do huỷ đơn..." />
          </div>
          {err && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Không</button>
            <button onClick={handleCancel} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60">
              {saving ? 'Đang huỷ...' : 'Xác nhận huỷ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Horizontal progress bar ──────────────────────────────────────────────────
function ProgressBar({ po, className = 'mt-5 pt-4 border-t border-gray-100' }: { po: PurchaseOrder; className?: string }) {
  const isCancelled = po.status === 'cancelled';
  const steps = [
    { label: 'Tạo đơn', date: po.createdAt },
    { label: 'Đặt hàng', date: po.date },
    { label: 'Nhận hàng', date: po.receivedDate },
  ];
  const doneCount = po.status === 'received' ? 3 : po.status === 'ordered' ? 1 : 0;
  const activeIdx = isCancelled ? -1 : po.status === 'received' ? -1 : po.status === 'ordered' ? 1 : 0;

  return (
    <div className={className}>
      <div className="flex items-start">
        {steps.map((step, i) => {
          const done = i < doneCount;
          const active = i === activeIdx;
          const last = i === steps.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center min-w-0">
              <div className="flex items-center w-full">
                <div className={`flex-1 h-0.5 ${i === 0 ? 'invisible' : done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                  done ? 'border-emerald-500 bg-emerald-500 text-white'
                    : active ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-200 bg-white'
                }`}>
                  {done ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-gray-200'}`} />
                  )}
                </div>
                <div className={`flex-1 h-0.5 ${last ? 'invisible' : done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              </div>
              <div className="mt-2 text-center px-1">
                <p className={`text-xs font-medium ${done ? 'text-emerald-700' : active ? 'text-blue-700' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {step.date && <p className="text-[11px] text-gray-400 mt-0.5">{fmtDate(step.date)}</p>}
              </div>
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Đơn đã bị huỷ{po.cancelReason ? ` · ${po.cancelReason}` : ''}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');

  const [showPayment, setShowPayment] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [bottomTab, setBottomTab] = useState<'payments' | 'costs' | 'log'>('payments');

  // Audit log lazy load
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logLoaded, setLogLoaded] = useState(false);

  // Chi phí NK
  const [costs, setCosts] = useState<POCost[]>([]);
  const [costsLoading, setCostsLoading] = useState(false);
  const [costsLoaded, setCostsLoaded] = useState(false);
  const [costForm, setCostForm] = useState<{ loaiChiPhi: string; soTien: string; ghiChu: string }>({ loaiChiPhi: 'VanChuyen', soTien: '', ghiChu: '' });
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [showCostForm, setShowCostForm] = useState(false);
  const [costSaving, setCostSaving] = useState(false);
  const [costErr, setCostErr] = useState('');
  const loadPO = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const data = await purchaseOrdersApi.getOne(id);
      setPo(data);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Không tải được đơn hàng');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadPO(); }, [loadPO]);

  // Load audit log when tab is activated
  useEffect(() => {
    if (bottomTab === 'log' && !logLoaded && !logLoading) loadAuditLog();
    if (bottomTab === 'costs' && !costsLoaded && !costsLoading) loadCosts();
  }, [bottomTab]); // eslint-disable-line

  async function loadCosts() {
    if (costsLoaded || costsLoading) return;
    setCostsLoading(true);
    try {
      const data = await purchaseOrdersApi.getCosts(id);
      setCosts(data.data ?? []);
      setCostsLoaded(true);
    } catch { /**/ }
    setCostsLoading(false);
  }

  async function handleSaveCost() {
    if (!po) return;
    if (!costForm.soTien || Number(costForm.soTien) <= 0) { setCostErr('Nhập số tiền hợp lệ'); return; }
    setCostSaving(true); setCostErr('');
    try {
      const payload = { loaiChiPhi: costForm.loaiChiPhi, soTien: Number(costForm.soTien), ghiChu: costForm.ghiChu || undefined };
      if (editingCostId) {
        await purchaseOrdersApi.updateCost(po.id, editingCostId, payload);
      } else {
        await purchaseOrdersApi.addCost(po.id, payload);
      }
      const data = await purchaseOrdersApi.getCosts(po.id);
      setCosts(data.data ?? []);
      setShowCostForm(false);
      setEditingCostId(null);
      setCostForm({ loaiChiPhi: 'VanChuyen', soTien: '', ghiChu: '' });
    } catch (e: unknown) { setCostErr(e instanceof Error ? e.message : 'Lỗi lưu chi phí'); }
    setCostSaving(false);
  }

  async function handleDeleteCost(costId: number) {
    if (!po || !confirm('Xoá khoản chi phí này?')) return;
    try {
      await purchaseOrdersApi.removeCost(po.id, costId);
      setCosts(prev => prev.filter(c => c.id !== costId));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Lỗi xoá'); }
  }

  function openEditCost(c: POCost) {
    setEditingCostId(c.id);
    setCostForm({ loaiChiPhi: c.loaiChiPhi, soTien: String(c.soTien), ghiChu: c.ghiChu ?? '' });
    setShowCostForm(true); setCostErr('');
  }

  async function loadAuditLog() {
    if (logLoaded || logLoading) return;
    setLogLoading(true);
    try {
      const data = await purchaseOrdersApi.getAuditLog(id);
      setLog(Array.isArray(data) ? data : []);
      setLogLoaded(true);
    } catch { /**/ }
    setLogLoading(false);
  }

  async function handleStatus(status: string) {
    if (!po) return;
    setActionLoading(status); setActionError('');
    try {
      await purchaseOrdersApi.updateStatus(po.id, {
        status,
        receivedDate: status === 'received' ? today() : undefined,
      });
      await loadPO();
    } catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'Lỗi cập nhật trạng thái'); }
    setActionLoading('');
  }

  async function handleRemovePayment(payId: number) {
    if (!po) return;
    if (!confirm('Xoá khoản thanh toán này?')) return;
    setActionLoading('pay-' + payId); setActionError('');
    try { await purchaseOrdersApi.removePayment(po.id, payId); await loadPO(); }
    catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'Lỗi'); }
    setActionLoading('');
  }

  function handlePrint() { window.print(); }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Đang tải đơn hàng...</p>
        </div>
      </div>
    );
  }

  if (loadError || !po) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-4">{loadError || 'Không tìm thấy đơn hàng'}</p>
          <button onClick={() => router.back()} className="px-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-600 hover:bg-gray-200">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const isImport = po.orderType === 'import';
  const hasFreight = !!po.freightAgentId;
  const currSymbol = po.currency === 'CNY' ? '¥' : po.currency === 'USD' ? '$' : '₫';
  const canChangeStatus = po.status !== 'cancelled' && po.status !== 'received';
  const totalDebt = Number(po.debtAmountVnd) + Number(po.shippingFeeDebt);
  const tags = po.tags ? po.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Timeline derived states
  const isDraft = po.status === 'draft';
  const isOrdered = po.status === 'ordered';
  const isReceived = po.status === 'received';
  const isCancelled = po.status === 'cancelled';

  return (
    <>
      <div className="min-h-screen bg-gray-50 print:hidden">
      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Quay lại
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            In đơn
          </button>
          {canChangeStatus && (
            <button
              onClick={() => setShowCancel(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition">
              Huỷ đơn
            </button>
          )}
          <button
            onClick={() => canChangeStatus && router.push(`/dashboard/don-hang-nhap/${po.id}/chinh-sua`)}
            disabled={!canChangeStatus}
            title={!canChangeStatus ? 'Không thể sửa đơn đã nhận hoặc đã huỷ' : ''}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
              canChangeStatus
                ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
            }`}>
            Sửa đơn
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{actionError}</div>
        )}

        {/* ── Order header card ── */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-5">
          <div className="flex items-start gap-5">
            {/* Left: code + pills + timestamp + action buttons */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <h1 className="text-lg font-mono font-bold text-gray-900 tracking-wide">{po.code}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[po.status]}`}>
                  {STATUS_LABEL[po.status]}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_STATUS_STYLE[po.paymentStatus]}`}>
                  {PAYMENT_STATUS_LABEL[po.paymentStatus]}
                </span>
                {isImport && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-50 text-purple-600 border border-purple-100">
                    {CURRENCY_LABEL[po.currency] ?? po.currency}
                  </span>
                )}
                {!isCancelled && isReceived && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Đã hoàn tất
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-4">
                {fmtDatetime(po.createdAt)}
                {po.updatedAt !== po.createdAt && <span> · Cập nhật {fmtDatetime(po.updatedAt)}</span>}
              </p>
              {/* Action buttons row */}
              <div className="flex items-center gap-2 flex-wrap">
                {!isCancelled && isDraft && (
                  <button
                    onClick={() => handleStatus('ordered')}
                    disabled={!!actionLoading}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm">
                    {actionLoading === 'ordered' ? 'Đang xử lý...' : '→ Đặt hàng'}
                  </button>
                )}
                {!isCancelled && isOrdered && (
                  <button
                    onClick={() => handleStatus('received')}
                    disabled={!!actionLoading}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">
                    {actionLoading === 'received' ? 'Đang xử lý...' : '✓ Nhận hàng'}
                  </button>
                )}
                {!isCancelled && isReceived && (
                  <a
                    href={`/dashboard/nhap-hd-vat/new?purchaseOrderId=${po.id}`}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition">
                    📄 Tạo HĐ VAT đầu vào
                  </a>
                )}
              </div>
            </div>

            {/* Right: progress bar */}
            <div className="flex-shrink-0 w-64 border-l border-gray-100 pl-5">
              <ProgressBar po={po} className="" />
            </div>
          </div>
        </div>

        {/* ── Two-column info grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
          {/* Left: Supplier info */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Thông tin nhà cung cấp
            </h2>

            {po.supplier ? (
              /* SAPO-style: left info + right stats box */
              <div className="flex gap-4">
                {/* Left: contact info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-blue-700 leading-tight">{po.supplier.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5 mb-2">{po.supplier.code}</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    {po.supplier.phone && <p>{po.supplier.phone}</p>}
                    {po.supplier.email && <p className="truncate">{po.supplier.email}</p>}
                    {(po.supplier.address || po.supplier.province) && (
                      <p className="leading-snug text-gray-500">
                        {[po.supplier.address, po.supplier.province].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {po.supplier.taxCode && (
                      <p>MST: <span className="font-medium text-gray-700">{po.supplier.taxCode}</span></p>
                    )}
                    {po.supplier.contactPerson && (
                      <p>LH: <span className="font-medium text-gray-700">{po.supplier.contactPerson}</span></p>
                    )}
                    {(po.supplier.bankAccount || po.supplier.bankName) && (
                      <p className="text-gray-500">
                        {po.supplier.bankName && <span>{po.supplier.bankName} · </span>}
                        {po.supplier.bankAccount}
                      </p>
                    )}
                  </div>
                </div>
                {/* Right: stats box (SAPO-style) */}
                <div className="flex-shrink-0 border border-gray-100 rounded-xl overflow-hidden self-start">
                  <div className="flex divide-x divide-gray-100">
                    <div className="px-3 py-2 text-center">
                      <p className="text-[10px] text-gray-400 whitespace-nowrap">Tổng đơn</p>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5">{po.supplier.totalOrders ?? 0}</p>
                    </div>
                    <div className="px-3 py-2 text-center">
                      <p className="text-[10px] text-gray-400 whitespace-nowrap">Công nợ NCC</p>
                      <p className={`text-sm font-semibold mt-0.5 ${Number(po.supplier.supplierDebt) > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        {fmtMoney(Number(po.supplier.supplierDebt) || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Chưa có nhà cung cấp</p>
            )}

            {/* Freight agent — same structure as supplier */}
            {hasFreight && po.freightAgent && (
              <div className="border-t border-gray-100 pt-3 mt-3 flex gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Đơn vị vận chuyển</p>
                  <p className="text-sm font-bold text-gray-700 leading-tight">{po.freightAgent.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5 mb-2">{po.freightAgent.code}</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    {po.freightAgent.phone && <p>{po.freightAgent.phone}</p>}
                    {po.freightAgent.email && <p className="truncate">{po.freightAgent.email}</p>}
                    {(po.freightAgent.address || po.freightAgent.province) && (
                      <p className="leading-snug text-gray-500">
                        {[po.freightAgent.address, po.freightAgent.province].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {po.freightAgent.taxCode && (
                      <p>MST: <span className="font-medium text-gray-700">{po.freightAgent.taxCode}</span></p>
                    )}
                    {po.freightAgent.contactPerson && (
                      <p>LH: <span className="font-medium text-gray-700">{po.freightAgent.contactPerson}</span></p>
                    )}
                  </div>
                </div>
                {/* Freight debt */}
                {Number(po.shippingFeeDebt) >= 0 && (
                  <div className="flex-shrink-0 border border-gray-100 rounded-xl overflow-hidden self-start mt-5">
                    <div className="flex divide-x divide-gray-100">
                      <div className="px-3 py-2 text-center">
                        <p className="text-[10px] text-gray-400 whitespace-nowrap">Phí VC</p>
                        <p className="text-sm font-semibold text-gray-700 mt-0.5">{fmtMoney(po.shippingFee)}</p>
                      </div>
                      <div className="px-3 py-2 text-center">
                        <p className="text-[10px] text-gray-400 whitespace-nowrap">Còn nợ</p>
                        <p className={`text-sm font-semibold mt-0.5 ${Number(po.shippingFeeDebt) > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {fmtMoney(po.shippingFeeDebt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Order info */}
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Thông tin đơn
            </h2>
            <div>
              <InfoRow label="Chi nhánh">
                {po.branch ? po.branch.name : <span className="text-gray-400 text-xs">Mặc định</span>}
              </InfoRow>
              {isImport && (
                <InfoRow label="Tiền tệ">
                  <span className="font-medium">{CURRENCY_LABEL[po.currency] ?? po.currency}</span>
                  <span className="text-gray-400 ml-2 text-xs">× {fmtNum(po.exchangeRate, 2)}</span>
                </InfoRow>
              )}
              <InfoRow label="Nhân viên">
                {po.assignedTo ? (po.assignedTo.fullName ?? po.assignedTo.username) : <span className="text-gray-300">—</span>}
              </InfoRow>
              <InfoRow label="Ngày đặt">
                {po.date ? fmtDate(po.date) : <span className="text-gray-300">—</span>}
              </InfoRow>
              <InfoRow label="Dự kiến nhận">
                {po.expectedDeliveryDate ? fmtDate(po.expectedDeliveryDate) : <span className="text-gray-300">—</span>}
              </InfoRow>
              <InfoRow label="Ngày nhận">
                {po.receivedDate
                  ? <span className="text-emerald-600 font-medium">{fmtDate(po.receivedDate)}</span>
                  : <span className="text-gray-300">—</span>}
              </InfoRow>
              {po.reference && (
                <InfoRow label="Tham chiếu">
                  <span className="font-mono text-gray-700">{po.reference}</span>
                </InfoRow>
              )}
              {tags.length > 0 && (
                <InfoRow label="Tags">
                  <div className="flex flex-wrap gap-1 justify-end">
                    {tags.map(t => (
                      <span key={t} className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">{t}</span>
                    ))}
                  </div>
                </InfoRow>
              )}
              {po.notes && (
                <InfoRow label="Ghi chú">
                  <span className="text-gray-600 text-right max-w-[180px] leading-relaxed">{po.notes}</span>
                </InfoRow>
              )}
            </div>
          </div>
        </div>

        {/* ── Payment section ── */}
        {po.status !== 'cancelled' && totalDebt > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Thanh toán
                <span className="ml-1 text-xs font-normal text-red-500">· Còn nợ {fmtMoney(totalDebt)}</span>
              </h2>
              <button
                onClick={() => setShowPayment(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm">
                + Thêm thanh toán
              </button>
            </div>

            {/* NCC debt row */}
            {Number(po.debtAmountVnd) > 0 && (
              <div className="flex items-center gap-6 text-sm flex-wrap mb-3">
                <div>
                  <span className="text-gray-500">Tiền cần trả NCC: </span>
                  <span className="font-medium text-gray-800">{fmtMoney(Number(po.totalAmountVnd) - Number(po.shippingFee))}</span>
                  {isImport && <span className="text-gray-400 ml-1 text-xs">({fmtNum(po.subtotalForeign, 2)} {po.currency})</span>}
                </div>
                <div>
                  <span className="text-gray-500">Đã trả: </span>
                  <span className="font-medium text-emerald-600">{fmtMoney(po.paidAmountVnd)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Còn phải trả: </span>
                  <span className="font-semibold text-red-600">{fmtMoney(po.debtAmountVnd)}</span>
                  {isImport && Number(po.debtAmountForeign) > 0 && (
                    <span className="text-red-400 ml-1 text-xs">({fmtNum(po.debtAmountForeign, 2)}{currSymbol})</span>
                  )}
                </div>
              </div>
            )}

            {/* Freight debt row */}
            {hasFreight && Number(po.shippingFeeDebt) > 0 && (
              <div className="flex items-center gap-6 text-sm flex-wrap pt-3 border-t border-gray-100">
                <div>
                  <span className="text-gray-500">Phí VC ({po.freightAgent?.name}): </span>
                  <span className="font-medium text-gray-800">{fmtMoney(po.shippingFee)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Đã trả: </span>
                  <span className="font-medium text-emerald-600">{fmtMoney(po.shippingFeePaid)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Còn phải trả: </span>
                  <span className="font-semibold text-amber-600">{fmtMoney(po.shippingFeeDebt)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Items table card ── */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Thông tin sản phẩm
            <span className="ml-auto text-xs text-gray-400 font-normal">
              {po.items?.length ?? 0} dòng · {fmtNum(po.items?.reduce((s, i) => s + Number(i.quantity), 0) ?? 0, 3)} sp
            </span>
          </h2>

          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2.5 text-center w-10">STT</th>
                  <th className="px-3 py-2.5 text-center w-12">Ảnh</th>
                  <th className="px-3 py-2.5 text-left">Tên sản phẩm</th>
                  <th className="px-3 py-2.5 text-center w-16">ĐVT</th>
                  <th className="px-3 py-2.5 text-right w-16">SL</th>
                  <th className="px-3 py-2.5 text-right w-28">Đơn giá</th>
                  <th className="px-3 py-2.5 text-center w-16">CK%</th>
                  <th className="px-3 py-2.5 text-right w-32">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {(po.items ?? []).map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                    <td className="px-3 py-3 text-center text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.productName} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-800 leading-snug">{item.productName}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{item.productCode} · {item.unit}</p>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500 text-xs">{item.unit}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-700">{fmtNum(item.quantity, 3)}</td>
                    <td className="px-3 py-3 text-right">
                      {isImport ? (
                        <>
                          <p className="font-medium text-gray-700">{fmtNum(item.priceForeign, 2)}{currSymbol}</p>
                          <p className="text-xs text-gray-400">{fmtMoney(item.priceVnd)}</p>
                        </>
                      ) : (
                        <span className="font-medium text-gray-700">{fmtMoney(item.priceVnd)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-500 text-xs">
                      {Number(item.discountPercent) > 0 ? `${item.discountPercent}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isImport ? (
                        <>
                          <p className="font-semibold text-gray-800">{fmtNum(item.totalForeign, 2)}{currSymbol}</p>
                          <p className="text-xs text-gray-500">{fmtMoney(item.totalVnd)}</p>
                        </>
                      ) : (
                        <span className="font-semibold text-gray-800">{fmtMoney(item.totalVnd)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer: notes/tags left, summary right */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: notes + tags */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Ghi chú đơn</p>
                {po.notes ? (
                  <p className="text-sm text-gray-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">{po.notes}</p>
                ) : (
                  <p className="text-sm text-gray-300">Chưa có</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Tags</p>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(t => (
                      <span key={t} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100">{t}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-300">Chưa có</p>
                )}
              </div>
            </div>

            {/* Right: summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Số lượng SP</span>
                <span className="font-medium text-gray-800">{po.items?.length ?? 0} dòng</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tổng tiền hàng</span>
                <span>
                  {isImport && <span className="text-gray-400 mr-1.5 text-xs">{fmtNum(po.subtotalForeign, 2)}{currSymbol}</span>}
                  {fmtMoney(po.subtotalVnd)}
                </span>
              </div>
              {Number(po.discountAmount) > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Chiết khấu</span>
                  <span className="text-red-500">-{fmtMoney(po.discountAmount)}</span>
                </div>
              )}
              {Number(po.shippingFee) > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Phí vận chuyển{hasFreight && po.freightAgent ? ` (${po.freightAgent.name})` : ''}</span>
                  <span>+{fmtMoney(po.shippingFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200 text-base">
                <span>Tổng cộng</span>
                <span className="text-blue-700">{fmtMoney(po.totalAmountVnd)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Đã thanh toán</span>
                <span className="font-medium">{fmtMoney(Number(po.paidAmountVnd) + Number(po.shippingFeePaid))}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-red-600">
                <span>Còn nợ</span>
                <span>{fmtMoney(totalDebt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabbed: Payment history + Audit log ── */}
        <div className="bg-white rounded-2xl shadow-sm">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-2">
            <button
              onClick={() => setBottomTab('payments')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                bottomTab === 'payments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              Lịch sử thanh toán
              {po.payments && po.payments.length > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${bottomTab === 'payments' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  {po.payments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setBottomTab('costs')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                bottomTab === 'costs'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              Chi phí NK
              {costs.length > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${bottomTab === 'costs' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                  {costs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setBottomTab('log')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                bottomTab === 'log'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              Nhật ký thao tác
              {logLoaded && log.length > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${bottomTab === 'log' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  {log.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="p-5">
            {bottomTab === 'payments' && (
              <>
                {po.payments && po.payments.length > 0 ? (
                  <>
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Ngày</th>
                            <th className="px-4 py-2.5 text-left">Loại</th>
                            <th className="px-4 py-2.5 text-left">Phương thức</th>
                            <th className="px-4 py-2.5 text-right">Số tiền</th>
                            <th className="px-4 py-2.5 text-left">Ghi chú</th>
                            <th className="px-4 py-2.5 w-16" />
                          </tr>
                        </thead>
                        <tbody>
                          {po.payments.map(p => (
                            <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/70 transition-colors">
                              <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{fmtDate(p.date ?? p.createdAt)}</td>
                              <td className="px-4 py-2.5">
                                {p.paymentTarget === 'freight' ? (
                                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-medium">Phí VC</span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-medium">NCC</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 text-xs">{PAY_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="font-semibold text-gray-800 text-sm">{fmtMoney(p.amount)}</span>
                                {isImport && Number(p.amountForeign) > 0 && p.paymentTarget !== 'freight' && (
                                  <div className="text-xs text-gray-400">{fmtNum(p.amountForeign, 2)}{currSymbol}</div>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500 text-xs">{p.notes ?? '—'}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleRemovePayment(p.id)}
                                  disabled={actionLoading === 'pay-' + p.id}
                                  className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition disabled:opacity-50">
                                  Xoá
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Total row */}
                    <div className="flex justify-between items-center pt-3 mt-1 text-sm font-semibold text-gray-700">
                      <span>Tổng đã thanh toán</span>
                      <span className="text-emerald-600">{fmtMoney(Number(po.paidAmountVnd) + Number(po.shippingFeePaid))}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">Chưa có lịch sử thanh toán</p>
                )}
              </>
            )}

            {bottomTab === 'costs' && (
              <div className="space-y-4">
                {/* Header + add button */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Tổng chi phí NK:{' '}
                    <span className="font-semibold text-purple-700">
                      {fmtMoney(costs.reduce((s, c) => s + Number(c.soTien), 0))}
                    </span>
                    {po.status === 'received' && (
                      <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Đã tính vào GBQ</span>
                    )}
                  </div>
                  {po.status !== 'cancelled' && po.status !== 'received' && (
                    <button
                      onClick={() => { setEditingCostId(null); setCostForm({ loaiChiPhi: 'VanChuyen', soTien: '', ghiChu: '' }); setShowCostForm(true); setCostErr(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition">
                      + Thêm chi phí
                    </button>
                  )}
                </div>

                {/* WAC info */}
                {po.status !== 'received' && costs.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    Chi phí sẽ được phân bổ vào GBQ sản phẩm khi bấm <strong>Xác nhận nhận hàng</strong>.
                  </div>
                )}

                {/* Inline form */}
                {showCostForm && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-purple-800">{editingCostId ? 'Sửa chi phí' : 'Thêm chi phí'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Loại chi phí</label>
                        <select value={costForm.loaiChiPhi} onChange={e => setCostForm(f => ({ ...f, loaiChiPhi: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-purple-400">
                          {Object.entries(LOAI_CHI_PHI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Số tiền (VND)</label>
                        <input type="number" min="1" value={costForm.soTien} onChange={e => setCostForm(f => ({ ...f, soTien: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                          placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
                      <input value={costForm.ghiChu} onChange={e => setCostForm(f => ({ ...f, ghiChu: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                        placeholder="Ghi chú ngắn..." />
                    </div>
                    {costErr && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{costErr}</p>}
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setShowCostForm(false); setEditingCostId(null); setCostErr(''); }}
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Huỷ</button>
                      <button onClick={handleSaveCost} disabled={costSaving}
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
                        {costSaving ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </div>
                  </div>
                )}

                {/* List */}
                {costsLoading && (
                  <div className="py-6 text-center">
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                )}
                {!costsLoading && costs.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Chưa có chi phí nào</p>
                )}
                {!costsLoading && costs.length > 0 && (
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Loại</th>
                          <th className="px-4 py-2.5 text-right">Số tiền</th>
                          <th className="px-4 py-2.5 text-left">Ghi chú</th>
                          {po.status !== 'received' && po.status !== 'cancelled' && <th className="px-4 py-2.5 w-20" />}
                        </tr>
                      </thead>
                      <tbody>
                        {costs.map(c => (
                          <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LOAI_CHI_PHI_COLOR[c.loaiChiPhi] ?? 'bg-gray-100 text-gray-600'}`}>
                                {LOAI_CHI_PHI[c.loaiChiPhi] ?? c.loaiChiPhi}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{fmtMoney(c.soTien)}</td>
                            <td className="px-4 py-2.5 text-gray-400 text-xs">{c.ghiChu ?? '—'}</td>
                            {po.status !== 'received' && po.status !== 'cancelled' && (
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => openEditCost(c)} className="text-xs text-blue-400 hover:text-blue-600 px-1.5 py-0.5 rounded">Sửa</button>
                                <button onClick={() => handleDeleteCost(c.id)} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded ml-1">Xoá</button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td className="px-4 py-2.5 text-xs font-semibold text-gray-600">Tổng</td>
                          <td className="px-4 py-2.5 text-right font-bold text-purple-700">
                            {fmtMoney(costs.reduce((s, c) => s + Number(c.soTien), 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {bottomTab === 'log' && (
              <>
                {logLoading && (
                  <div className="py-8 text-center">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Đang tải...</p>
                  </div>
                )}
                {!logLoading && logLoaded && log.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Chưa có nhật ký thay đổi</p>
                )}
                {!logLoading && log.length > 0 && (
                  <div className="space-y-0">
                    {log.map((entry, i) => (
                      <div key={i} className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
                        <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap w-36">{fmtDatetime(entry.createdAt)}</span>
                        <div className="flex-1 text-xs">
                          {entry.actorName && (
                            <span className="font-semibold text-blue-600 mr-1">{entry.actorName}</span>
                          )}
                          <span className="font-medium text-gray-700">{entry.action}</span>
                          {entry.field && (
                            <span className="text-gray-500 ml-1">
                              · {entry.field}:{' '}
                              <span className="line-through text-red-400">{entry.oldValue ?? 'trống'}</span>
                              {' → '}
                              <span className="text-emerald-600">{entry.newValue ?? 'trống'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>

      {/* ── Payment panel overlay ── */}
      {showPayment && po && (
        <PaymentPanel
          po={po}
          onClose={() => setShowPayment(false)}
          onSaved={async () => { setShowPayment(false); await loadPO(); }}
        />
      )}

      {/* ── Cancel panel overlay ── */}
      {showCancel && po && (
        <CancelPanel
          po={po}
          onClose={() => setShowCancel(false)}
          onSaved={async () => { setShowCancel(false); await loadPO(); }}
        />
      )}
    </div>

    {/* ── Print template (ẩn trên màn hình, hiện khi in) ── */}
    <div className="hidden print:block" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000', lineHeight: '1.6', padding: '0' }}>
      {/* Tiêu đề */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>AN PHÁT TMS</div>
          <div style={{ fontSize: '11px', color: '#666' }}>Hệ thống quản lý nhập hàng</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '17px', fontWeight: 'bold' }}>PHIẾU NHẬP HÀNG</div>
          <div style={{ fontSize: '11px', color: '#666' }}>In ngày: {new Date().toLocaleDateString('vi-VN')}</div>
        </div>
      </div>

      {/* Mã đơn + trạng thái */}
      <div style={{ marginBottom: '12px', padding: '7px 10px', background: '#f5f5f5', borderRadius: '4px', border: '1px solid #ddd', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '15px', fontWeight: 'bold', fontFamily: 'monospace' }}>{po.code}</span>
        <span>Trạng thái: <strong>{STATUS_LABEL[po.status]}</strong></span>
        <span>Thanh toán: <strong>{PAYMENT_STATUS_LABEL[po.paymentStatus]}</strong></span>
        {isImport && <span>Tiền tệ: <strong>{po.currency}</strong> × {fmtNum(po.exchangeRate, 2)}</span>}
      </div>

      {/* 2 cột: NCC + Thông tin đơn */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '14px' }}>
        {/* NCC */}
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px', borderBottom: '1px solid #bbb', paddingBottom: '3px' }}>Nhà cung cấp</div>
          {po.supplier ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{po.supplier.name}</div>
              <div style={{ color: '#777', fontSize: '11px', fontFamily: 'monospace', marginBottom: '3px' }}>{po.supplier.code}</div>
              {po.supplier.phone && <div>{po.supplier.phone}</div>}
              {po.supplier.email && <div>{po.supplier.email}</div>}
              {(po.supplier.address || po.supplier.province) && (
                <div style={{ color: '#555' }}>{[po.supplier.address, po.supplier.province].filter(Boolean).join(', ')}</div>
              )}
              {po.supplier.taxCode && <div>MST: <strong>{po.supplier.taxCode}</strong></div>}
              {po.supplier.contactPerson && <div>Liên hệ: <strong>{po.supplier.contactPerson}</strong></div>}
              {(po.supplier.bankAccount || po.supplier.bankName) && (
                <div style={{ color: '#555' }}>{[po.supplier.bankName, po.supplier.bankAccount].filter(Boolean).join(' · ')}</div>
              )}
            </>
          ) : <div style={{ color: '#999' }}>Chưa có nhà cung cấp</div>}

          {hasFreight && po.freightAgent && (
            <div style={{ marginTop: '8px', paddingTop: '7px', borderTop: '1px dashed #ccc' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Đơn vị vận chuyển</div>
              <div style={{ fontWeight: 'bold' }}>{po.freightAgent.name}</div>
              <div style={{ color: '#777', fontSize: '11px', fontFamily: 'monospace' }}>{po.freightAgent.code}</div>
              {po.freightAgent.phone && <div>{po.freightAgent.phone}</div>}
              {po.freightAgent.email && <div>{po.freightAgent.email}</div>}
            </div>
          )}
        </div>

        {/* Thông tin đơn */}
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px', borderBottom: '1px solid #bbb', paddingBottom: '3px' }}>Thông tin đơn</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <tbody>
              <tr><td style={{ padding: '2px 0', color: '#666', width: '100px' }}>Chi nhánh</td><td style={{ padding: '2px 0', fontWeight: '500' }}>{po.branch?.name ?? 'Mặc định'}</td></tr>
              <tr><td style={{ padding: '2px 0', color: '#666' }}>Nhân viên</td><td style={{ padding: '2px 0', fontWeight: '500' }}>{po.assignedTo ? (po.assignedTo.fullName ?? po.assignedTo.username) : '—'}</td></tr>
              <tr><td style={{ padding: '2px 0', color: '#666' }}>Ngày đặt</td><td style={{ padding: '2px 0', fontWeight: '500' }}>{fmtDate(po.date)}</td></tr>
              <tr><td style={{ padding: '2px 0', color: '#666' }}>Dự kiến nhận</td><td style={{ padding: '2px 0', fontWeight: '500' }}>{fmtDate(po.expectedDeliveryDate)}</td></tr>
              <tr><td style={{ padding: '2px 0', color: '#666' }}>Ngày nhận</td><td style={{ padding: '2px 0', fontWeight: '500' }}>{fmtDate(po.receivedDate)}</td></tr>
              {po.reference && <tr><td style={{ padding: '2px 0', color: '#666' }}>Tham chiếu</td><td style={{ padding: '2px 0', fontWeight: '500', fontFamily: 'monospace' }}>{po.reference}</td></tr>}
              {po.notes && <tr><td style={{ padding: '2px 0', color: '#666', verticalAlign: 'top' }}>Ghi chú</td><td style={{ padding: '2px 0' }}>{po.notes}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bảng sản phẩm */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px', borderBottom: '1px solid #bbb', paddingBottom: '3px' }}>
          Danh sách sản phẩm ({po.items?.length ?? 0} dòng · {fmtNum(po.items?.reduce((s, i) => s + Number(i.quantity), 0) ?? 0, 0)} sp)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#eee' }}>
              <th style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'center', width: '28px' }}>STT</th>
              <th style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'left' }}>Tên sản phẩm</th>
              <th style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'center', width: '45px' }}>ĐVT</th>
              <th style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'right', width: '45px' }}>SL</th>
              <th style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'right', width: '110px' }}>Đơn giá</th>
              {Number(po.discountAmount) > 0 && <th style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'center', width: '45px' }}>CK%</th>}
              <th style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'right', width: '120px' }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {(po.items ?? []).map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'center', color: '#888' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #bbb', padding: '5px 6px' }}>
                  <div style={{ fontWeight: '500' }}>{item.productName}</div>
                  <div style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>{item.productCode}</div>
                </td>
                <td style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'center' }}>{item.unit}</td>
                <td style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'right', fontWeight: '600' }}>{fmtNum(item.quantity, 3)}</td>
                <td style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'right' }}>
                  {isImport ? (
                    <>
                      <div>{fmtNum(item.priceForeign, 2)}{currSymbol}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{fmtMoney(item.priceVnd)}</div>
                    </>
                  ) : fmtMoney(item.priceVnd)}
                </td>
                {Number(po.discountAmount) > 0 && (
                  <td style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'center' }}>
                    {Number(item.discountPercent) > 0 ? `${item.discountPercent}%` : ''}
                  </td>
                )}
                <td style={{ border: '1px solid #bbb', padding: '5px 6px', textAlign: 'right', fontWeight: '600' }}>
                  {isImport ? (
                    <>
                      <div>{fmtNum(item.totalForeign, 2)}{currSymbol}</div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{fmtMoney(item.totalVnd)}</div>
                    </>
                  ) : fmtMoney(item.totalVnd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tổng kết */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '290px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '3px 10px', color: '#555', textAlign: 'right' }}>Tổng tiền hàng:</td>
              <td style={{ padding: '3px 10px', textAlign: 'right' }}>
                {isImport && <span style={{ color: '#888', marginRight: '8px', fontSize: '11px' }}>{fmtNum(po.subtotalForeign, 2)}{currSymbol}</span>}
                <span style={{ fontWeight: '500' }}>{fmtMoney(po.subtotalVnd)}</span>
              </td>
            </tr>
            {Number(po.discountAmount) > 0 && (
              <tr>
                <td style={{ padding: '3px 10px', color: '#555', textAlign: 'right' }}>Chiết khấu:</td>
                <td style={{ padding: '3px 10px', textAlign: 'right' }}>-{fmtMoney(po.discountAmount)}</td>
              </tr>
            )}
            {Number(po.shippingFee) > 0 && (
              <tr>
                <td style={{ padding: '3px 10px', color: '#555', textAlign: 'right' }}>
                  Phí vận chuyển{hasFreight && po.freightAgent ? ` (${po.freightAgent.name})` : ''}:
                </td>
                <td style={{ padding: '3px 10px', textAlign: 'right' }}>+{fmtMoney(po.shippingFee)}</td>
              </tr>
            )}
            <tr style={{ borderTop: '2px solid #000' }}>
              <td style={{ padding: '5px 10px', fontWeight: 'bold', textAlign: 'right', fontSize: '14px' }}>Tổng cộng:</td>
              <td style={{ padding: '5px 10px', fontWeight: 'bold', textAlign: 'right', fontSize: '14px' }}>{fmtMoney(po.totalAmountVnd)}</td>
            </tr>
            <tr>
              <td style={{ padding: '3px 10px', color: '#16a34a', textAlign: 'right' }}>Đã thanh toán:</td>
              <td style={{ padding: '3px 10px', color: '#16a34a', fontWeight: '600', textAlign: 'right' }}>{fmtMoney(Number(po.paidAmountVnd) + Number(po.shippingFeePaid))}</td>
            </tr>
            <tr>
              <td style={{ padding: '3px 10px', color: '#dc2626', fontWeight: '700', textAlign: 'right' }}>Còn nợ:</td>
              <td style={{ padding: '3px 10px', color: '#dc2626', fontWeight: '700', textAlign: 'right' }}>{fmtMoney(totalDebt)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Lịch sử thanh toán */}
      {po.payments && po.payments.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px', borderBottom: '1px solid #bbb', paddingBottom: '3px' }}>Lịch sử thanh toán</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'left' }}>Ngày</th>
                <th style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'left' }}>Loại</th>
                <th style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'left' }}>Phương thức</th>
                <th style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'right' }}>Số tiền (VND)</th>
                <th style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'left' }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {po.payments.map((p, idx) => (
                <tr key={p.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ border: '1px solid #bbb', padding: '4px 6px' }}>{fmtDate(p.date ?? p.createdAt)}</td>
                  <td style={{ border: '1px solid #bbb', padding: '4px 6px' }}>{p.paymentTarget === 'freight' ? 'Phí VC' : 'NCC'}</td>
                  <td style={{ border: '1px solid #bbb', padding: '4px 6px' }}>{PAY_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</td>
                  <td style={{ border: '1px solid #bbb', padding: '4px 6px', textAlign: 'right', fontWeight: '600' }}>
                    {fmtMoney(p.amount)}
                    {isImport && Number(p.amountForeign) > 0 && p.paymentTarget !== 'freight' && (
                      <div style={{ fontSize: '10px', color: '#888', fontWeight: 'normal' }}>{fmtNum(p.amountForeign, 2)}{currSymbol}</div>
                    )}
                  </td>
                  <td style={{ border: '1px solid #bbb', padding: '4px 6px', color: '#555' }}>{p.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ marginBottom: '10px', fontSize: '11px', color: '#555' }}>
          <strong>Tags: </strong>{tags.join(', ')}
        </div>
      )}

      {/* Ký tên */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px', marginTop: '36px', textAlign: 'center', fontSize: '11px' }}>
        {['Người lập phiếu', 'Thủ kho', 'Giám đốc'].map(role => (
          <div key={role}>
            <div style={{ marginBottom: '44px', color: '#555', fontStyle: 'italic' }}>{role}</div>
            <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
              {role === 'Người lập phiếu' && po.assignedTo
                ? (po.assignedTo.fullName ?? po.assignedTo.username)
                : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
  );
}

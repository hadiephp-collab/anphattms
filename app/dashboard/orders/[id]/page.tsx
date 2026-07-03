'use client';
// Chi tiết Đơn Hàng — layout 2 cột kiểu Sapo: main content + sidebar

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ordersApi } from '@/lib/orders';
import { getUser } from '@/lib/auth';

interface OrderDetail {
  id: number; code: string; date: string; deliveryDate?: string;
  customer?: { id: number; name: string; phone?: string };
  assignedTo?: { id: number; fullName: string; code?: string };
  status: string; invoiceStatus: string; invoiceSkipReason?: string; paymentStatus: string;
  shippingMethod: string; shippingFee: number;
  subtotal: number; discountAmount: number; discountPercent: number; totalAmount: number;
  paidAmount: number; debtAmount: number;
  notes?: string; cancelReason?: string; source?: string; tags?: string; reference?: string;
  orderType: string;
  items: Array<{
    id: number; productCode: string; productName: string; unit?: string;
    quantity: number; unitPrice: number; discountPercent: number; lineTotal: number;
  }>;
  shippingAddress?: string | null;
  payments: Array<{
    id: number; amount: number; paymentMethod: string; note?: string; createdAt: string;
    paidAt?: string | null; reference?: string | null; transactionId?: number | null; transactionCode?: string | null;
  }>;
  auditLogs: Array<{
    id: number; action: string; field?: string; oldValue?: string; newValue?: string;
    performedAt: string; performedBy?: { id: number; fullName: string };
  }>;
}

const fmt = (n?: number) => n != null ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';
const fmtNum = (n?: number) => n != null ? Number(n).toLocaleString('vi-VN') : '0';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xử lý', processing: 'Đang xử lý', completed: 'Hoàn thành', cancelled: 'Đã hủy',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};
const INVOICE_LABEL: Record<string, string> = {
  pending_invoice: 'Chờ xuất HĐ',
  invoiced:        'Đã xuất HĐ',
  no_invoice:      'Không xuất HĐ',
};
const INVOICE_COLOR: Record<string, string> = {
  pending_invoice: 'bg-orange-50 text-orange-600 border-orange-200',
  invoiced:        'bg-emerald-50 text-emerald-600 border-emerald-200',
  no_invoice:      'bg-gray-100 text-gray-500 border-gray-200',
};
const PAY_LABEL: Record<string, string> = {
  unpaid: 'Chưa thu', partial: 'Thu một phần', paid: 'Đã thanh toán',
};
const PAY_COLOR: Record<string, string> = {
  unpaid: 'bg-red-50 text-red-600', partial: 'bg-yellow-50 text-yellow-700', paid: 'bg-green-50 text-green-700',
};
const PAY_METHOD: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', other: 'Khác',
};
const ACTION_LABEL: Record<string, string> = {
  create: 'Tạo đơn', update: 'Cập nhật', cancel: 'Hủy đơn',
  payment: 'Thu tiền', status_change: 'Đổi trạng thái',
  invoice_status_change: 'Đổi trạng thái HĐ',
};
const SOURCE_LABEL: Record<string, string> = {
  web: 'Website', facebook: 'Facebook', zalo: 'Zalo', phone: 'Điện thoại',
  counter: 'Tại quầy', other: 'Khác',
};
const SOURCE_COLOR: Record<string, string> = {
  web: 'bg-blue-50 text-blue-600', facebook: 'bg-indigo-50 text-indigo-600',
  zalo: 'bg-sky-50 text-sky-600', phone: 'bg-purple-50 text-purple-600',
  counter: 'bg-green-50 text-green-600', other: 'bg-gray-100 text-gray-600',
};

// Status timeline steps
const TIMELINE_STEPS = [
  { key: 'pending',    label: 'Chờ xử lý' },
  { key: 'processing', label: 'Đang xử lý' },
  { key: 'completed',  label: 'Hoàn thành' },
];

function parseVN(s: string): number {
  return parseInt(s.replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [order, setOrder]       = useState<OrderDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [userRole, setUserRole] = useState('');

  useEffect(() => { setUserRole(getUser()?.role ?? ''); }, []);
  const [historyTab, setHistoryTab] = useState<'payments' | 'audit'>('payments');

  // Thu tiền
  const [payAmount, setPayAmount]       = useState('');
  const [payMethod, setPayMethod]       = useState('cash');
  const [payNote, setPayNote]           = useState('');
  const [payDate, setPayDate]           = useState('');
  const [payReference, setPayReference] = useState('');
  const [payLoading, setPayLoading]     = useState(false);
  const [payError, setPayError]         = useState('');
  const [showPayForm, setShowPayForm]   = useState(false);

  // Bỏ qua HĐ
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason]       = useState('');
  const [skipSaving, setSkipSaving]       = useState(false);

  // Hủy đơn
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason]       = useState('');
  const [cancelSaving, setCancelSaving]       = useState(false);

  async function load() {
    setLoading(true);
    try { setOrder(await ordersApi.getOne(Number(id))); }
    catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function handleAddPayment() {
    if (!payAmount || parseVN(payAmount) <= 0) return;
    setPayLoading(true); setPayError('');
    try {
      await ordersApi.addPayment(Number(id), {
        amount: parseVN(payAmount),
        paymentMethod: payMethod,
        note: payNote || undefined,
        paidAt: payDate ? new Date(payDate).toISOString() : undefined,
        reference: payReference || undefined,
      });
      setPayAmount(''); setPayNote(''); setPayDate(''); setPayReference(''); setShowPayForm(false);
      load();
    } catch (e: unknown) { setPayError(e instanceof Error ? e.message : 'Lỗi'); }
    setPayLoading(false);
  }

  function openPayModal() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setPayDate(`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setPayAmount(String(Math.round(Number(order?.debtAmount || 0))));
    setShowPayForm(true);
  }

  async function handleUpdateStatus(status: string) {
    try { await ordersApi.updateStatus(Number(id), status); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Lỗi'); }
  }

  function handleCancel() {
    setShowCancelModal(true);
  }

  async function handleCancelConfirm() {
    setCancelSaving(true);
    try {
      await ordersApi.cancel(Number(id), cancelReason || undefined);
      setShowCancelModal(false);
      setCancelReason('');
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Lỗi'); }
    setCancelSaving(false);
  }

  async function handleIssueInvoice() {
    try { await ordersApi.updateInvoiceStatus(Number(id), 'invoiced'); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Lỗi'); }
  }

  async function handleSkipInvoice() {
    setSkipSaving(true);
    try {
      await ordersApi.updateInvoiceStatus(Number(id), 'no_invoice', skipReason || undefined);
      setShowSkipModal(false); setSkipReason('');
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Lỗi'); }
    setSkipSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Đang tải...</div>;
  if (!order)  return <div className="flex items-center justify-center h-64 text-red-400 text-sm">Không tìm thấy đơn hàng</div>;

  const canEditCompleted = ['admin', 'manager'].includes(userRole);
  const canEdit      = order.status !== 'cancelled' && (order.status !== 'completed' || canEditCompleted);
  const canCancel    = order.status !== 'cancelled' && order.status !== 'completed';
  const hasDebt      = Number(order.debtAmount) > 0;
  const tags         = order.tags ? order.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const currentStep  = order.status === 'cancelled' ? -1 : TIMELINE_STEPS.findIndex(s => s.key === order.status);

  return (
    <div className="p-6 min-h-screen">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-gray-800 font-mono">{order.code}</h1>
              {order.status === 'cancelled' ? (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-50 text-red-600 border-red-200">
                  Đã hủy
                </span>
              ) : (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              )}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PAY_COLOR[order.paymentStatus] ?? ''}`}>
                {PAY_LABEL[order.paymentStatus] ?? order.paymentStatus}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(order.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {order.customer && ` · ${order.customer.name}`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => window.open(`/print/orders/${id}`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            In đơn
          </button>
          {canEdit && (
            <Link href={`/dashboard/orders/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Sửa đơn hàng
            </Link>
          )}
          {order.invoiceStatus === 'pending_invoice' && order.status !== 'cancelled' && (
            <>
              <button onClick={handleIssueInvoice}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition">
                Xuất HĐ
              </button>
              <button onClick={() => setShowSkipModal(true)}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition">
                Bỏ qua HĐ
              </button>
            </>
          )}
          {order.status === 'pending' && (
            <button onClick={() => handleUpdateStatus('processing')}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">
              Bắt đầu xử lý
            </button>
          )}
          {order.status === 'processing' && (
            <button onClick={() => handleUpdateStatus('completed')}
              className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition">
              Hoàn thành
            </button>
          )}
          {canCancel && (
            <button onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition border border-red-200">
              Hủy đơn hàng
            </button>
          )}
        </div>
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="flex gap-5 items-start">

        {/* ══ Left column ══ */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Customer card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Thông tin khách hàng</p>
              {order.customer && (
                <Link href={`/dashboard/partners/${order.customer.id}`}
                  className="text-xs text-blue-500 hover:text-blue-700 hover:underline">
                  Xem hồ sơ →
                </Link>
              )}
            </div>
            {order.customer ? (
              <div className="p-4">
                {/* Name + phone */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-sm">
                    {order.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{order.customer.name}</p>
                    {order.customer.phone && (
                      <p className="text-xs text-gray-500 mt-0.5">{order.customer.phone}</p>
                    )}
                  </div>
                </div>
                {/* Shipping address */}
                {order.shippingAddress && (
                  <div className="flex items-start gap-2 mb-2">
                    <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs text-gray-600 leading-relaxed">{order.shippingAddress}</span>
                  </div>
                )}
                {/* Debt highlight */}
                {hasDebt && (
                  <div className="mt-2 flex items-center justify-between bg-red-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-red-600 font-medium">Nợ đơn này</span>
                    <span className="text-sm font-bold text-red-600">{fmt(order.debtAmount)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 text-gray-400">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm italic">Khách lẻ (không có hồ sơ)</span>
              </div>
            )}
          </div>

          {/* Payment card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Thanh toán</p>
              {order.status !== 'cancelled' && hasDebt && (
                <button onClick={openPayModal}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-1.5 bg-blue-50 rounded-xl hover:bg-blue-100 transition">
                  + Thu tiền
                </button>
              )}
            </div>
            <div className="px-4 py-2.5 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Tổng đơn</p>
                <p className="font-semibold text-gray-800 text-sm">{fmt(order.totalAmount)}</p>
              </div>
              <div className="border-x border-gray-100">
                <p className="text-[10px] text-gray-400 mb-0.5">Đã thu</p>
                <p className="font-semibold text-green-600 text-sm">{fmt(order.paidAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Còn nợ</p>
                <p className={`font-semibold text-sm ${hasDebt ? 'text-red-500' : 'text-gray-400'}`}>
                  {hasDebt ? fmt(order.debtAmount) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Products table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Thông tin sản phẩm ({order.items.length})
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-4 py-2.5 text-left font-medium w-8">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Sản phẩm</th>
                  <th className="px-4 py-2.5 text-center font-medium">SL</th>
                  <th className="px-4 py-2.5 text-right font-medium">Đơn giá</th>
                  <th className="px-4 py-2.5 text-center font-medium">CK</th>
                  <th className="px-4 py-2.5 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((it, idx) => (
                  <tr key={it.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{it.productName}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{it.productCode}{it.unit && ` / ${it.unit}`}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{it.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(it.unitPrice)}</td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">
                      {it.discountPercent > 0 ? `${it.discountPercent}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Totals */}
            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Tổng tiền ({order.items.length} sản phẩm)</span>
                <span>{fmt(order.subtotal)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Chiết khấu{Number(order.discountPercent) > 0 ? ` (${order.discountPercent}%)` : ''}</span>
                  <span className="text-green-600">−{fmt(order.discountAmount)}</span>
                </div>
              )}
              {Number(order.shippingFee) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Phí giao hàng</span>
                  <span>{fmt(order.shippingFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 text-base pt-1.5 border-t border-gray-200">
                <span>Khách phải trả</span>
                <span className="text-blue-600">{fmt(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Lý do hủy */}
          {order.status === 'cancelled' && order.cancelReason && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">Lý do hủy:</span> {order.cancelReason}
            </div>
          )}

          {/* Lý do bỏ qua HĐ */}
          {(order.invoiceStatus === 'skipped' || order.invoiceStatus === 'no_invoice') && order.invoiceSkipReason && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-600">
              <span className="font-semibold">Lý do bỏ qua HĐ:</span> {order.invoiceSkipReason}
            </div>
          )}

          {/* Ghi chú */}
          {order.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold text-xs text-amber-600 uppercase tracking-wide mb-1">Ghi chú đơn hàng</p>
              <p>{order.notes}</p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide mr-1">Tags:</span>
              {tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {/* Lịch sử thu tiền + Thao tác — tab ngang */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-gray-100">
              {([
                { key: 'payments', label: 'Lịch sử thu tiền', count: order.payments.length },
                { key: 'audit',    label: 'Lịch sử thao tác', count: order.auditLogs.length },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setHistoryTab(tab.key)}
                  className={`flex items-center gap-1.5 px-5 py-3 text-xs font-semibold border-b-2 transition-colors ${
                    historyTab === tab.key
                      ? 'border-blue-500 text-blue-600 bg-blue-50/40'
                      : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}>
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    historyTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                  }`}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Tab: Thu tiền */}
            {historyTab === 'payments' && (
              order.payments.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Chưa có lần thu nào</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left font-medium">Ngày thu</th>
                      <th className="px-4 py-2.5 text-right font-medium">Số tiền</th>
                      <th className="px-4 py-2.5 text-center font-medium">Phương thức</th>
                      <th className="px-4 py-2.5 text-left font-medium">Ghi chú</th>
                      <th className="px-4 py-2.5 text-center font-medium">Phiếu thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {order.payments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {new Date(p.paidAt ?? p.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-600">{fmt(p.amount)}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-500">{PAY_METHOD[p.paymentMethod] ?? p.paymentMethod}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{p.note ?? (p.reference ? `Ref: ${p.reference}` : '—')}</td>
                        <td className="px-4 py-2.5 text-center">
                          {p.transactionId && p.transactionCode ? (
                            <Link href={`/dashboard/thu-chi/phieu-thu/${p.transactionId}`}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
                              {p.transactionCode}
                            </Link>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td className="px-4 py-2 font-semibold text-xs text-gray-600">Tổng đã thu</td>
                      <td className="px-4 py-2 text-right font-bold text-green-600 text-sm">{fmt(order.paidAmount)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              )
            )}

            {/* Tab: Thao tác */}
            {historyTab === 'audit' && (
              order.auditLogs.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Chưa có lịch sử thao tác</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left font-medium">Thời gian</th>
                      <th className="px-4 py-2.5 text-left font-medium">Người thực hiện</th>
                      <th className="px-4 py-2.5 text-left font-medium">Thao tác</th>
                      <th className="px-4 py-2.5 text-left font-medium">Trước → Sau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {order.auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(log.performedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{log.performedBy?.fullName ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{ACTION_LABEL[log.action] ?? log.action}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          {log.oldValue || log.newValue ? (
                            <>{log.field && <span className="text-gray-400 mr-1">[{log.field}]</span>}<span className="text-red-400 line-through">{log.oldValue ?? '—'}</span><span className="mx-1 text-gray-300">→</span><span className="text-green-600">{log.newValue ?? '—'}</span></>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

        {/* ══ Right sidebar ══ */}
        <div className="w-56 flex-shrink-0 space-y-4">

          {/* Compact status timeline */}
          {order.status !== 'cancelled' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Luồng xử lý</p>
              <div className="flex items-center">
                {TIMELINE_STEPS.map((step, idx) => {
                  const done    = idx <= currentStep;
                  const current = idx === currentStep;
                  const last    = idx === TIMELINE_STEPS.length - 1;
                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                          done ? (current ? 'bg-blue-600 border-blue-600' : 'bg-green-500 border-green-500') : 'bg-white border-gray-200'
                        }`}>
                          {done && !current ? (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : current ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                          )}
                        </div>
                        <p className={`text-[9px] mt-1 font-medium whitespace-nowrap leading-tight text-center ${
                          done ? (current ? 'text-blue-600' : 'text-green-600') : 'text-gray-400'
                        }`}>{step.label}</p>
                      </div>
                      {!last && (
                        <div className={`flex-1 h-0.5 mx-1 -mt-3.5 ${idx < currentStep ? 'bg-green-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Thông tin đơn hàng</p>
            </div>
            <div className="divide-y divide-gray-50 text-sm">
              {[
                {
                  label: 'Trạng thái HĐ',
                  value: (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${INVOICE_COLOR[order.invoiceStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                      {INVOICE_LABEL[order.invoiceStatus] ?? order.invoiceStatus}
                    </span>
                  ),
                },
                {
                  label: 'Ngày tạo',
                  value: new Date(order.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                },
                order.deliveryDate ? {
                  label: 'Hẹn giao',
                  value: new Date(order.deliveryDate).toLocaleDateString('vi-VN'),
                } : null,
                order.assignedTo ? {
                  label: 'Bán bởi',
                  value: order.assignedTo.fullName,
                } : null,
                order.source ? {
                  label: 'Nguồn',
                  value: (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLOR[order.source] ?? 'bg-gray-100 text-gray-600'}`}>
                      {SOURCE_LABEL[order.source] ?? order.source}
                    </span>
                  ),
                } : null,
                {
                  label: 'Vận chuyển',
                  value: order.shippingMethod === 'delivery' ? 'Giao hàng' : 'Tự lấy',
                },
                Number(order.shippingFee) > 0 ? {
                  label: 'Phí VC',
                  value: fmt(order.shippingFee),
                } : null,
                Number(order.discountAmount) > 0 ? {
                  label: 'Chiết khấu',
                  value: <span className="text-green-600">{fmt(order.discountAmount)}</span>,
                } : null,
                order.reference ? {
                  label: 'Tham chiếu',
                  value: <span className="font-mono text-xs">{order.reference}</span>,
                } : null,
              ].filter(Boolean).map((row: any) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-gray-400 text-xs">{row.label}</span>
                  <span className="text-gray-700 text-xs font-medium text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice actions */}
          {order.invoiceStatus === 'pending_invoice' && order.status !== 'cancelled' && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-orange-700 mb-3">Chờ xuất hóa đơn</p>
              <div className="flex flex-col gap-2">
                <button onClick={handleIssueInvoice}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition">
                  Xuất HĐ ngay
                </button>
                <button onClick={() => setShowSkipModal(true)}
                  className="w-full py-2 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-xl border border-gray-200 transition">
                  Bỏ qua HĐ
                </button>
              </div>
            </div>
          )}

          {/* Quick status change */}
          {canEdit && order.status !== 'completed' && order.status !== 'cancelled' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Cập nhật trạng thái</p>
              <div className="space-y-2">
                {order.status === 'pending' && (
                  <button onClick={() => handleUpdateStatus('processing')}
                    className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition border border-blue-200">
                    → Bắt đầu xử lý
                  </button>
                )}
                {(order.status === 'pending' || order.status === 'processing') && (
                  <button onClick={() => handleUpdateStatus('completed')}
                    className="w-full py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-xl transition border border-green-200">
                    → Hoàn thành
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Modal Thu tiền ─── */}
      {showPayForm && order.status !== 'cancelled' && hasDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900 text-base">Xác nhận thanh toán</h3>
                <p className="text-xs text-gray-400 mt-0.5">Còn nợ: <span className="font-semibold text-red-500">{fmt(order.debtAmount)}</span></p>
              </div>
              <button onClick={() => { setShowPayForm(false); setPayError(''); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs text-emerald-700 font-semibold">Phiếu thu tự động</p>
                  <p className="text-[11px] text-emerald-600 leading-relaxed">Thu tiền tại đây sẽ tự động tạo phiếu thu tương ứng trong module Thu Chi.</p>
                </div>
              </div>

              {/* Row 1: PTTT + Số tiền */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Phương thức TT</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white">
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Số tiền thu</label>
                  <input type="text" inputMode="numeric"
                    value={payAmount ? Number(payAmount).toLocaleString('vi-VN') : ''}
                    onChange={e => setPayAmount(e.target.value.replace(/\./g, '').replace(/[^0-9]/g, ''))}
                    placeholder={fmtNum(Number(order.debtAmount))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100 text-right font-semibold" />
                </div>
              </div>
              {/* Tài khoản NH — placeholder khi module Tài Khoản NH hoàn thiện */}
              {payMethod === 'bank_transfer' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[11px] text-blue-600 font-medium">Tài khoản nhận tiền</p>
                    <p className="text-[10px] text-blue-400">Sẽ hiển thị tự động sau khi thiết lập module Tài Khoản NH</p>
                  </div>
                </div>
              )}

              {/* Row 2: Ngày TT + Tham chiếu */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Ngày thanh toán</label>
                  <input type="datetime-local" value={payDate} onChange={e => setPayDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Tham chiếu</label>
                  <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)}
                    placeholder="Số CK, mã GD..."
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              {/* Row 3: Ghi chú */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Ghi chú</label>
                <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)}
                  placeholder="Tuỳ chọn..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              {payError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{payError}</p>
              )}
            </div>
            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => { setShowPayForm(false); setPayError(''); }}
                disabled={payLoading}
                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition font-medium">
                Thoát
              </button>
              <button onClick={handleAddPayment} disabled={payLoading || !payAmount}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition">
                {payLoading ? 'Đang lưu...' : 'Thanh toán đơn hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Hủy đơn ─── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Xác nhận hủy đơn hàng</h3>
            <p className="text-sm text-gray-500 mb-4">Hành động này không thể hoàn tác. Tồn kho sẽ được hoàn lại nếu đơn đã hoàn thành.</p>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              rows={3} placeholder="Lý do hủy (tuỳ chọn): khách đổi ý, hết hàng..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none resize-none mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowCancelModal(false); setCancelReason(''); }} disabled={cancelSaving}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">Đóng</button>
              <button onClick={handleCancelConfirm} disabled={cancelSaving}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50 transition">
                {cancelSaving ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Bỏ qua HĐ ─── */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Bỏ qua xuất hóa đơn</h3>
            <p className="text-sm text-gray-500 mb-4">Nhập lý do bỏ qua (tuỳ chọn):</p>
            <textarea value={skipReason} onChange={e => setSkipReason(e.target.value)}
              rows={3} placeholder="Vd: Khách không cần hóa đơn..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none resize-none mb-4" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSkipModal(false)} disabled={skipSaving}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">Huỷ</button>
              <button onClick={handleSkipInvoice} disabled={skipSaving}
                className="px-4 py-2 text-sm font-semibold bg-gray-700 hover:bg-gray-800 text-white rounded-xl disabled:opacity-50 transition">
                {skipSaving ? 'Đang lưu...' : 'Xác nhận bỏ qua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { returnsApi } from '@/lib/returns';

interface ReturnItem {
  id: number; productCode: string; productName: string; unit: string | null;
  quantity: number; unitPrice: number; refundAmount: number;
  condition: string; restoreStock: boolean; itemReason: string | null;
  product?: { imageUrl?: string | null } | null;
}
interface ReturnExchangeItem {
  id: number; productCode: string; productName: string; unit: string | null;
  quantity: number; unitPrice: number; discountAmount: number; taxPercent: number; lineTotal: number;
  product?: { imageUrl?: string | null } | null;
}
interface ReturnRecord {
  id: number; code: string; status: string; refundMethod: string;
  totalRefund: number; reason: string | null; notes: string | null;
  rejectReason: string | null; processedAt: string | null;
  referenceCode: string | null; documentDate: string | null;
  createdAt: string; updatedAt: string;
  order: { id: number; code: string; totalAmount: number } | null;
  customer: { id: number; name: string; phone: string | null } | null;
  processedBy: { id: number; username: string; fullName: string | null } | null;
  createdBy: { id: number; username: string; fullName: string | null } | null;
  returnBranch: { id: number; name: string } | null;
  items: ReturnItem[];
  exchangeItems: ReturnExchangeItem[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã huỷ',
};
const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-600 border border-amber-100',
  approved:  'bg-emerald-50 text-emerald-600 border border-emerald-100',
  rejected:  'bg-red-50 text-red-500 border border-red-100',
  cancelled: 'bg-gray-50 text-gray-400 border border-gray-200',
};
const REFUND_LABEL: Record<string, string> = {
  cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', exchange: 'Đổi hàng', no_refund: 'Không hoàn tiền',
};
const CONDITION_LABEL: Record<string, string> = {
  good: 'Còn tốt', damaged: 'Hỏng hóc', missing_parts: 'Thiếu PK',
};
const CONDITION_STYLE: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-600',
  damaged: 'bg-red-50 text-red-500',
  missing_parts: 'bg-amber-50 text-amber-600',
};

function fmt(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function fmtDt(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400 font-medium mb-0.5">{label}</div>
      <div className="text-sm text-gray-800">{value ?? '—'}</div>
    </div>
  );
}

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [ret, setRet]     = useState<ReturnRecord | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const data = await returnsApi.getOne(Number(id));
      setRet(data);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Không tải được phiếu trả hàng');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove() {
    setProcessing(true); setError(''); setSuccess('');
    try {
      await returnsApi.approve(Number(id));
      setSuccess('Đã duyệt phiếu — kho hàng đã được hoàn tự động');
      await load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Lỗi'); }
    setProcessing(false);
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setProcessing(true); setError('');
    try {
      await returnsApi.reject(Number(id), rejectReason.trim());
      setRejectModal(false); setRejectReason('');
      setSuccess('Đã từ chối phiếu trả hàng');
      await load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Lỗi'); }
    setProcessing(false);
  }

  async function handleCancel() {
    if (!confirm('Huỷ phiếu trả hàng này?')) return;
    setProcessing(true); setError('');
    try {
      await returnsApi.cancel(Number(id));
      setSuccess('Đã huỷ phiếu');
      await load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Lỗi'); }
    setProcessing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await returnsApi.remove(Number(id));
      router.push('/dashboard/returns');
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Lỗi'); setDeleting(false); setDeleteModal(false); }
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Đang tải...</div>;
  if (loadError) return (
    <div className="p-8 flex flex-col items-center gap-3">
      <div className="text-red-500 text-sm">{loadError}</div>
      <div className="flex gap-2">
        <button onClick={load} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Thử lại</button>
        <button onClick={() => router.push('/dashboard/returns')} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Quay lại danh sách</button>
      </div>
    </div>
  );
  if (!ret) return null;

  const isPending  = ret.status === 'pending';
  const isApproved = ret.status === 'approved';
  const isRejected = ret.status === 'rejected';

  const totalQty  = ret.items.reduce((s, i) => s + i.quantity, 0);
  const creatorName = ret.createdBy?.fullName || ret.createdBy?.username || '—';
  const processorName = ret.processedBy?.fullName || ret.processedBy?.username;

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center gap-3 flex-shrink-0">
        <Link href="/dashboard/returns"
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-base font-bold text-gray-900 font-mono">{ret.code}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[ret.status] ?? ''}`}>
            {STATUS_LABEL[ret.status] ?? ret.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Print */}
          <button
            onClick={() => window.open(`/dashboard/returns/${ret.id}/print`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            In phiếu
          </button>

          {isPending && (
            <>
              <button onClick={handleCancel} disabled={processing}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors disabled:opacity-50">
                Huỷ phiếu
              </button>
              <button onClick={() => setRejectModal(true)} disabled={processing}
                className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors disabled:opacity-50">
                Từ chối
              </button>
              <button onClick={handleApprove} disabled={processing}
                className="px-4 py-1.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50">
                {processing ? 'Đang xử lý...' : 'Duyệt phiếu'}
              </button>
            </>
          )}
          {isPending && (
            <button onClick={() => setDeleteModal(true)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xóa phiếu">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto px-5 py-4 space-y-4 max-w-6xl mx-auto w-full">
        {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm px-4 py-3 rounded-xl">{success}</div>}

        {/* ── Row 1: Info + Bổ sung ── */}
        <div className="flex gap-4 items-start">
          {/* Thông tin phiếu */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Thông tin phiếu
              </h2>
              <button onClick={() => setHistoryOpen(true)} className="text-xs text-blue-500 hover:underline">Lịch sử phiếu trả hàng</button>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-3.5">
              <InfoRow label="Khách hàng"
                value={ret.customer
                  ? <Link href={`/dashboard/partners/${ret.customer.id}`} className="text-blue-600 hover:underline">{ret.customer.name}</Link>
                  : '—'
                }
              />
              <InfoRow label="Chi nhánh trả" value={ret.returnBranch?.name ?? '—'} />
              <InfoRow label="Mã đơn hàng gốc"
                value={ret.order
                  ? <Link href={`/dashboard/orders/${ret.order.id}`} className="text-blue-600 hover:underline font-mono">{ret.order.code}</Link>
                  : '—'
                }
              />
              <InfoRow label="Mã đơn đổi hàng" value="—" />
              <InfoRow label="Ngày tạo phiếu trả" value={fmtDt(ret.createdAt)} />
              <InfoRow label="Nhân viên tạo phiếu" value={creatorName} />
              <InfoRow label="Ngày nhận hàng trả" value={isApproved ? fmtDt(ret.processedAt) : '—'} />
              <InfoRow label="Mã tham chiếu" value={ret.referenceCode ?? '—'} />
              <InfoRow label="Ngày chứng từ" value={fmtDate(ret.documentDate)} />
              <InfoRow label="PT hoàn tiền" value={REFUND_LABEL[ret.refundMethod] ?? ret.refundMethod} />
              {processorName && <InfoRow label="Người xử lý" value={processorName} />}
            </div>
          </div>

          {/* Thông tin bổ sung */}
          <div className="w-64 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Thông tin bổ sung</h2>
            <div>
              <div className="text-xs text-gray-400 font-medium mb-1">Lý do trả hàng</div>
              <div className="text-sm text-gray-700">{ret.reason || <span className="text-gray-300 italic">Chưa có ghi chú</span>}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium mb-1">Ghi chú</div>
              <div className="text-sm text-gray-700">{ret.notes || <span className="text-gray-300 italic">Chưa có ghi chú</span>}</div>
            </div>
            {isRejected && ret.rejectReason && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <div className="text-xs font-semibold text-red-500 mb-1">Lý do từ chối</div>
                <div className="text-sm text-red-600">{ret.rejectReason}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 2: Sản phẩm trả ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h2 className="font-semibold text-gray-800">Sản phẩm trả</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-8">STT</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-12">Ảnh</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase">Tên sản phẩm</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-20">Đơn vị</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-16">Số lượng</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-28">Đơn giá trả</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-28">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ret.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-400 text-center">{idx + 1}</td>
                  <td className="px-4 py-3">
                    {item.product?.imageUrl ? (
                      <img src={item.product.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg border border-gray-100" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{item.productName}</div>
                    <div className="text-xs text-blue-500 font-mono mt-0.5">{item.productCode}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONDITION_STYLE[item.condition] ?? 'bg-gray-50 text-gray-400'}`}>
                        {CONDITION_LABEL[item.condition] ?? item.condition}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.restoreStock ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                        {item.restoreStock ? '✓ Hoàn kho' : 'Không hoàn kho'}
                      </span>
                      {item.itemReason && (
                        <span className="text-[10px] text-gray-400 italic">{item.itemReason}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.unit ?? '—'}</td>
                  <td className="px-4 py-3 text-center font-medium text-gray-800">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(item.unitPrice)}đ</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(item.refundAmount * item.quantity)}đ</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer summary */}
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 space-y-1.5">
            <div className="flex justify-end items-center gap-16 text-sm">
              <span className="text-gray-500">Số lượng trả ({ret.items.length} sản phẩm)</span>
              <span className="font-medium text-gray-700 w-28 text-right">{totalQty}</span>
            </div>
            <div className="flex justify-end items-center gap-16 text-sm">
              <span className="text-gray-500">Cần hoàn tiền hàng trả</span>
              <span className="font-medium text-gray-700 w-28 text-right">{fmt(ret.totalRefund)}đ</span>
            </div>
            <div className="flex justify-end items-center gap-16 text-sm border-t border-gray-200 pt-1.5 mt-1">
              <span className="font-semibold text-gray-700">Tổng tiền cần hoàn trả khách</span>
              <span className="font-bold text-red-600 text-base w-28 text-right">{fmt(ret.totalRefund)}đ</span>
            </div>
          </div>
        </div>

        {/* ── Row 2b: Sản phẩm đổi (chỉ show khi có) ── */}
        {ret.exchangeItems?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-blue-50 flex items-center gap-2 bg-blue-50/40">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <h2 className="font-semibold text-blue-700">Sản phẩm đổi</h2>
              <span className="text-xs text-blue-400 ml-1">({ret.exchangeItems.length} sản phẩm)</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-blue-50/30 border-b border-blue-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-8">STT</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-12">Ảnh</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase">Tên sản phẩm</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-20">Đơn vị</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-16">Số lượng</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-28">Đơn giá</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-bold text-gray-400 uppercase w-28">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ret.exchangeItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/20">
                    <td className="px-4 py-3 text-gray-400 text-center">{idx + 1}</td>
                    <td className="px-4 py-3">
                      {item.product?.imageUrl ? (
                        <img src={item.product.imageUrl} alt="" className="w-10 h-10 object-cover rounded-lg border border-gray-100" />
                      ) : (
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{item.productName}</div>
                      <div className="text-xs text-gray-400 font-mono">{item.productCode}</div>
                      {item.discountAmount > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-500 mt-0.5">
                          Giảm {fmt(item.discountAmount)}đ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{item.unit || '—'}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(item.unitPrice)}đ</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(item.lineTotal)}đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-blue-50 bg-blue-50/30 px-5 py-3 flex justify-end items-center gap-16 text-sm">
              <span className="text-gray-500">Tổng tiền hàng đổi</span>
              <span className="font-bold text-blue-600 w-28 text-right">
                {fmt(ret.exchangeItems.reduce((s, i) => s + i.lineTotal, 0))}đ
              </span>
            </div>
          </div>
        )}

        {/* ── Row 3: Trạng thái nhận hàng + hoàn tiền ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Nhận hàng */}
          <div className={`px-5 py-3.5 flex items-center gap-3 ${isApproved ? 'border-b border-gray-100' : ''}`}>
            {isApproved ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : isRejected ? (
              <div className="w-5 h-5 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
            )}
            <div>
              <span className={`text-sm font-medium ${isApproved ? 'text-emerald-700' : isRejected ? 'text-red-500' : 'text-gray-400'}`}>
                {isApproved ? 'Đã nhận hàng trả lại' : isRejected ? 'Phiếu bị từ chối' : 'Chờ nhận hàng trả lại'}
              </span>
              {ret.processedAt && (
                <span className="text-xs text-gray-400 ml-2">({fmtDt(ret.processedAt)})</span>
              )}
            </div>
          </div>

          {/* Hoàn tiền — chỉ show khi approved */}
          {isApproved && (
            <div className="px-5 py-3.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-emerald-700">Đã hoàn tiền</span>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-3 gap-4 mb-3 pl-8">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Cần trả khách</div>
                  <div className="font-semibold text-gray-800">{fmt(ret.totalRefund)}đ</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Đã hoàn trả</div>
                  <div className="font-semibold text-emerald-600">{fmt(ret.totalRefund)}đ</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Còn phải trả</div>
                  <div className="font-semibold text-red-500">0đ</div>
                </div>
              </div>

              {/* Payment entry */}
              <div className="pl-8 flex items-center justify-between py-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-sm text-gray-600">
                    {REFUND_LABEL[ret.refundMethod] ?? ret.refundMethod} — {fmt(ret.totalRefund)}đ
                  </span>
                </div>
                <span className="text-xs text-gray-400">{fmtDt(ret.processedAt)}</span>
              </div>
            </div>
          )}

          {/* Từ chối — chỉ show khi rejected */}
          {isRejected && ret.rejectReason && (
            <div className="px-5 py-3.5 bg-red-50 border-t border-red-100">
              <div className="text-xs font-semibold text-red-500 mb-1">Lý do từ chối</div>
              <div className="text-sm text-red-600">{ret.rejectReason}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal từ chối ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-1">Từ chối phiếu trả</h3>
            <p className="text-sm text-gray-400 mb-4">Vui lòng nhập lý do để thông báo cho nhân viên.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Lý do từ chối..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectModal(false); setRejectReason(''); }} disabled={processing}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                Huỷ
              </button>
              <button onClick={handleReject} disabled={processing || !rejectReason.trim()}
                className="px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-50 transition-colors">
                {processing ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal xóa ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-1">Xóa phiếu trả</h3>
            <p className="text-sm text-gray-500 mb-5">Bạn có chắc muốn xóa phiếu <span className="font-semibold text-gray-800">{ret.code}</span>? Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal(false)} disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                Huỷ
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-50 transition-colors">
                {deleting ? 'Đang xóa...' : 'Xóa phiếu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lịch sử phiếu — slide-in panel ── */}
      {historyOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setHistoryOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-80 z-50 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Lịch sử phiếu</h3>
              <button onClick={() => setHistoryOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-3 bottom-3 w-px bg-gray-100" />
                <div className="space-y-5">

                  {/* Tạo phiếu */}
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-400 flex-shrink-0 flex items-center justify-center z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="text-sm font-medium text-gray-800">Phiếu được tạo</div>
                      {ret.createdBy && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          bởi <span className="font-medium">{ret.createdBy.fullName || ret.createdBy.username}</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">{fmtDt(ret.createdAt)}</div>
                    </div>
                  </div>

                  {/* Duyệt */}
                  {ret.status === 'approved' && ret.processedAt && (
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-400 flex-shrink-0 flex items-center justify-center z-10">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="text-sm font-medium text-emerald-700">Đã duyệt — hoàn kho</div>
                        {ret.processedBy && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            bởi <span className="font-medium">{ret.processedBy.fullName || ret.processedBy.username}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">{fmtDt(ret.processedAt)}</div>
                      </div>
                    </div>
                  )}

                  {/* Từ chối */}
                  {ret.status === 'rejected' && ret.processedAt && (
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 border-2 border-red-400 flex-shrink-0 flex items-center justify-center z-10">
                        <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="text-sm font-medium text-red-600">Đã từ chối</div>
                        {ret.processedBy && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            bởi <span className="font-medium">{ret.processedBy.fullName || ret.processedBy.username}</span>
                          </div>
                        )}
                        {ret.rejectReason && (
                          <div className="text-xs text-red-400 mt-1 bg-red-50 rounded-lg px-2 py-1">{ret.rejectReason}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">{fmtDt(ret.processedAt)}</div>
                      </div>
                    </div>
                  )}

                  {/* Huỷ */}
                  {ret.status === 'cancelled' && (
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-300 flex-shrink-0 flex items-center justify-center z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="text-sm font-medium text-gray-500">Đã huỷ phiếu</div>
                        <div className="text-xs text-gray-400 mt-0.5">{fmtDt(ret.updatedAt)}</div>
                      </div>
                    </div>
                  )}

                  {/* Chờ duyệt */}
                  {ret.status === 'pending' && (
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-300 flex-shrink-0 flex items-center justify-center z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="text-sm font-medium text-amber-600">Đang chờ duyệt</div>
                        <div className="text-xs text-gray-400 mt-0.5">Chưa có hành động xử lý</div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

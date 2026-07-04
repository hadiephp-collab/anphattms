'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getPurchaseReturn, confirmPurchaseReturn, cancelPurchaseReturn,
  sendPurchaseReturn, updatePurchaseReturnRefund,
  PurchaseReturn, LOAI_TRA_HANG,
} from '@/lib/purchase-returns';

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('vi-VN') : '—';
const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString('vi-VN') : '—';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', sent: 'Đã gửi NCC', confirmed: 'Đã xác nhận', cancelled: 'Đã huỷ',
};
const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-amber-50 text-amber-600 border border-amber-200',
  sent:      'bg-blue-50 text-blue-600 border border-blue-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const PTTT_OPTIONS = [
  { value: '', label: '-- Chọn PTTT --' },
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
  { value: 'momo', label: 'MoMo' },
  { value: 'debt_offset', label: 'Bù trừ công nợ' },
  { value: 'other', label: 'Khác' },
];

export default function PurchaseReturnDetailPage() {
  const { id } = useParams();
  const router  = useRouter();

  const [data, setData]       = useState<PurchaseReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [sending, setSending]             = useState(false);
  const [confirming, setConfirming]       = useState(false);
  const [cancelling, setCancelling]       = useState(false);
  const [cancelReason, setCancelReason]   = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [refundInput, setRefundInput]     = useState('');
  const [refundPttt, setRefundPttt]       = useState('');
  const [refundDate, setRefundDate]       = useState('');
  const [createPhieuThu, setCreatePhieuThu] = useState(false);
  const [updatingRefund, setUpdatingRefund] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await getPurchaseReturn(Number(id));
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSend() {
    setSending(true);
    try {
      await sendPurchaseReturn(Number(id));
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm() {
    if (!confirm('Xác nhận phiếu trả? Tồn kho và công nợ NCC sẽ được cập nhật ngay.')) return;
    setConfirming(true);
    try {
      await confirmPurchaseReturn(Number(id));
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelPurchaseReturn(Number(id), cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCancelling(false);
    }
  }

  async function handleUpdateRefund() {
    const amount = parseFloat(refundInput.replace(/[^\d.]/g, '')) || 0;
    setUpdatingRefund(true);
    try {
      await updatePurchaseReturnRefund(Number(id), {
        refundedAmount: amount,
        pttt: refundPttt || undefined,
        ngayHoanTien: refundDate || undefined,
        createPhieuThu,
      });
      await load();
      setRefundInput('');
      setRefundPttt('');
      setRefundDate('');
      setCreatePhieuThu(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdatingRefund(false);
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Đang tải...</div>
    </div>
  );

  if (error || !data) return (
    <div className="p-8 text-center">
      <p className="text-red-500 text-sm mb-3">{error || 'Không tìm thấy phiếu trả'}</p>
      <Link href="/dashboard/don-hang-nhap/tra-hang-ncc" className="text-blue-600 text-sm hover:underline">
        ← Quay lại danh sách
      </Link>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/don-hang-nhap/tra-hang-ncc"
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-800 font-mono">{data.code}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[data.status]}`}>
                {STATUS_LABEL[data.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Tạo bởi {data.actorName} · {fmtDateTime(data.createdAt)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`/print/tra-hang-ncc/${data.id}`, '_blank')}
            className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            In phiếu
          </button>
          {data.status === 'draft' && (
            <>
              <Link href={`/dashboard/don-hang-nhap/tra-hang-ncc/${data.id}/chinh-sua`}
                className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Chỉnh sửa
              </Link>
              <button onClick={() => setShowCancelModal(true)}
                className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                Huỷ phiếu
              </button>
              <button onClick={handleSend} disabled={sending}
                className="px-3 py-2 text-sm font-medium text-blue-700 border border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-60">
                {sending ? 'Đang gửi...' : '📤 Gửi yêu cầu NCC'}
              </button>
              <button onClick={handleConfirm} disabled={confirming}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-sm shadow-emerald-200">
                {confirming ? 'Đang xác nhận...' : '✓ Xác nhận trả hàng'}
              </button>
            </>
          )}
          {data.status === 'sent' && (
            <>
              <button onClick={() => setShowCancelModal(true)}
                className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                Huỷ phiếu
              </button>
              <button onClick={handleConfirm} disabled={confirming}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-sm shadow-emerald-200">
                {confirming ? 'Đang xác nhận...' : '✓ Xác nhận trả hàng'}
              </button>
            </>
          )}
          {data.status === 'confirmed' && (
            <button onClick={() => setShowCancelModal(true)}
              className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
              Huỷ & hoàn tác
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Nhà Cung Cấp</p>
          <p className="font-semibold text-gray-800">{data.supplier?.name ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{data.supplier?.code}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Đơn Nhập Gốc</p>
          {data.purchaseOrder ? (
            <Link href={`/dashboard/don-hang-nhap/${data.purchaseOrder.id}`}
              className="font-semibold text-blue-600 hover:underline font-mono">
              {data.purchaseOrder.code}
            </Link>
          ) : <p className="font-semibold text-gray-400">—</p>}
          <p className="text-xs text-gray-400 mt-0.5">Ngày trả: {fmtDate(data.returnDate)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tổng Giá Trị Trả</p>
          <p className="text-xl font-bold text-gray-800">{fmt(data.totalAmountVnd)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{data.items?.length ?? 0} sản phẩm</p>
        </div>
      </div>

      {/* Info section — loaiTraHang, reason, notes, ghiChuNCC, ngayGuiYeuCau */}
      {(data.loaiTraHang || data.reason || data.notes || data.ghiChuNCC || data.ngayGuiYeuCau) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          {data.loaiTraHang && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Loại trả:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100">
                {LOAI_TRA_HANG[data.loaiTraHang] ?? data.loaiTraHang}
              </span>
            </div>
          )}
          {data.reason && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Lý do trả:</span>
              <span className="text-sm text-gray-700 ml-2">{data.reason}</span>
            </div>
          )}
          {data.ghiChuNCC && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ghi chú NCC:</span>
              <span className="text-sm text-gray-700 ml-2">{data.ghiChuNCC}</span>
            </div>
          )}
          {data.notes && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ghi chú nội bộ:</span>
              <span className="text-sm text-gray-700 ml-2">{data.notes}</span>
            </div>
          )}
          {data.ngayGuiYeuCau && (
            <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-1">
              <span className="text-xs font-medium text-blue-500 uppercase tracking-wide">Đã gửi NCC:</span>
              <span className="text-sm text-blue-700">{fmtDateTime(data.ngayGuiYeuCau)}</span>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Sản phẩm trả hàng</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Sản phẩm</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Số lượng</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Đơn giá</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Thành tiền</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lý do</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(data.items ?? []).map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  {item.productCode && (
                    <span className="text-xs text-gray-400 font-mono mr-2">{item.productCode}</span>
                  )}
                  <span className="text-gray-800 font-medium">{item.productName}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {Number(item.quantity).toLocaleString('vi-VN')} {item.unit}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{fmt(item.priceVnd)}</td>
                <td className="px-5 py-3 text-right font-medium text-gray-800">{fmt(item.totalVnd)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{item.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-100">
              <td colSpan={3} className="px-5 py-3 text-right text-sm font-semibold text-gray-600">Tổng cộng</td>
              <td className="px-5 py-3 text-right text-base font-bold text-gray-800">{fmt(data.totalAmountVnd)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Confirmation info */}
      {data.status === 'confirmed' && data.confirmedAt && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-sm font-medium text-emerald-700">
            ✓ Đã xác nhận lúc {fmtDateTime(data.confirmedAt)}
          </p>
          <p className="text-xs text-emerald-600 mt-1">
            Tồn kho đã giảm và công nợ NCC đã được trừ {fmt(data.totalAmountVnd)}.
          </p>
        </div>
      )}

      {/* Refund section — chỉ hiện khi đã xác nhận */}
      {data.status === 'confirmed' && (() => {
        const RS = {
          none:    { label: 'Chưa hoàn tiền',   cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
          partial: { label: 'Hoàn tiền một phần', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
          full:    { label: 'Đã hoàn toàn bộ',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
        };
        const rs = RS[data.refundStatus ?? 'none'] ?? RS.none;
        const refundedAmt = Number(data.refundedAmount ?? 0);
        const totalAmt    = Number(data.totalAmountVnd);
        const pct         = totalAmt > 0 ? Math.min(100, (refundedAmt / totalAmt) * 100) : 0;
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Hoàn tiền NCC</h2>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${rs.cls}`}>{rs.label}</span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Đã hoàn: <span className="font-semibold text-gray-700">{fmt(refundedAmt)}</span></span>
                <span>Tổng cần hoàn: <span className="font-semibold text-gray-700">{fmt(totalAmt)}</span></span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Existing refund info */}
            {refundedAmt > 0 && data.ptttHoan && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 space-y-0.5">
                {data.ptttHoan && <div>PTTT hoàn: <span className="font-medium text-gray-700">{PTTT_OPTIONS.find(o => o.value === data.ptttHoan)?.label ?? data.ptttHoan}</span></div>}
                {data.ngayHoanTien && <div>Ngày hoàn tiền: <span className="font-medium text-gray-700">{fmtDate(data.ngayHoanTien)}</span></div>}
              </div>
            )}

            {/* Update form */}
            <div className="space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Số tiền NCC đã hoàn (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    max={totalAmt}
                    step={1000}
                    value={refundInput}
                    onChange={e => setRefundInput(e.target.value)}
                    placeholder={refundedAmt > 0 ? String(refundedAmt) : 'Nhập số tiền đã nhận lại...'}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
                {totalAmt > 0 && (
                  <button
                    onClick={() => setRefundInput(String(totalAmt))}
                    className="px-3 py-2 text-xs font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors whitespace-nowrap">
                    Toàn bộ
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Phương thức hoàn tiền</label>
                  <select value={refundPttt} onChange={e => setRefundPttt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
                    {PTTT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Ngày hoàn tiền</label>
                  <input type="date" value={refundDate} onChange={e => setRefundDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={createPhieuThu} onChange={e => setCreatePhieuThu(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  Tạo phiếu thu tự động khi lưu
                </label>
                <button
                  onClick={handleUpdateRefund}
                  disabled={updatingRefund || refundInput === ''}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap">
                  {updatingRefund ? 'Đang lưu...' : 'Cập nhật hoàn tiền'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cancel info */}
      {data.status === 'cancelled' && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-1">
          {data.nguoiHuy && (
            <p className="text-xs text-gray-500">
              Huỷ bởi <span className="font-medium text-gray-700">{data.nguoiHuy}</span>
              {data.ngayHuy && <span> · {fmtDateTime(data.ngayHuy)}</span>}
            </p>
          )}
          {data.cancelReason && (
            <>
              <p className="text-sm font-medium text-gray-600">Lý do huỷ</p>
              <p className="text-sm text-gray-500">{data.cancelReason}</p>
            </>
          )}
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-1">Huỷ phiếu trả hàng</h3>
            {data.status === 'sent' && (
              <p className="text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                Phiếu đang ở trạng thái Đã gửi NCC — huỷ sẽ không ảnh hưởng đến tồn kho hay công nợ.
              </p>
            )}
            {data.status === 'confirmed' && (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                Phiếu đã xác nhận — huỷ sẽ <strong>hoàn lại tồn kho</strong> và <strong>cộng lại công nợ NCC</strong>.
              </p>
            )}
            <label className="text-xs font-medium text-gray-600 mb-1 block mt-3">Lý do huỷ</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="Nhập lý do huỷ..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Đóng
              </button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60">
                {cancelling ? 'Đang huỷ...' : 'Xác nhận huỷ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

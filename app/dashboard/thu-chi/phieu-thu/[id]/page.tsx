'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { transactionsApi, PM_LABEL } from '@/lib/transactions';

interface Tx {
  id: number; code: string; type: string;
  amount: number; paymentMethod: string; category: string | null;
  note: string | null; date: string | null; createdAt: string; updatedAt: string;
  isDeleted: boolean; deletedAt: string | null;
  tags: string | null; imageUrl: string | null;
  affectsBusinessResult: boolean;
  payerType: string | null; reference: string | null;
  partner?: { id: number; name: string; code?: string } | null;
  branchEntity?: { id: number; name: string } | null;
  createdBy?: { id: number; fullName: string } | null;
  order?: { id: number; code: string } | null;
}

const PAYER_TYPE_LABEL: Record<string, string> = {
  customer: 'Khách hàng', supplier: 'Nhà cung cấp',
  employee: 'Nhân viên', other: 'Đối tượng khác',
};

const PTTT_OPTIONS = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
  { value: 'momo', label: 'MoMo' },
  { value: 'other', label: 'Khác' },
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}
function fmtDatetime(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('vi-VN');
}
function toInputDate(s: string | null) {
  if (!s) return '';
  return new Date(s).toISOString().slice(0, 10);
}

export default function PhieuThuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tx, setTx] = useState<Tx | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    transactionsApi.getOne(Number(id))
      .then(setTx)
      .catch(() => setError('Không tìm thấy phiếu thu'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm('Bạn có chắc muốn hủy phiếu thu này? Hành động này không thể hoàn tác.')) return;
    setDeleting(true);
    try {
      await transactionsApi.remove(Number(id));
      router.push('/dashboard/thu-chi/phieu-thu');
    } catch {
      alert('Hủy phiếu thất bại. Vui lòng thử lại.');
      setDeleting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Đang tải...</div>
  );
  if (error || !tx) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-gray-400 text-sm">{error || 'Không tìm thấy phiếu'}</p>
      <button onClick={() => router.back()} className="text-sm text-emerald-600 hover:underline">← Quay lại</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header — gộp back + mã phiếu + badge + actions */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/thu-chi/phieu-thu')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Phiếu thu
          </button>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-bold text-gray-800 font-mono">{tx.code}</span>
          {tx.isDeleted
            ? <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 rounded-full">Đã hủy</span>
            : <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">Hoàn thành</span>}
        </div>
        <div className="flex items-center gap-2">
          {tx.order ? (
            <a href={`/dashboard/orders/${tx.order.id}`}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Đơn hàng {tx.order.code}
            </a>
          ) : (
            !tx.isDeleted && (
              <>
                <Link href={`/dashboard/thu-chi/phieu-thu/${tx.id}/chinh-sua`}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Sửa phiếu
                </Link>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-xl hover:bg-red-50 disabled:opacity-60 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  {deleting ? 'Đang hủy...' : 'Hủy phiếu'}
                </button>
              </>
            )
          )}
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            In phiếu
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        {/* Banner phiếu tự động */}
        {tx.order && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm text-blue-700">
              Phiếu thu này được <span className="font-semibold">tạo tự động</span> từ đơn hàng{' '}
              <a href={`/dashboard/orders/${tx.order.id}`} className="font-semibold underline hover:text-blue-900">{tx.order.code}</a>.
              Để điều chỉnh hoặc hủy, vui lòng thao tác trong đơn hàng.
            </p>
          </div>
        )}

        <div className="flex gap-5 max-w-5xl mx-auto">

          {/* ── Main content ── */}
          <div className="flex-1 space-y-5">

            {/* Thông tin chung */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-700 mb-4">Thông tin chung</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Nhóm người nộp" value={tx.payerType ? PAYER_TYPE_LABEL[tx.payerType] || tx.payerType : '—'} />
                <InfoRow label="Tên người nộp"
                  value={tx.partner
                    ? <span className="text-emerald-700 font-medium">{tx.partner.name}</span>
                    : '—'} />
                <InfoRow label="Danh mục / Loại phiếu" value={tx.category || '—'} />
                <InfoRow label="Mã phiếu" value={<span className="font-mono font-semibold">{tx.code}</span>} />
              </div>
            </div>

            {/* Giá trị ghi nhận */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-700 mb-4">Giá trị ghi nhận</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Giá trị"
                  value={<span className="text-emerald-600 font-bold text-base">{fmtMoney(Number(tx.amount))}</span>} />
                <InfoRow label="Hình thức thanh toán" value={PM_LABEL[tx.paymentMethod] || tx.paymentMethod} />
                <InfoRow label="Ngày thu" value={fmtDate(tx.date)} />
                <InfoRow label="Số tham chiếu" value={tx.reference || '—'} />
                {tx.order && (
                  <InfoRow label="Đơn hàng liên quan"
                    value={<span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-xs">{tx.order.code}</span>} />
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-50 space-y-2.5">
                <CheckRow label="Hạch toán kết quả kinh doanh" checked={tx.affectsBusinessResult !== false} accent="emerald" />
              </div>
            </div>

            {/* Tags */}
            {tx.tags && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tags / Nhãn</h2>
                <div className="flex flex-wrap gap-2">
                  {tx.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                    <span key={t} className="px-2.5 py-1 text-sm bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="w-72 shrink-0 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-4">Thông tin bổ sung</p>
              <div className="space-y-3">
                <SideRow label="Chi nhánh" value={tx.branchEntity?.name || '—'} />
                <SideRow label="Nhân viên tạo" value={tx.createdBy?.fullName || '—'} />
                <SideRow label="Ngày tạo" value={fmtDatetime(tx.createdAt)} />
                <SideRow label="Ngày ghi nhận" value={fmtDate(tx.date)} />
                <SideRow label="Ngày cập nhật" value={fmtDatetime(tx.updatedAt)} />
                {tx.isDeleted && <SideRow label="Ngày hủy" value={fmtDatetime(tx.deletedAt)} />}
              </div>
            </div>

            {tx.note && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-gray-700 mb-2">Mô tả / Diễn giải</p>
                <p className="text-sm text-gray-600 leading-relaxed">{tx.note}</p>
              </div>
            )}

            {tx.imageUrl && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-gray-700 mb-3">Ảnh chứng từ</p>
                <img src={tx.imageUrl} alt="Chứng từ" className="w-full rounded-xl border border-gray-100" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <EditModal
          tx={tx}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => { setTx(updated); setShowEditModal(false); }}
        />
      )}
    </div>
  );
}

/* ─── Edit Modal ─────────────────────────────────────────────────── */
function EditModal({ tx, onClose, onSaved }: {
  tx: Tx;
  onClose: () => void;
  onSaved: (updated: Tx) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: toInputDate(tx.date),
    amount: String(tx.amount),
    paymentMethod: tx.paymentMethod,
    category: tx.category || '',
    note: tx.note || '',
    tags: tx.tags || '',
    reference: tx.reference || '',
    payerType: tx.payerType || '',
    affectsBusinessResult: tx.affectsBusinessResult !== false,
  });

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await transactionsApi.update(tx.id, {
        date: form.date || null,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        category: form.category || null,
        note: form.note || null,
        tags: form.tags || null,
        reference: form.reference || null,
        payerType: form.payerType || null,
        affectsBusinessResult: form.affectsBusinessResult,
      });
      onSaved(updated);
    } catch {
      alert('Lưu thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">Sửa phiếu thu</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{tx.code}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4 max-h-[70vh] overflow-y-auto">
          {/* Left column */}
          <div className="space-y-4">
            <Field label="Ngày thu">
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </Field>
            <Field label="Số tiền (VNĐ)">
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </Field>
            <Field label="Phương thức thanh toán">
              <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {PTTT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Danh mục">
              <input value={form.category} onChange={e => set('category', e.target.value)}
                placeholder="Doanh thu bán hàng..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </Field>
            <Field label="Nhóm người nộp">
              <select value={form.payerType} onChange={e => set('payerType', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">— Chọn nhóm —</option>
                <option value="customer">Khách hàng</option>
                <option value="supplier">Nhà cung cấp</option>
                <option value="employee">Nhân viên</option>
                <option value="other">Đối tượng khác</option>
              </select>
            </Field>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <Field label="Số tham chiếu">
              <input value={form.reference} onChange={e => set('reference', e.target.value)}
                placeholder="Số hóa đơn, chứng từ..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </Field>
            <Field label="Tags / Nhãn">
              <input value={form.tags} onChange={e => set('tags', e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </Field>
            <Field label="Diễn giải / Ghi chú">
              <textarea value={form.note} onChange={e => set('note', e.target.value)}
                rows={4} placeholder="Mô tả chi tiết nội dung thu tiền..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
            </Field>
            <label className="flex items-center gap-2.5 cursor-pointer mt-2">
              <input type="checkbox" checked={form.affectsBusinessResult}
                onChange={e => set('affectsBusinessResult', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-emerald-600" />
              <span className="text-sm text-gray-600">Hạch toán kết quả kinh doanh</span>
            </label>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-white transition">
            Hủy bỏ
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Helper components ─────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  );
}

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-700 text-right font-medium">{value}</span>
    </div>
  );
}

function CheckRow({ label, checked, accent }: { label: string; checked: boolean; accent: string }) {
  return (
    <label className="flex items-center gap-2.5">
      <div className={`w-4 h-4 rounded flex items-center justify-center ${checked ? `bg-${accent}-600` : 'bg-gray-200'}`}>
        {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span className="text-sm text-gray-600">{label}</span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  );
}

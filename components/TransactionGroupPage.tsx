'use client';

import { useEffect, useState } from 'react';
import { transactionGroupsApi } from '@/lib/transactions';

interface TxGroup {
  id: number;
  code: string;
  name: string;
  type: 'receipt' | 'payment';
  affectsBusinessResult: boolean;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Props { type: 'receipt' | 'payment'; }

const isReceipt = (t: string) => t === 'receipt';

export default function TransactionGroupPage({ type }: Props) {
  const accent = isReceipt(type) ? 'emerald' : 'red';
  const title  = isReceipt(type) ? 'Loại Phiếu Thu' : 'Loại Phiếu Chi';
  const sub    = isReceipt(type) ? 'Quản lý các loại phiếu thu tiền' : 'Quản lý các loại phiếu chi tiền';

  const [rows, setRows]           = useState<TxGroup[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState<TxGroup | null>(null);
  const [delItem, setDelItem]     = useState<TxGroup | null>(null);
  const [search, setSearch]       = useState('');

  async function load() {
    setLoading(true);
    try { setRows(await transactionGroupsApi.getAll(type)); } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, [type]);

  function openCreate() { setEditItem(null); setShowModal(true); }
  function openEdit(g: TxGroup) { setEditItem(g); setShowModal(true); }

  async function handleToggle(g: TxGroup) {
    await transactionGroupsApi.toggleActive(g.id);
    load();
  }

  async function handleDelete() {
    if (!delItem) return;
    try { await transactionGroupsApi.remove(delItem.id); load(); }
    catch (e: any) { alert(e.message || 'Không thể xóa'); }
    setDelItem(null);
  }

  const filtered = rows.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
        </div>
        <button onClick={openCreate}
          className={`inline-flex items-center gap-2 px-4 py-2.5 bg-${accent}-600 hover:bg-${accent}-700 text-white text-sm font-semibold rounded-xl transition shadow-sm`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm loại
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo mã, tên loại..."
              className="w-full max-w-sm text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {search ? 'Không tìm thấy kết quả' : 'Chưa có loại nào. Bấm "+ Thêm loại" để tạo.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium w-36">Mã loại</th>
                  <th className="px-4 py-3 text-left font-medium">Tên loại</th>
                  <th className="px-4 py-3 text-center font-medium w-44">Hạch toán KQKD</th>
                  <th className="px-4 py-3 text-left font-medium">Mô tả</th>
                  <th className="px-4 py-3 text-center font-medium w-28">Trạng thái</th>
                  <th className="px-4 py-3 text-center font-medium w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(g => (
                  <tr key={g.id} className={`hover:bg-gray-50/50 ${!g.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">{g.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                    <td className="px-4 py-3 text-center">
                      {g.affectsBusinessResult
                        ? <span className={`inline-flex items-center gap-1 text-xs font-medium text-${accent}-700 bg-${accent}-50 px-2.5 py-1 rounded-full`}>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                            Có hạch toán
                          </span>
                        : <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Không hạch toán</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate" title={g.description || undefined}>
                      {g.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggle(g)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${g.isActive ? `bg-${accent}-500` : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${g.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(g)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Chỉnh sửa">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={() => setDelItem(g)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Xóa">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary */}
        {!loading && rows.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 px-1">
            {rows.length} loại · {rows.filter(r => r.isActive).length} đang hoạt động · {rows.filter(r => r.affectsBusinessResult).length} hạch toán KQKD
          </p>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <GroupModal
          type={type}
          accent={accent}
          item={editItem}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {/* Delete Confirm */}
      {delItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Xóa loại phiếu</p>
                <p className="text-sm text-gray-500 mt-0.5">Xóa <span className="font-semibold">"{delItem.name}"</span>? Các phiếu đã dùng loại này sẽ không bị ảnh hưởng.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDelItem(null)}
                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition font-medium">
                Hủy
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Modal Thêm / Sửa ── */
interface ModalProps {
  type: 'receipt' | 'payment';
  accent: string;
  item: TxGroup | null;
  onClose(): void;
  onSaved(): void;
}

function GroupModal({ type, accent, item, onClose, onSaved }: ModalProps) {
  const isEdit = !!item;
  const [code, setCode]   = useState(item?.code ?? '');
  const [name, setName]   = useState(item?.name ?? '');
  const [kqkd, setKqkd]   = useState(item?.affectsBusinessResult ?? true);
  const [desc, setDesc]   = useState(item?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSave() {
    if (!code.trim() || !name.trim()) { setError('Vui lòng nhập đầy đủ mã và tên'); return; }
    setSaving(true); setError('');
    try {
      const payload = { code: code.trim().toUpperCase(), name: name.trim(), type, affectsBusinessResult: kqkd, description: desc.trim() || null };
      if (isEdit) await transactionGroupsApi.update(item!.id, payload);
      else        await transactionGroupsApi.create(payload);
      onSaved();
    } catch (e: any) { setError(e.message || 'Lỗi lưu'); }
    setSaving(false);
  }

  const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Chỉnh sửa loại phiếu' : 'Thêm loại phiếu'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã loại *</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="VD: TIEN_HANG" maxLength={50}
                className={inputCls} disabled={isEdit} />
              {isEdit && <p className="text-[10px] text-gray-400 mt-1">Mã không thể thay đổi sau khi tạo</p>}
            </div>
            <div>
              <label className={labelCls}>Loại phiếu</label>
              <div className={`text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-500`}>
                {type === 'receipt' ? 'Phiếu Thu' : 'Phiếu Chi'}
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Tên loại *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={type === 'receipt' ? 'VD: Tiền hàng bán lẻ' : 'VD: Chi phí vận hành'}
              maxLength={200} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Mô tả</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Ghi chú về loại phiếu này..." rows={2}
              className={`${inputCls} resize-none`} />
          </div>

          {/* Hạch toán KQKD toggle */}
          <div className={`flex items-center justify-between px-4 py-3.5 rounded-xl border ${kqkd ? `bg-${accent}-50 border-${accent}-100` : 'bg-gray-50 border-gray-100'}`}>
            <div>
              <p className="text-sm font-semibold text-gray-800">Hạch toán kết quả kinh doanh</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {kqkd
                  ? 'Phiếu loại này sẽ được tính vào doanh thu / chi phí trong báo cáo KQKD'
                  : 'Phiếu loại này không ảnh hưởng đến báo cáo kết quả kinh doanh'}
              </p>
            </div>
            <button onClick={() => setKqkd(!kqkd)}
              className={`ml-4 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${kqkd ? `bg-${accent}-500` : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${kqkd ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition font-medium">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving || !code || !name}
            className={`flex-1 py-2.5 bg-${accent}-600 hover:bg-${accent}-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition`}>
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm loại'}
          </button>
        </div>
      </div>
    </div>
  );
}

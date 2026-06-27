'use client';

import { useEffect, useState, useCallback } from 'react';
import { productCategoriesApi, type ProductCategory } from '@/lib/product-categories';

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 placeholder:text-gray-300';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

export default function ProductCategoriesPage() {
  const [cats, setCats] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try { setCats(await productCategoriesApi.getAll(search)); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    if (!confirm('Xác nhận xóa loại sản phẩm này?')) return;
    await productCategoriesApi.remove(id);
    load();
  }

  async function handleBulkDelete() {
    if (!confirm(`Xác nhận xóa ${selectedIds.size} loại sản phẩm đã chọn?`)) return;
    await Promise.all([...selectedIds].map((id) => productCategoriesApi.remove(id)));
    setSelectedIds(new Set());
    load();
  }

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(cat: ProductCategory) { setEditing(cat); setShowModal(true); }
  function toggleSelect(id: number) {
    setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelectedIds(selectedIds.size === cats.length ? new Set() : new Set(cats.map((c) => c.id)));
  }

  const fmt = (s: string) => new Date(s).toLocaleDateString('vi-VN');

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <a href="/dashboard/products" className="hover:text-blue-500 transition">Sản Phẩm</a>
            <span>/</span>
            <span className="text-gray-600 font-medium">Loại sản phẩm</span>
          </div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight">Loại sản phẩm</h1>
          <p className="text-gray-400 text-xs mt-0.5">Quản lý danh mục / loại để phân loại sản phẩm</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Thêm loại sản phẩm
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* Bulk bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-50 border-b border-blue-100 rounded-t-xl">
              <span className="text-sm font-semibold text-blue-700">
                Đã chọn <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-md">{selectedIds.size}</span> loại
              </span>
              <button onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Xóa đã chọn
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-400 hover:text-blue-600 font-medium">Bỏ chọn</button>
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Tìm theo tên, mã loại..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 bg-gray-50/80 placeholder:text-gray-300" />
            </div>
            <span className="ml-auto text-xs text-gray-300">{cats.length} loại</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="w-10 pl-4 py-3 border-b border-gray-200">
                    <input type="checkbox"
                      checked={cats.length > 0 && selectedIds.size === cats.length}
                      ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < cats.length; }}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Tên loại sản phẩm</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Mã loại</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Ghi chú</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Trạng thái</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Ngày tạo</th>
                  <th className="border-b border-gray-200 w-24" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-14">
                    <div className="inline-flex flex-col items-center gap-2 text-gray-300">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span className="text-xs">Đang tải...</span>
                    </div>
                  </td></tr>
                ) : cats.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-14">
                    <svg className="w-10 h-10 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <p className="text-gray-300 text-sm">Chưa có loại sản phẩm nào</p>
                    <button onClick={openCreate} className="mt-2 text-blue-500 text-xs hover:underline font-medium">+ Thêm loại đầu tiên</button>
                  </td></tr>
                ) : cats.map((cat) => (
                  <tr key={cat.id} className={`border-b border-gray-50 last:border-0 group transition-colors ${selectedIds.has(cat.id) ? 'bg-blue-50/40' : 'hover:bg-blue-50/20'}`}>
                    <td className="w-10 pl-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(cat.id)} onChange={() => toggleSelect(cat.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{cat.name}</td>
                    <td className="px-4 py-3">
                      {cat.code
                        ? <span className="font-mono text-[11px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md tracking-wide">{cat.code}</span>
                        : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{cat.notes || <span className="text-gray-200">—</span>}</td>
                    <td className="px-4 py-3">
                      {cat.isActive
                        ? <span className="text-[11px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">Hoạt động</span>
                        : <span className="text-[11px] bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full font-medium">Tắt</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{fmt(cat.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(cat)}
                          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition">Sửa</button>
                        <button onClick={() => handleDelete(cat.id)}
                          className="px-3 py-1.5 text-xs bg-red-50 text-red-400 hover:bg-red-100 rounded-lg font-medium transition">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <CategoryModal
          editing={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

/* ─── Modal thêm / sửa ─────────────────────────────────────────────────────── */
function CategoryModal({ editing, onClose, onSaved }: {
  editing: ProductCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [code, setCode] = useState(editing?.code || '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [isActive, setIsActive] = useState(editing?.isActive !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls2 = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 placeholder:text-gray-300';
  const labelCls2 = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

  async function handleSubmit() {
    if (!name.trim()) { setError('Tên loại sản phẩm không được trống'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: name.trim(), code: code.trim() || undefined, notes: notes.trim() || undefined, isActive };
      if (editing) await productCategoriesApi.update(editing.id, payload);
      else await productCategoriesApi.create(payload);
      onSaved();
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || 'Đã xảy ra lỗi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[480px] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">{editing ? 'Sửa loại sản phẩm' : 'Thêm loại sản phẩm'}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div>
            <label className={labelCls2}>Tên loại sản phẩm <span className="text-red-400">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Dây hàn MIG, Que hàn MMA..." className={inputCls2} autoFocus />
          </div>
          <div>
            <label className={labelCls2}>Mã loại</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: DH-MIG (tùy chọn)" className={inputCls2} />
          </div>
          <div>
            <label className={labelCls2}>Ghi chú</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder="Mô tả ngắn về loại sản phẩm này..." className={inputCls2} />
          </div>
          {editing && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div onClick={() => setIsActive((v) => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-700 font-medium">{isActive ? 'Đang hoạt động' : 'Tắt'}</span>
            </label>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Hủy</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-60">
            {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Thêm')}
          </button>
        </div>
      </div>
    </div>
  );
}

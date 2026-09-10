'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getMatrix, batchUpsertPrices, getPriceLists, getPriceListDetail,
  createPriceList, updatePriceList, deletePriceList, copyPriceList,
  savePriceListItems,
  MatrixRow, PriceList, PriceListDetail, NhomGia,
} from '@/lib/price-lists';
import { productsApi } from '@/lib/products';

const fmt = (v: number | null | undefined) =>
  v == null ? '' : new Intl.NumberFormat('vi-VN').format(Number(v));

const parsePriceInput = (s: string): number =>
  Number(s.replace(/[.,\s]/g, '').replace(/[^0-9-]/g, '')) || 0;

const NHOM_GIA_COLS: { key: NhomGia; label: string; color: string }[] = [
  { key: 'Le',    label: 'Lẻ',       color: 'bg-blue-50' },
  { key: 'NoiBo', label: 'Nội bộ',   color: 'bg-purple-50' },
  { key: 'TM1',   label: 'TM cấp 1', color: 'bg-green-50' },
  { key: 'TM2',   label: 'TM cấp 2', color: 'bg-yellow-50' },
  { key: 'TM3',   label: 'TM cấp 3', color: 'bg-orange-50' },
];

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm flex items-center gap-2 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? '✓' : '✗'} {msg}
    </div>
  );
}

// ─── Tab 1: Ma trận giá ───────────────────────────────────────────────────────

function MatrixTab() {
  const [rows, setRows]       = useState<MatrixRow[]>([]);
  const [search, setSearch]   = useState('');
  const [edits, setEdits]     = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getMatrix(search || undefined)); } catch {}
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const editKey = (productId: number, col: NhomGia) => `${productId}_${col}`;

  const getCellValue = (row: MatrixRow, col: NhomGia): string => {
    const k = editKey(row.productId, col);
    if (k in edits) return edits[k];
    const v = row[col];
    return v != null ? String(v) : '';
  };

  const handleChange = (productId: number, col: NhomGia, val: string) =>
    setEdits((prev) => ({ ...prev, [editKey(productId, col)]: val }));

  const dirtyCount = Object.values(edits).filter(Boolean).length;

  const handleSave = async () => {
    const items: { productId: number; nhomGia: NhomGia; donGia: number }[] = [];
    for (const [k, v] of Object.entries(edits)) {
      if (!v) continue;
      const [pid, col] = k.split('_');
      items.push({ productId: Number(pid), nhomGia: col as NhomGia, donGia: parsePriceInput(v) });
    }
    if (!items.length) return;
    setSaving(true);
    try {
      await batchUpsertPrices(items);
      setEdits({});
      await load();
      setToast({ msg: `Đã lưu ${items.length} giá`, type: 'success' });
    } catch (e: any) {
      setToast({ msg: e.message ?? 'Lỗi lưu', type: 'error' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-3">
        <input
          className="border rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Tìm tên / mã sản phẩm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-gray-400">{rows.length} sản phẩm</span>
        <div className="flex-1" />
        {dirtyCount > 0 && <span className="text-xs text-amber-600">{dirtyCount} ô chưa lưu</span>}
        <button
          onClick={handleSave}
          disabled={saving || dirtyCount === 0}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40 transition"
        >
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-24">Mã SP</th>
              <th className="text-left px-3 py-2.5 font-medium text-gray-600">Tên sản phẩm</th>
              <th className="text-right px-3 py-2.5 font-medium text-gray-500 text-xs">Giá bán lẻ<br/>(gốc)</th>
              {NHOM_GIA_COLS.map((c) => (
                <th key={c.key} className={`text-center px-2 py-2.5 font-medium text-gray-700 text-xs w-32 ${c.color}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Không có sản phẩm</td></tr>
            ) : rows.map((row) => (
              <tr key={row.productId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-500 text-xs font-mono">{row.code}</td>
                <td className="px-3 py-1.5 font-medium">{row.name}</td>
                <td className="px-3 py-1.5 text-right text-gray-500 text-xs">{fmt(row.sellingPrice)}</td>
                {NHOM_GIA_COLS.map((c) => {
                  const k = editKey(row.productId, c.key);
                  const isDirty = k in edits;
                  return (
                    <td key={c.key} className={`px-1 py-1 ${c.color}`}>
                      <input
                        type="text"
                        className={`w-full text-right text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-400 ${isDirty ? 'border-amber-400 bg-amber-50' : 'border-transparent bg-transparent hover:border-gray-300'}`}
                        value={getCellValue(row, c.key)}
                        placeholder={fmt(row.sellingPrice)}
                        onChange={(e) => handleChange(row.productId, c.key, e.target.value)}
                        onBlur={(e) => {
                          const num = parsePriceInput(e.target.value);
                          if (num > 0) handleChange(row.productId, c.key, String(num));
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">Nhấp vào ô để sửa giá. Để trống = dùng giá bán lẻ gốc. Nhấn "Lưu thay đổi" để áp dụng.</p>
    </div>
  );
}

// ─── Modal tạo/sửa bảng giá ──────────────────────────────────────────────────

function PriceListFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: PriceList | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name:        initial?.name        ?? '',
    description: initial?.description ?? '',
    type:        initial?.type        ?? 'fixed' as 'fixed' | 'pct',
    pctDiscount: initial?.pctDiscount ?? 0,
    validFrom:   initial?.validFrom   ?? '',
    validTo:     initial?.validTo     ?? '',
    isActive:    initial?.isActive    ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Tên bảng giá không được để trống'); return; }
    setSaving(true); setError('');
    try {
      const data = {
        name:        form.name.trim(),
        description: form.description || undefined,
        type:        form.type,
        pctDiscount: form.type === 'pct' ? Number(form.pctDiscount) : 0,
        validFrom:   form.validFrom || undefined,
        validTo:     form.validTo   || undefined,
        ...(isEdit ? { isActive: form.isActive } : {}),
      };
      if (isEdit && initial) await updatePriceList(initial.id, data);
      else await createPriceList(data);
      onSaved();
    } catch (e: any) { setError(e.message ?? 'Lỗi'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{isEdit ? 'Sửa bảng giá' : 'Tạo bảng giá mới'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên bảng giá *</label>
            <input className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mô tả</label>
            <input className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loại bảng giá</label>
            <select className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="fixed">Giá cố định từng sản phẩm</option>
              <option value="pct">Giảm % từ giá lẻ</option>
            </select>
          </div>
          {form.type === 'pct' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mức giảm (%)</label>
              <input type="number" min={0} max={100} step={0.5}
                className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.pctDiscount} onChange={(e) => set('pctDiscount', e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hiệu lực từ</label>
              <input type="date" className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Đến ngày</label>
              <input type="date" className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.validTo} onChange={(e) => set('validTo', e.target.value)} />
            </div>
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="accent-blue-600" />
              Đang hoạt động
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm rounded border hover:bg-gray-50">Huỷ</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo mới')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal chi tiết + sửa items ──────────────────────────────────────────────

function PriceListDetailModal({
  priceList,
  onClose,
  onRefresh,
}: {
  priceList: PriceList;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [detail, setDetail]       = useState<PriceListDetail | null>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [itemEdits, setItemEdits] = useState<Record<number, string>>({});
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [addMode, setAddMode]     = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const load = useCallback(async () => {
    const d = await getPriceListDetail(priceList.id);
    setDetail(d);
    setItemEdits({});
  }, [priceList.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (addMode && allProducts.length === 0)
      productsApi.getAll().then((r) => setAllProducts(r.data ?? [])).catch(() => {});
  }, [addMode, allProducts.length]);

  const dirtyItemCount = Object.keys(itemEdits).length;

  const handleSaveItems = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const rows: { productId: number; price: number }[] = [];
      for (const item of detail.items) {
        const editVal = itemEdits[item.productId];
        rows.push({ productId: item.productId, price: editVal !== undefined ? parsePriceInput(editVal) : Number(item.price) });
      }
      for (const [pidStr, val] of Object.entries(itemEdits)) {
        const pid = Number(pidStr);
        if (!detail.items.find((i) => i.productId === pid)) {
          const p = parsePriceInput(val);
          if (p > 0) rows.push({ productId: pid, price: p });
        }
      }
      await savePriceListItems(priceList.id, rows.filter((r) => r.price > 0));
      await load();
      onRefresh();
      setToast({ msg: 'Đã lưu', type: 'success' });
    } catch (e: any) { setToast({ msg: e.message, type: 'error' }); }
    setSaving(false);
  };

  const handleAddProduct = (product: any) => {
    if (!detail?.items.find((i) => i.productId === product.id)) {
      setItemEdits((prev) => ({ ...prev, [product.id]: String(product.sellingPrice ?? 0) }));
    }
    setAddMode(false); setAddSearch('');
  };

  const handleRemoveItem = (productId: number) => {
    setItemEdits((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    if (detail) setDetail({ ...detail, items: detail.items.filter((i) => i.productId !== productId) });
  };

  const filteredItems = (detail?.items ?? []).filter((i) =>
    !productSearch || i.name.toLowerCase().includes(productSearch.toLowerCase()) || i.code.toLowerCase().includes(productSearch.toLowerCase()),
  );

  const newItems = Object.entries(itemEdits)
    .filter(([pidStr]) => !detail?.items.find((i) => i.productId === Number(pidStr)))
    .map(([pidStr]) => allProducts.find((p) => p.id === Number(pidStr)))
    .filter(Boolean)
    .map((p) => ({ id: 0, productId: p.id, code: p.code, name: p.name, sellingPrice: Number(p.sellingPrice), price: 0 }));

  const displayItems = [...filteredItems, ...newItems];

  const addableProducts = allProducts.filter((p) => {
    const notYet = !detail?.items.find((i) => i.productId === p.id) && !(p.id in itemEdits);
    const matchSearch = !addSearch || p.name.toLowerCase().includes(addSearch.toLowerCase()) || (p.code ?? '').toLowerCase().includes(addSearch.toLowerCase());
    return notYet && matchSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-800">{priceList.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {priceList.type === 'pct' ? `Giảm ${priceList.pctDiscount}% từ giá lẻ` : 'Giá cố định'} · {detail?.items.length ?? 0} sản phẩm
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 border-b bg-gray-50">
          <input className="border rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Tìm sản phẩm..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
          {priceList.type === 'fixed' && (
            <button onClick={() => setAddMode(true)}
              className="px-3 py-1.5 text-sm rounded border border-blue-300 text-blue-600 hover:bg-blue-50">
              + Thêm sản phẩm
            </button>
          )}
          <div className="flex-1" />
          {dirtyItemCount > 0 && <span className="text-xs text-amber-600">{dirtyItemCount} ô chưa lưu</span>}
          <button onClick={handleSaveItems} disabled={saving || dirtyItemCount === 0}
            className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!detail ? (
            <p className="text-center py-10 text-gray-400">Đang tải...</p>
          ) : displayItems.length === 0 && priceList.type !== 'pct' ? (
            <p className="text-center py-10 text-gray-400">Chưa có sản phẩm. Nhấn "+ Thêm sản phẩm".</p>
          ) : priceList.type === 'pct' && displayItems.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">Bảng giá % áp dụng cho tất cả sản phẩm — không cần thêm từng sản phẩm.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Mã SP</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Tên sản phẩm</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Giá lẻ gốc</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-700 text-xs">
                    {priceList.type === 'pct' ? 'Giá sau giảm' : 'Giá bảng này'}
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => {
                  const editVal = itemEdits[item.productId];
                  const isDirty = item.productId in itemEdits;
                  const pctPrice = priceList.type === 'pct'
                    ? Math.round(item.sellingPrice * (1 - Number(priceList.pctDiscount) / 100))
                    : null;
                  return (
                    <tr key={item.productId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-1.5 text-gray-500 text-xs font-mono">{item.code}</td>
                      <td className="px-4 py-1.5 font-medium">{item.name}</td>
                      <td className="px-4 py-1.5 text-right text-xs text-gray-400">{fmt(item.sellingPrice)}</td>
                      {priceList.type === 'fixed' ? (
                        <td className="px-2 py-1">
                          <input type="text"
                            className={`w-36 text-right text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-400 ${isDirty ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}
                            value={editVal !== undefined ? editVal : String(item.price)}
                            onChange={(e) => setItemEdits((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                            onBlur={(e) => { const n = parsePriceInput(e.target.value); if (n > 0) setItemEdits((prev) => ({ ...prev, [item.productId]: String(n) })); }}
                          />
                        </td>
                      ) : (
                        <td className="px-4 py-1.5 text-right text-xs font-medium text-green-700">{fmt(pctPrice)}</td>
                      )}
                      <td className="px-2 py-1 text-center">
                        {priceList.type === 'fixed' && (
                          <button onClick={() => handleRemoveItem(item.productId)}
                            className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {addMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-xl w-96 shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Thêm sản phẩm</h4>
              <button onClick={() => { setAddMode(false); setAddSearch(''); }} className="text-gray-400 text-xl">×</button>
            </div>
            <input autoFocus className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Tìm sản phẩm..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {addableProducts.slice(0, 30).map((p) => (
                <button key={p.id} onClick={() => handleAddProduct(p)}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-blue-50 flex justify-between items-center">
                  <span>{p.name}</span>
                  <span className="text-xs text-gray-400">{fmt(p.sellingPrice)}</span>
                </button>
              ))}
              {addableProducts.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Không tìm thấy</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Bảng giá đặt tên ─────────────────────────────────────────────────

function NamedListsTab() {
  const [lists, setLists]         = useState<PriceList[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget]     = useState<PriceList | null>(null);
  const [detailTarget, setDetailTarget] = useState<PriceList | null>(null);
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try { setLists(await getPriceLists()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (pl: PriceList) => {
    if (!confirm(`Xóa bảng giá "${pl.name}"?`)) return;
    try { await deletePriceList(pl.id); setToast({ msg: 'Đã xóa', type: 'success' }); load(); }
    catch (e: any) { setToast({ msg: e.message, type: 'error' }); }
  };

  const handleCopy = async (pl: PriceList) => {
    try { await copyPriceList(pl.id, `${pl.name} (Copy)`); setToast({ msg: 'Đã sao chép', type: 'success' }); load(); }
    catch (e: any) { setToast({ msg: e.message, type: 'error' }); }
  };

  const filtered = lists.filter((pl) => {
    const matchSearch  = !search || pl.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus  = filterStatus === 'all' || (filterStatus === 'active' ? pl.isActive : !pl.isActive);
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showForm && <PriceListFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editTarget && <PriceListFormModal initial={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />}
      {detailTarget && <PriceListDetailModal priceList={detailTarget} onClose={() => setDetailTarget(null)} onRefresh={load} />}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tổng bảng giá',     value: lists.length,                          color: 'from-blue-500 to-blue-600' },
          { label: 'Đang hoạt động',     value: lists.filter((l) => l.isActive).length,  color: 'from-green-500 to-green-600' },
          { label: 'Không hoạt động',    value: lists.filter((l) => !l.isActive).length, color: 'from-gray-400 to-gray-500' },
        ].map((k) => (
          <div key={k.label} className={`bg-gradient-to-r ${k.color} rounded-xl p-4 text-white`}>
            <p className="text-xs opacity-80">{k.label}</p>
            <p className="text-sm font-bold mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input className="border rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Tìm bảng giá..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowForm(true)}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + Tạo bảng giá
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Tên bảng giá</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Loại</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs">Số SP</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Hiệu lực</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs">Trạng thái</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có bảng giá nào</td></tr>
            ) : filtered.map((pl) => (
              <tr key={pl.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <button onClick={() => setDetailTarget(pl)} className="font-medium text-blue-600 hover:underline text-left">{pl.name}</button>
                  {pl.description && <p className="text-xs text-gray-400 mt-0.5">{pl.description}</p>}
                </td>
                <td className="px-4 py-2.5">
                  {pl.type === 'pct' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">Giảm {pl.pctDiscount}%</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Cố định</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center text-gray-600">
                  {pl.type === 'pct' ? <span className="text-xs text-gray-400">Tất cả</span> : pl.productCount}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  {pl.validFrom || pl.validTo ? `${pl.validFrom ?? '∞'} → ${pl.validTo ?? '∞'}` : <span className="text-gray-300">Không giới hạn</span>}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {pl.isActive ? 'Hoạt động' : 'Tắt'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setDetailTarget(pl)} className="text-xs text-blue-600 hover:underline">Chi tiết</button>
                    <button onClick={() => setEditTarget(pl)} className="text-xs text-gray-500 hover:text-gray-700 hover:underline">Sửa</button>
                    <button onClick={() => handleCopy(pl)} className="text-xs text-gray-500 hover:text-gray-700 hover:underline">Copy</button>
                    <button onClick={() => handleDelete(pl)} className="text-xs text-red-500 hover:text-red-700 hover:underline">Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BangGiaPage() {
  const [tab, setTab] = useState<'matrix' | 'named'>('matrix');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Bảng Giá</h1>
        <p className="text-sm text-gray-400 mt-0.5">Thiết lập giá bán theo nhóm khách hàng và bảng giá tùy chỉnh</p>
      </div>

      <div className="flex border-b border-gray-200 gap-1">
        {([
          { key: 'matrix', label: 'Ma Trận Giá Nhóm' },
          { key: 'named',  label: 'Bảng Giá Đặt Tên' },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'matrix' ? <MatrixTab /> : <NamedListsTab />}
    </div>
  );
}

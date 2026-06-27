'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { inventoryApi } from '@/lib/inventory';
import { employeesApi } from '@/lib/employees';
import * as XLSX from 'xlsx';

interface CountItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string | null;
  productUnit: string | null;
  productMainImage: string | null;
  systemQty: number;
  actualQty: number | null;
  reason: string | null;
  itemNotes: string | null;
  dirty?: boolean;
}

interface StockCount {
  id: number; code: string; status: 'counting' | 'balanced';
  notes: string | null; createdAt: string; balancedAt: string | null;
  branch: string | null; checkerId: number | null; countDate: string | null;
  createdBy?: { fullName?: string; username: string } | null;
  balancedBy?: { fullName?: string; username: string } | null;
  checker?: { fullName?: string; username: string } | null;
  items: CountItem[];
}

interface StaffOption { userId: number; fullName: string; }

interface ProductOption {
  id: number; code: string; name: string; unit?: string;
  stockQuantity: number; mainImageUrl?: string | null;
}

type TabKey = 'all' | 'unchecked' | 'match' | 'diff';

const REASONS = ['', 'Hàng hỏng/vỡ', 'Mất hàng', 'Nhập sai số liệu', 'Hàng đang vận chuyển', 'Khác'];

const fmt = (n: number) => Number(n) % 1 === 0
  ? Math.round(Number(n)).toLocaleString('vi-VN')
  : Number(n).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 3 });

const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-1">{label}</p>
      {children}
    </div>
  );
}


export default function StockCountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const countId = Number(id);

  const [sc, setSc]           = useState<StockCount | null>(null);
  const [items, setItems]     = useState<CountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [balancing, setBalancing] = useState(false);
  const [error, setError]     = useState('');

  const [activeTab, setActiveTab]   = useState<TabKey>('all');
  const [itemSearch, setItemSearch] = useState('');

  // Product search
  const [prodSearch, setProdSearch]     = useState('');
  const [prodResults, setProdResults]   = useState<ProductOption[]>([]);
  const [showProdDrop, setShowProdDrop] = useState(false);
  const [adding, setAdding]             = useState(false);
  const prodRef    = useRef<HTMLDivElement>(null);
  const prodDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirm balance
  const [showConfirm, setShowConfirm] = useState(false);

  // Local string state for qty inputs (avoids leading-zero conversion on each keystroke)
  const [qtyInputs, setQtyInputs] = useState<Record<number, string>>({});

  // Editable info fields
  const [notes, setNotes]         = useState('');
  const [branch, setBranch]       = useState('');
  const [checkerId, setCheckerId] = useState<number | null>(null);
  const [countDate, setCountDate] = useState('');
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const savedInfo = useRef({ notes: '', branch: '', checkerId: null as number | null, countDate: '' });

  async function load() {
    setLoading(true);
    try {
      const [data, staff]: [StockCount, StaffOption[]] = await Promise.all([
        inventoryApi.getStockCount(countId),
        employeesApi.getWithAccount().catch(() => []),
      ]);
      setSc(data);
      const loadedItems = (data.items ?? []).map(i => ({ ...i, dirty: false }));
      setItems(loadedItems);
      setQtyInputs(Object.fromEntries(loadedItems.map(i => [i.id, i.actualQty !== null ? Number(i.actualQty).toLocaleString('vi-VN') : ''])));
      setStaffList(staff);
      const n = data.notes ?? ''; const b = data.branch ?? '';
      const c = data.checkerId ?? null;
      const d = data.countDate ? data.countDate.slice(0, 16) : '';
      setNotes(n); setBranch(b); setCheckerId(c); setCountDate(d);
      savedInfo.current = { notes: n, branch: b, checkerId: c, countDate: d };
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function saveInfo(field: 'notes' | 'branch' | 'checkerId' | 'countDate', value: string | number | null) {
    const patch: Record<string, any> = { [field]: value || null };
    try {
      await inventoryApi.updateStockCountInfo(countId, patch);
      savedInfo.current = { ...savedInfo.current, [field]: value } as typeof savedInfo.current;
    } catch {}
  }

  useEffect(() => { load(); }, [countId]);

  // Product search debounce
  useEffect(() => {
    if (prodDebounce.current) clearTimeout(prodDebounce.current);
    if (!prodSearch.trim()) { setProdResults([]); return; }
    prodDebounce.current = setTimeout(async () => {
      try {
        const res = await inventoryApi.getStock({ search: prodSearch, limit: '10', status: 'active' });
        const existing = new Set(items.map(i => i.productId));
        setProdResults((res.data ?? []).filter((p: ProductOption) => !existing.has(p.id)));
      } catch {}
    }, 300);
  }, [prodSearch, items]);

  // Close dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (prodRef.current && !prodRef.current.contains(e.target as Node)) setShowProdDrop(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function updateLocal(itemId: number, field: 'actualQty' | 'reason' | 'itemNotes', value: any) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value, dirty: true } : i));
  }

  async function autoSaveRow(item: CountItem) {
    try {
      await inventoryApi.updateStockCountItems(countId, [{
        itemId: item.id, actualQty: item.actualQty,
        reason: item.reason ?? undefined, itemNotes: item.itemNotes ?? undefined,
      }]);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, dirty: false } : i));
    } catch {}
  }

  async function handleAddProduct(product: ProductOption) {
    setAdding(true); setShowProdDrop(false); setProdSearch('');
    try {
      const newItem: CountItem = await inventoryApi.addStockCountItem(countId, product.id);
      setItems(prev => [...prev, { ...newItem, dirty: false }]);
      setQtyInputs(prev => ({ ...prev, [newItem.id]: newItem.actualQty !== null ? Number(newItem.actualQty).toLocaleString('vi-VN') : '' }));
    } catch (e: any) { alert(e.message); }
    setAdding(false);
  }

  async function handleRemoveItem(item: CountItem) {
    if (!confirm(`Xóa "${item.productName}" khỏi phiếu?`)) return;
    try {
      await inventoryApi.removeStockCountItem(countId, item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: any) { alert(e.message); }
  }

  async function handleSave() {
    const dirty = items.filter(i => i.dirty);
    if (!dirty.length) return;
    setSaving(true);
    try {
      await inventoryApi.updateStockCountItems(countId, dirty.map(i => ({
        itemId: i.id, actualQty: i.actualQty,
        reason: i.reason ?? undefined, itemNotes: i.itemNotes ?? undefined,
      })));
      setItems(prev => prev.map(i => ({ ...i, dirty: false })));
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  }

  async function handleBalance() {
    setShowConfirm(false); setBalancing(true);
    const dirty = items.filter(i => i.dirty);
    if (dirty.length) {
      try {
        await inventoryApi.updateStockCountItems(countId, dirty.map(i => ({
          itemId: i.id, actualQty: i.actualQty,
          reason: i.reason ?? undefined, itemNotes: i.itemNotes ?? undefined,
        })));
      } catch {}
    }
    try {
      await inventoryApi.balanceStockCount(countId);
      await load();
    } catch (e: any) { alert(e.message); }
    setBalancing(false);
  }

  async function handleDelete() {
    if (!confirm('Xóa phiếu kiểm này?')) return;
    try {
      await inventoryApi.deleteStockCount(countId);
      router.push('/dashboard/inventory');
    } catch (e: any) { alert(e.message); }
  }

  function exportExcel() {
    if (!sc) return;

    // Sheet 1: Thông tin phiếu
    const infoRows = [
      ['Mã phiếu',        sc.code],
      ['Trạng thái',      sc.status === 'balanced' ? 'Đã cân bằng' : 'Đang kiểm'],
      ['Chi nhánh kiểm',  sc.branch || '—'],
      ['Nhân viên kiểm',  sc.checker?.fullName ?? sc.checker?.username ?? '—'],
      ['Ngày kiểm',       sc.countDate ? new Date(sc.countDate).toLocaleDateString('vi-VN') : '—'],
      ['Nhân viên tạo',   sc.createdBy?.fullName ?? sc.createdBy?.username ?? '—'],
      ['Ngày tạo',        new Date(sc.createdAt).toLocaleString('vi-VN')],
      ['Nhân viên CB',    sc.balancedBy?.fullName ?? sc.balancedBy?.username ?? '—'],
      ['Ngày cân bằng',   sc.balancedAt ? new Date(sc.balancedAt).toLocaleString('vi-VN') : '—'],
      ['Ghi chú',         sc.notes || ''],
    ];

    // Sheet 2: Danh sách sản phẩm
    const header = ['STT', 'Mã SP', 'Tên sản phẩm', 'Đơn vị', 'Tồn hệ thống', 'Tồn thực tế', 'Lệch', 'Lý do', 'Ghi chú'];
    const dataRows = items.map((item, idx) => {
      const diff = item.actualQty !== null ? Number(item.actualQty) - Number(item.systemQty) : null;
      return [
        idx + 1,
        item.productCode ?? '',
        item.productName,
        item.productUnit ?? '',
        Number(item.systemQty),
        item.actualQty !== null ? Number(item.actualQty) : '',
        diff !== null ? diff : '',
        item.reason ?? '',
        item.itemNotes ?? '',
      ];
    });

    const wb = XLSX.utils.book_new();

    // Sheet thông tin
    const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
    wsInfo['!cols'] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Thông tin');

    // Sheet danh sách SP
    const wsItems = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    wsItems['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 40 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 25 }];
    // In đậm header
    const range = XLSX.utils.decode_range(wsItems['!ref'] ?? 'A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = wsItems[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'E8F0FE' } } };
    }
    XLSX.utils.book_append_sheet(wb, wsItems, 'Danh sách SP');

    XLSX.writeFile(wb, `Kiem-hang-${sc.code}-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
  }

  // Tab filters
  const uncheckedItems = items.filter(i => i.actualQty === null);
  const matchItems     = items.filter(i => i.actualQty !== null && Number(i.actualQty) === Number(i.systemQty));
  const diffItems      = items.filter(i => i.actualQty !== null && Number(i.actualQty) !== Number(i.systemQty));

  const tabItems = activeTab === 'unchecked' ? uncheckedItems
    : activeTab === 'match' ? matchItems
    : activeTab === 'diff'  ? diffItems
    : items;

  const filteredItems = itemSearch
    ? tabItems.filter(i => i.productName.toLowerCase().includes(itemSearch.toLowerCase()) || (i.productCode ?? '').toLowerCase().includes(itemSearch.toLowerCase()))
    : tabItems;

  const isBalanced = sc?.status === 'balanced';
  const dirtyCount = items.filter(i => i.dirty).length;
  const totalDiff  = diffItems.reduce((s, i) => s + (Number(i.actualQty) - Number(i.systemQty)), 0);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Đang tải...</p></div>;
  if (error || !sc) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-400">{error || 'Không tìm thấy phiếu kiểm'}</p></div>;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <Link href="/dashboard/inventory" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Danh sách kiểm hàng
          </Link>
          <span className="text-gray-200">/</span>
          <span className="font-bold text-gray-800 font-mono text-lg">{sc.code}</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isBalanced ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
            {isBalanced ? 'Đã cân bằng' : 'Đang kiểm'}
          </span>

          <div className="ml-auto flex gap-2">
            {/* Xuất file — luôn hiện khi có dữ liệu */}
            {items.length > 0 && (
              <button onClick={exportExcel}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Xuất file
              </button>
            )}
            {!isBalanced && (<>
              <button onClick={() => router.push('/dashboard/inventory/stock-counts')}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                Thoát
              </button>
              <button onClick={() => setShowConfirm(true)} disabled={balancing || items.length === 0}
                className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition shadow-sm disabled:opacity-40">
                {balancing ? 'Đang xử lý...' : 'Cân bằng kho'}
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-red-500 border border-red-100 rounded-xl hover:bg-red-50 transition">
                Xóa phiếu
              </button>
            </>)}
            {isBalanced && (
              <button onClick={() => router.push('/dashboard/inventory/stock-counts')}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                ← Quay lại
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-4">

        {/* Info section */}
        <div className="grid grid-cols-5 gap-3">

          {/* Card trái 3/5 */}
          <div className="col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Field label="Chi nhánh kiểm">
                {isBalanced
                  ? <p className="text-sm text-gray-800">{sc.branch || '—'}</p>
                  : <input value={branch} onChange={e => setBranch(e.target.value)}
                      onBlur={() => saveInfo('branch', branch)}
                      placeholder="VD: Cửa hàng chính..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-gray-700 placeholder-gray-300" />
                }
              </Field>
              <Field label="Nhân viên kiểm">
                {isBalanced
                  ? <p className="text-sm text-gray-800">{sc.checker?.fullName ?? sc.checker?.username ?? '—'}</p>
                  : <div className="relative">
                      <select value={checkerId ?? ''} onChange={e => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          setCheckerId(v); saveInfo('checkerId', v);
                        }}
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-700 appearance-none pr-7">
                        <option value="">— Chọn nhân viên —</option>
                        {staffList.map(s => <option key={s.userId} value={s.userId}>{s.fullName}</option>)}
                      </select>
                      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </div>
                }
              </Field>
              <Field label="Ngày kiểm">
                {isBalanced
                  ? <p className="text-sm text-gray-800">{countDate ? new Date(countDate).toLocaleDateString('vi-VN') : '—'}</p>
                  : <input type="date" value={countDate ? countDate.slice(0,10) : ''}
                      onChange={e => { const v = e.target.value; setCountDate(v); saveInfo('countDate', v); }}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-gray-700" />
                }
              </Field>
              <Field label="Mã phiếu">
                <p className="text-sm font-mono font-semibold text-blue-700">{sc.code}</p>
              </Field>
            </div>

            {/* Metadata row */}
            <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex gap-6">
              {[
                { label: 'NV tạo',    value: sc.createdBy?.fullName ?? sc.createdBy?.username ?? '—' },
                { label: 'Ngày tạo',  value: fmtDate(sc.createdAt) },
                { label: 'NV CB',     value: sc.balancedBy?.fullName ?? sc.balancedBy?.username ?? '—' },
                { label: 'Ngày CB',   value: sc.balancedAt ? fmtDate(sc.balancedAt) : '—' },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">{m.label}:</span>
                  <span className="text-xs text-gray-700">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card phải 2/5: KPI hàng ngang + Ghi chú */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-2.5">

            {/* KPI hàng ngang */}
            <div className="flex gap-2">
              {[
                { label: 'Tổng SP',    value: items.length,                         color: 'text-gray-800',  bg: 'bg-gray-50'   },
                { label: 'Đã kiểm',   value: items.length - uncheckedItems.length,  color: 'text-blue-600',  bg: 'bg-blue-50'   },
                { label: 'Chưa kiểm', value: uncheckedItems.length,                color: 'text-amber-500', bg: 'bg-amber-50'  },
                { label: 'Lệch',      value: diffItems.length,                     color: diffItems.length > 0 ? 'text-red-500' : 'text-green-600', bg: diffItems.length > 0 ? 'bg-red-50' : 'bg-green-50' },
              ].map(k => (
                <div key={k.label} className={`flex-1 ${k.bg} rounded-xl py-2 text-center`}>
                  <p className={`text-lg font-bold leading-none ${k.color}`}>{k.value}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{k.label}</p>
                </div>
              ))}
            </div>
            {diffItems.length > 0 && (
              <p className="text-center text-xs text-gray-500 -mt-1">
                Tổng lệch: <span className={`font-semibold ${totalDiff > 0 ? 'text-green-600' : 'text-red-500'}`}>{totalDiff > 0 ? '+' : ''}{fmt(totalDiff)}</span>
              </p>
            )}

            {/* Ghi chú */}
            <div className="flex-1 flex flex-col">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Ghi chú</p>
              {isBalanced
                ? <p className="text-sm text-gray-700">{sc.notes || '—'}</p>
                : <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    onBlur={() => saveInfo('notes', notes)}
                    rows={3}
                    placeholder="VD: Kiểm hàng định kỳ tháng 6..."
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-gray-700 placeholder-gray-300 resize-none" />
              }
            </div>

          </div>

        </div>

        {/* Add product */}
        {!isBalanced && (
          <div ref={prodRef} className="relative">
            <div className={`flex items-center gap-3 bg-white rounded-2xl border shadow-sm px-4 py-3 transition ${showProdDrop ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'}`}>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={prodSearch}
                onChange={e => { setProdSearch(e.target.value); setShowProdDrop(true); }}
                onFocus={() => setShowProdDrop(true)}
                placeholder="Tìm sản phẩm để thêm vào phiếu kiểm (tên hoặc mã SP)..."
                className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400" />
              {adding && <span className="text-xs text-blue-400 flex-shrink-0">Đang thêm...</span>}
              {prodSearch && <button onClick={() => { setProdSearch(''); setProdResults([]); }}
                className="text-gray-300 hover:text-gray-500 transition flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>}
            </div>
            {showProdDrop && prodResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                {prodResults.map(p => (
                  <button key={p.id} onMouseDown={() => handleAddProduct(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition">
                    {p.mainImageUrl
                      ? <img src={p.mainImageUrl} alt="" className="w-9 h-9 object-cover rounded-lg border border-gray-100 flex-shrink-0" />
                      : <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-600 flex-shrink-0">{fmt(p.stockQuantity)}{p.unit ? ` ${p.unit}` : ''}</span>
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showProdDrop && prodSearch && prodResults.length === 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 px-4 py-6 text-center text-sm text-gray-400">
                Không tìm thấy sản phẩm hoặc đã có trong phiếu
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1">
              {([
                ['all',       `Tất cả (${items.length})`],
                ['unchecked', `Chưa kiểm (${uncheckedItems.length})`],
                ['match',     `Khớp (${matchItems.length})`],
                ['diff',      `Lệch (${diffItems.length})`],
              ] as [TabKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    activeTab === key
                      ? key === 'diff' ? 'bg-red-500 text-white' : key === 'match' ? 'bg-green-600 text-white' : key === 'unchecked' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                placeholder="Lọc trong danh sách..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 w-52" />
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-sm">{items.length === 0 ? 'Chưa có sản phẩm. Tìm và thêm từ ô bên trên.' : 'Không có sản phẩm nào trong tab này.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-400 w-10">STT</th>
                    <th className="px-3 py-3 w-10"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sản phẩm</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-16">ĐVT</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Tồn HT</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Tồn thực tế</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Lệch</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">Lý do</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ghi chú</th>
                    {!isBalanced && <th className="px-3 py-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.map((item, idx) => {
                    const diff      = item.actualQty !== null ? Number(item.actualQty) - Number(item.systemQty) : null;
                    const isChecked = item.actualQty !== null;
                    return (
                      <tr key={item.id} className={`transition ${item.dirty ? 'bg-yellow-50/50' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-3 py-3 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2">
                          {item.productMainImage
                            ? <img src={item.productMainImage} alt="" className="w-9 h-9 object-cover rounded-lg border border-gray-100" />
                            : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{item.productName}</p>
                          {item.productCode && <p className="text-[11px] text-gray-400 font-mono">{item.productCode}</p>}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-gray-500">{item.productUnit ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">{fmt(item.systemQty)}</td>
                        <td className="px-4 py-3 text-right">
                          {isBalanced
                            ? <span className={`font-bold ${!isChecked ? 'text-gray-300 text-xs italic' : 'text-gray-800'}`}>{isChecked ? fmt(item.actualQty!) : 'Chưa kiểm'}</span>
                            : <input type="text" inputMode="numeric"
                                value={qtyInputs[item.id] ?? ''}
                                onChange={e => {
                                  // Chỉ cho phép chữ số khi đang gõ
                                  const digits = e.target.value.replace(/[^0-9]/g, '');
                                  setQtyInputs(prev => ({ ...prev, [item.id]: digits }));
                                }}
                                onFocus={e => {
                                  // Bỏ dấu chấm để gõ dễ hơn
                                  const raw = (qtyInputs[item.id] ?? '').replace(/\./g, '');
                                  setQtyInputs(prev => ({ ...prev, [item.id]: raw }));
                                  setTimeout(() => e.target.select(), 0);
                                }}
                                onBlur={e => {
                                  const raw = e.target.value.replace(/[^0-9]/g, '');
                                  const num = raw === '' ? null : parseInt(raw, 10);
                                  const formatted = num !== null ? num.toLocaleString('vi-VN') : '';
                                  setQtyInputs(prev => ({ ...prev, [item.id]: formatted }));
                                  const updated = { ...item, actualQty: num, dirty: true };
                                  updateLocal(item.id, 'actualQty', num);
                                  autoSaveRow(updated);
                                }}
                                placeholder="Nhập..."
                                className={`w-24 text-right text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 ${isChecked ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50/50'}`} />
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          {diff !== null
                            ? <span className={`font-bold text-sm ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{fmt(diff)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isBalanced
                            ? <span className="text-sm text-gray-600">{item.reason || '—'}</span>
                            : <select value={item.reason ?? ''} onChange={e => updateLocal(item.id, 'reason', e.target.value || null)}
                                disabled={!isChecked}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed w-full max-w-[170px]">
                                {REASONS.map(r => <option key={r} value={r}>{r || '—'}</option>)}
                              </select>}
                        </td>
                        <td className="px-4 py-3">
                          {isBalanced
                            ? <span className="text-sm text-gray-500">{item.itemNotes || '—'}</span>
                            : <input type="text" value={item.itemNotes ?? ''}
                                onChange={e => updateLocal(item.id, 'itemNotes', e.target.value || null)}
                                placeholder="Ghi chú..."
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-100 w-full min-w-[120px]" />}
                        </td>
                        {!isBalanced && (
                          <td className="px-3 py-3">
                            <button onClick={() => handleRemoveItem(item)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirm balance dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-base font-bold text-gray-800">Xác nhận cân bằng kho</h2>
              <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                <p>Đã kiểm: <span className="font-semibold text-blue-600">{items.length - uncheckedItems.length}/{items.length} sản phẩm</span></p>
                <p>Số sản phẩm lệch: <span className="font-semibold text-red-500">{diffItems.length}</span></p>
                {uncheckedItems.length > 0 && (
                  <p className="mt-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs">
                    ⚠️ Còn {uncheckedItems.length} sản phẩm chưa kiểm — tồn kho sẽ không thay đổi với các sản phẩm này.
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Hủy</button>
              <button onClick={handleBalance}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition">Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

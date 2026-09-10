'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { inventoryApi } from '@/lib/inventory';

interface StockItem {
  id: number; code: string; name: string; unit?: string;
  brand?: string; category?: string; barcode?: string;
  stockQuantity: number; lowStockThreshold?: number;
  sellingPrice?: number;
  warehouseLocation?: string; mainImageUrl?: string | null;
  isActive?: boolean;
}
interface Movement {
  id: number; type: string; quantity: number;
  stockBefore: number; stockAfter: number;
  referenceId?: number; referenceType?: string;
  notes?: string; createdAt: string;
  product?: { id: number; code: string; name: string; unit?: string };
  performedBy?: { id: number; fullName?: string; username: string } | null;
}
interface Stats {
  totalActive: number; outOfStock: number; lowStock: number; inventoryValue: number;
}

const TYPE_LABEL: Record<string, string> = {
  purchase_in: 'Nhập mua', sale_out: 'Xuất bán', manual_in: 'Nhập thủ công',
  manual_out: 'Xuất thủ công', return_in: 'Nhập trả hàng', adjustment: 'Điều chỉnh',
};
const TYPE_COLOR: Record<string, string> = {
  purchase_in: 'bg-green-100 text-green-700', sale_out: 'bg-red-100 text-red-600',
  manual_in: 'bg-blue-100 text-blue-700', manual_out: 'bg-orange-100 text-orange-600',
  return_in: 'bg-teal-100 text-teal-700', adjustment: 'bg-purple-100 text-purple-700',
};
// Columns for stock tab
type ColKey = 'threshold' | 'sellingPrice' | 'location' | 'category' | 'brand' | 'barcode' | 'status';
const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: 'threshold',    label: 'Mức cảnh báo' },
  { key: 'sellingPrice', label: 'Giá bán' },
  { key: 'location',     label: 'Vị trí kho' },
  { key: 'category',     label: 'Danh mục' },
  { key: 'brand',        label: 'Nhãn hiệu' },
  { key: 'barcode',      label: 'Mã vạch' },
  { key: 'status',       label: 'Tình trạng' },
];

function loadSavedCols(): Record<ColKey, boolean> {
  const def: Record<ColKey, boolean> = { threshold: true, sellingPrice: true, location: true, category: false, brand: false, barcode: false, status: false };
  try {
    const saved = localStorage.getItem('inventory_cols');
    if (saved) return { ...def, ...JSON.parse(saved) };
  } catch {}
  return def;
}

const fmt    = (n: number) => Math.round(Number(n)).toLocaleString('vi-VN');
const fmtDec = (n: number) => Number(n) % 1 === 0 ? fmt(n) : Number(n).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN');

export default function InventoryPage() {
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');

  // ── Column visibility ──
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(() => loadSavedCols());
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // ── Stock tab ──
  const [stockData, setStockData]     = useState<StockItem[]>([]);
  const [stockStats, setStockStats]   = useState<Stats | null>(null);
  const [stockTotal, setStockTotal]   = useState(0);
  const [stockPage, setStockPage]     = useState(1);
  const [stockLimit, setStockLimit]   = useState(30);
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilter, setStockFilter] = useState(''); // low | out
  const [filterBrand, setFilterBrand]     = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus]   = useState('active');
  const [stockLoading, setStockLoading] = useState(true);
  const [sortBy, setSortBy]   = useState('name');
  const [sortDir, setSortDir] = useState<'ASC'|'DESC'>('ASC');
  const [brands, setBrands]       = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  // ── Movements tab ──
  const [movements, setMovements]       = useState<Movement[]>([]);
  const [movTotal, setMovTotal]         = useState(0);
  const [movPage, setMovPage]           = useState(1);
  const [movTypeFilter, setMovTypeFilter] = useState('');
  const [movLoading, setMovLoading]     = useState(false);


  // ── Bulk selection ──
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);

  function toggleSelect(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (selected.size === stockData.length) setSelected(new Set());
    else setSelected(new Set(stockData.map(i => i.id)));
  }

  // ── Manual in/out modal ──
  const [showModal, setShowModal]   = useState(false);
  const [modalType, setModalType]   = useState<'manual_in' | 'manual_out' | 'adjustment'>('manual_in');
  const [mProductSearch, setMProductSearch] = useState('');
  const [mProductResults, setMProductResults] = useState<StockItem[]>([]);
  const [mProduct, setMProduct]     = useState<StockItem | null>(null);
  const [mQty, setMQty]             = useState('');
  const [mNotes, setMNotes]         = useState('');
  const [mSaving, setMSaving]       = useState(false);
  const [mError, setMError]         = useState('');
  const [showMDrop, setShowMDrop]   = useState(false);
  const mDropRef = useRef<HTMLDivElement>(null);
  const mDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Location combobox ──
  const [locSearch, setLocSearch]     = useState('');
  const [showLocDrop, setShowLocDrop] = useState(false);
  const locRef = useRef<HTMLDivElement>(null);

  // ── Load functions ──
  async function loadStock(
    page = 1,
    search = stockSearch,
    filter = stockFilter,
    brand = filterBrand,
    location = filterLocation,
    status = filterStatus,
    limit = stockLimit,
    sb = sortBy,
    sd = sortDir,
  ) {
    setStockLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit), sortBy: sb, sortDir: sd };
      if (search)            params.search     = search;
      if (filter === 'low')  params.lowStock   = 'true';
      if (filter === 'out')  params.outOfStock = 'true';
      if (brand)             params.brand      = brand;
      if (location)          params.location   = location;
      if (status)            params.status     = status;
      const res = await inventoryApi.getStock(params);
      setStockData(res.data ?? []);
      setStockTotal(res.total ?? 0);
      setStockPage(page);
      if (res.stats) setStockStats(res.stats);
    } catch {}
    setStockLoading(false);
  }

  async function loadMovements(page = 1, type = movTypeFilter) {
    setMovLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '30' };
      if (type) params.type = type;
      const res = await inventoryApi.getMovements(params);
      setMovements(res.data ?? []);
      setMovTotal(res.total ?? 0);
      setMovPage(page);
    } catch {}
    setMovLoading(false);
  }

  useEffect(() => {
    loadStock();
    inventoryApi.getFilterOptions().then(r => {
      setBrands(r.brands ?? []);
      setLocations(r.locations ?? []);
    }).catch(() => {});
  }, []);
  useEffect(() => { if (tab === 'movements') loadMovements(); }, [tab]);

  useEffect(() => {
    const t = setTimeout(() => { loadStock(1, stockSearch, stockFilter, filterBrand, filterLocation, filterStatus, stockLimit); }, 300);
    return () => clearTimeout(t);
  }, [stockSearch]);

  // Modal product search
  useEffect(() => {
    if (mDebounce.current) clearTimeout(mDebounce.current);
    if (!mProductSearch.trim()) { setMProductResults([]); return; }
    mDebounce.current = setTimeout(async () => {
      const res = await inventoryApi.getStock({ search: mProductSearch, limit: '8' });
      setMProductResults(res.data ?? []);
    }, 300);
  }, [mProductSearch]);

  // Close dropdowns on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (mDropRef.current && !mDropRef.current.contains(e.target as Node)) setShowMDrop(false);
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) setShowBulkMenu(false);
      if (locRef.current && !locRef.current.contains(e.target as Node)) setShowLocDrop(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Column toggle ──
  function toggleCol(key: ColKey) {
    const next = { ...visibleCols, [key]: !visibleCols[key] };
    setVisibleCols(next);
    localStorage.setItem('inventory_cols', JSON.stringify(next));
  }
  function resetCols() {
    const def: Record<ColKey, boolean> = { threshold: true, sellingPrice: true, location: true, category: false, brand: false, barcode: false, status: false };
    setVisibleCols(def);
    localStorage.setItem('inventory_cols', JSON.stringify(def));
  }

  // ── Manual movement ──
  async function handleSaveMovement() {
    if (!mProduct) { setMError('Chọn sản phẩm'); return; }
    const qty = parseFloat(mQty);
    if (!qty || qty <= 0) { setMError('Nhập số lượng hợp lệ'); return; }
    setMSaving(true); setMError('');
    try {
      await inventoryApi.createMovement({ productId: mProduct.id, type: modalType, quantity: qty, notes: mNotes || undefined });
      setShowModal(false); setMProduct(null); setMProductSearch(''); setMQty(''); setMNotes('');
      loadStock(stockPage);
      if (tab === 'movements') loadMovements(movPage);
    } catch (e: any) { setMError(e.message); }
    setMSaving(false);
  }

  function openModal(type: typeof modalType, product?: StockItem) {
    setModalType(type);
    setMProduct(product ?? null);
    setMProductSearch(product?.name ?? '');
    setMQty(''); setMNotes(''); setMError(''); setShowModal(true);
  }

  // ── Create stock count ──
  const stockPages  = Math.ceil(stockTotal / stockLimit);
  const movPages    = Math.ceil(movTotal / 30);

  function handleSort(col: string) {
    const newDir = sortBy === col && sortDir === 'ASC' ? 'DESC' : 'ASC';
    setSortBy(col); setSortDir(newDir);
    loadStock(1, stockSearch, stockFilter, filterBrand, filterLocation, filterStatus, stockLimit, col, newDir);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1 text-blue-500">{sortDir === 'ASC' ? '↑' : '↓'}</span>;
  }

  function stockPageNums(current: number, total: number) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  const GearIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-6 py-2.5 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-800 text-lg">Quản lý Kho</h1>
          <p className="text-xs text-gray-400 mt-0.5">Theo dõi tồn kho và biến động hàng hóa</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openModal('manual_out')}
            className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-xl hover:bg-orange-50 transition">
            Xuất kho
          </button>
          <button onClick={() => openModal('manual_in')}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl transition shadow-sm">
            + Nhập kho
          </button>
          <button onClick={() => openModal('adjustment')}
            className="px-4 py-2 text-sm font-medium text-purple-600 border border-purple-200 rounded-xl hover:bg-purple-50 transition">
            Điều chỉnh
          </button>
          <a href="/dashboard/inventory/stock-counts"
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition">
            Kiểm hàng
          </a>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto space-y-3">

        {/* ── KPI bar ── */}
        {stockStats && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Tổng mặt hàng',   value: stockStats.totalActive,              color: 'text-blue-600',  bg: 'bg-blue-50',   icon: '📦' },
              { label: 'Hàng sắp hết',    value: `${stockStats.lowStock} SP`,          color: 'text-amber-600', bg: 'bg-amber-50',  icon: '⚠️' },
              { label: 'Hết hàng',        value: `${stockStats.outOfStock} SP`,        color: 'text-red-600',   bg: 'bg-red-50',    icon: '🚫' },
              { label: 'Giá trị tồn kho', value: `${fmt(stockStats.inventoryValue)}đ`, color: 'text-green-600', bg: 'bg-green-50',  icon: '💰' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center text-lg flex-shrink-0`}>{k.icon}</div>
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium">{k.label}</p>
                    <p className={`text-sm font-bold ${k.color}`}>{k.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {([['stock','Tồn kho'],['movements','Biến động']] as const).map(([t,l]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-6 py-3.5 text-sm font-semibold transition border-b-2 -mb-px ${
                  tab === t ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}>
                {l}
              </button>
            ))}
          </div>

          {/* ── Tồn kho tab ── */}
          {tab === 'stock' && (
            <div>
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                {/* Gear icon — bên trái */}
                <div className="relative" ref={colMenuRef}>
                  <button onClick={() => setShowColMenu(v => !v)} title="Tùy chỉnh cột hiển thị"
                    className={`w-8 h-8 flex items-center justify-center border rounded-lg transition ${
                      showColMenu ? 'border-blue-300 bg-blue-50 text-blue-500' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }`}>
                    <GearIcon />
                  </button>
                  {showColMenu && (
                    <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-52 py-2">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase px-3 pb-1.5 tracking-wider">Cột hiển thị</p>
                      {ALL_COLS.map(c => (
                        <label key={c.key} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={visibleCols[c.key]} onChange={() => toggleCol(c.key)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-200" />
                          <span className="text-sm text-gray-700">{c.label}</span>
                        </label>
                      ))}
                      <div className="border-t border-gray-100 mt-1 pt-1 px-3">
                        <button onClick={resetCols} className="text-xs text-blue-500 hover:text-blue-700 py-1">Đặt lại mặc định</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative flex-1 max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={stockSearch} onChange={e => setStockSearch(e.target.value)}
                    placeholder="Tìm theo tên, mã, mã vạch..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="flex gap-1.5">
                  {([['','Tất cả'],['low','Sắp hết'],['out','Hết hàng']] as const).map(([v,l]) => (
                    <button key={v} onClick={() => { setStockFilter(v); loadStock(1, stockSearch, v, filterBrand, filterLocation, filterStatus, stockLimit); }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                        stockFilter === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
                {/* Filter dropdowns */}
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); loadStock(1, stockSearch, stockFilter, filterBrand, filterLocation, e.target.value, stockLimit); }}
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none bg-white text-gray-600">
                  <option value="active">Còn kinh doanh</option>
                  <option value="inactive">Ngừng kinh doanh</option>
                  <option value="all">Tất cả trạng thái</option>
                </select>
                {brands.length > 0 && (
                  <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); loadStock(1, stockSearch, stockFilter, e.target.value, filterLocation, filterStatus, stockLimit); }}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none bg-white text-gray-600">
                    <option value="">Tất cả nhãn hiệu</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
                {/* Location combobox */}
                <div className="relative" ref={locRef}>
                  <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-2 bg-white text-sm transition cursor-text ${
                    showLocDrop ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'
                  }`} onClick={() => { setShowLocDrop(true); }}>
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {showLocDrop ? (
                      <input
                        autoFocus
                        value={locSearch}
                        onChange={e => setLocSearch(e.target.value)}
                        placeholder="Tìm vị trí..."
                        className="outline-none bg-transparent text-sm text-gray-700 w-28 min-w-0"
                      />
                    ) : (
                      <span className={`text-sm ${filterLocation ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                        {filterLocation || 'Vị trí kho'}
                      </span>
                    )}
                    {filterLocation && !showLocDrop && (
                      <button onClick={e => { e.stopPropagation(); setFilterLocation(''); setLocSearch(''); loadStock(1, stockSearch, stockFilter, filterBrand, '', filterStatus, stockLimit); }}
                        className="ml-1 text-gray-400 hover:text-red-400 transition flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {showLocDrop && (
                    <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-52 max-h-60 overflow-y-auto py-1">
                      {/* Tất cả */}
                      <button
                        onMouseDown={() => { setFilterLocation(''); setLocSearch(''); setShowLocDrop(false); loadStock(1, stockSearch, stockFilter, filterBrand, '', filterStatus, stockLimit); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                          !filterLocation ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                        }`}>
                        <span className="w-4 h-4 flex-shrink-0">{!filterLocation && '✓'}</span>
                        Tất cả vị trí
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      {locations
                        .filter(l => !locSearch || l.toLowerCase().includes(locSearch.toLowerCase()))
                        .map(loc => (
                          <button key={loc}
                            onMouseDown={() => { setFilterLocation(loc); setLocSearch(''); setShowLocDrop(false); loadStock(1, stockSearch, stockFilter, filterBrand, loc, filterStatus, stockLimit); }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2 ${
                              filterLocation === loc ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                            }`}>
                            <span className="w-4 h-4 flex-shrink-0 text-blue-500">{filterLocation === loc && '✓'}</span>
                            {loc}
                          </button>
                        ))}
                      {locations.filter(l => !locSearch || l.toLowerCase().includes(locSearch.toLowerCase())).length === 0 && (
                        <p className="px-4 py-3 text-xs text-gray-400 text-center">Không tìm thấy vị trí</p>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-400 ml-auto">{stockTotal} sản phẩm</span>
              </div>

              {/* Bulk action bar */}
              {selected.size > 0 && (
                <div className="px-5 py-2.5 border-b border-blue-100 bg-blue-50 flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-700">Đã chọn {selected.size} sản phẩm</span>
                  <div className="relative" ref={bulkMenuRef}>
                    <button onClick={() => setShowBulkMenu(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-300 rounded-lg bg-white hover:bg-blue-50 transition">
                      Chọn thao tác
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showBulkMenu && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-44 py-1">
                        <button onMouseDown={() => { const items = stockData.filter(i => selected.has(i.id)); openModal('manual_in'); setShowBulkMenu(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                          Nhập kho
                        </button>
                        <button onMouseDown={() => { openModal('manual_out'); setShowBulkMenu(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition">
                          Xuất kho
                        </button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-blue-500 hover:text-blue-700">Bỏ chọn</button>
                </div>
              )}

              {stockLoading ? (
                <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
              ) : stockData.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">Không có dữ liệu tồn kho</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="pl-4 pr-2 py-3 w-8">
                          <input type="checkbox"
                            checked={stockData.length > 0 && selected.size === stockData.length}
                            onChange={toggleAll}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-200" />
                        </th>
                        <th className="px-2 py-3 w-10"></th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-blue-600 transition"
                          onClick={() => handleSort('name')}>
                          Sản phẩm<SortIcon col="name" />
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-blue-600 transition"
                          onClick={() => handleSort('stockQuantity')}>
                          Tồn kho<SortIcon col="stockQuantity" />
                        </th>
                        {visibleCols.threshold    && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Mức cảnh báo</th>}
                        {visibleCols.sellingPrice && (
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-blue-600 transition"
                            onClick={() => handleSort('sellingPrice')}>
                            Giá bán<SortIcon col="sellingPrice" />
                          </th>
                        )}
                        {visibleCols.location     && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vị trí kho</th>}
                        {visibleCols.category     && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Danh mục</th>}
                        {visibleCols.brand        && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nhãn hiệu</th>}
                        {visibleCols.barcode      && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã vạch</th>}
                        {visibleCols.status       && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tình trạng</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stockData.map((item) => {
                        const qty = Number(item.stockQuantity);
                        const threshold = item.lowStockThreshold ? Number(item.lowStockThreshold) : null;
                        const isOut = qty <= 0;
                        const isLow = !isOut && threshold !== null && qty <= threshold;
                        const isSel = selected.has(item.id);
                        return (
                          <tr key={item.id} className={`transition ${isSel ? 'bg-blue-50/60' : 'hover:bg-gray-50/50'}`}>
                            <td className="pl-4 pr-2 py-3">
                              <input type="checkbox" checked={isSel} onChange={() => toggleSelect(item.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-200" />
                            </td>
                            <td className="px-2 py-3">
                              {item.mainImageUrl ? (
                                <img src={item.mainImageUrl} alt="" className="w-9 h-9 object-cover rounded-lg border border-gray-100" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/dashboard/products/${item.id}`}
                                className="font-medium text-gray-800 hover:text-blue-600 hover:underline transition-colors">
                                {item.name}
                              </Link>
                              <p className="text-[11px] text-gray-400 font-mono">{item.code}</p>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className={`font-bold text-sm ${isOut ? 'text-red-500' : isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                                {fmtDec(qty)}
                              </span>
                              {item.unit && <span className="text-xs text-gray-400 ml-1">{item.unit}</span>}
                              {isOut && <span className="ml-1.5 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Hết</span>}
                              {isLow && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">Sắp hết</span>}
                            </td>
                            {visibleCols.threshold && (
                              <td className="px-4 py-3 text-right text-sm text-gray-500">
                                {threshold !== null ? fmtDec(threshold) : '—'}
                              </td>
                            )}
                            {visibleCols.sellingPrice && (
                              <td className="px-4 py-3 text-right text-sm text-gray-700 font-medium">
                                {item.sellingPrice ? `${fmt(Number(item.sellingPrice))}đ` : '—'}
                              </td>
                            )}
                            {visibleCols.location && (
                              <td className="px-4 py-3 text-sm text-gray-500">{item.warehouseLocation ?? '—'}</td>
                            )}
                            {visibleCols.category && (
                              <td className="px-4 py-3 text-sm text-gray-500">{item.category ?? '—'}</td>
                            )}
                            {visibleCols.brand && (
                              <td className="px-4 py-3 text-sm text-gray-500">{item.brand ?? '—'}</td>
                            )}
                            {visibleCols.barcode && (
                              <td className="px-4 py-3">
                                {item.barcode
                                  ? <span className="font-mono text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{item.barcode}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                            )}
                            {visibleCols.status && (
                              <td className="px-4 py-3">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {item.isActive ? 'Còn KD' : 'Ngừng KD'}
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* ── Pagination bar ── */}
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4 flex-wrap">
                    {/* Items per page */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>Hiển thị</span>
                      <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        {[20, 50, 100].map(n => (
                          <button key={n} onClick={() => { setStockLimit(n); loadStock(1, stockSearch, stockFilter, filterBrand, filterLocation, filterStatus, n); }}
                            className={`px-2.5 py-1 text-xs font-medium transition ${
                              stockLimit === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <span>/ trang</span>
                    </div>
                    {/* Summary */}
                    <span className="text-xs text-gray-400">
                      {stockTotal > 0 ? `${(stockPage - 1) * stockLimit + 1}–${Math.min(stockPage * stockLimit, stockTotal)} / ${stockTotal} sản phẩm` : '0 sản phẩm'}
                    </span>
                    {/* Page numbers */}
                    {stockPages > 1 && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => loadStock(1)} disabled={stockPage <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-sm">«</button>
                        <button onClick={() => loadStock(stockPage - 1)} disabled={stockPage <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-sm">‹</button>
                        {stockPageNums(stockPage, stockPages).map((p, i) =>
                          p === '...' ? (
                            <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-gray-400 text-xs">…</span>
                          ) : (
                            <button key={p} onClick={() => loadStock(Number(p))}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${
                                stockPage === p ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                              }`}>
                              {p}
                            </button>
                          )
                        )}
                        <button onClick={() => loadStock(stockPage + 1)} disabled={stockPage >= stockPages}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-sm">›</button>
                        <button onClick={() => loadStock(stockPages)} disabled={stockPage >= stockPages}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-sm">»</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Biến động tab ── */}
          {tab === 'movements' && (
            <div>
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                <select value={movTypeFilter} onChange={e => { setMovTypeFilter(e.target.value); loadMovements(1, e.target.value); }}
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none bg-white">
                  <option value="">Tất cả loại</option>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span className="text-xs text-gray-400 ml-auto">{movTotal} biến động</span>
              </div>

              {movLoading ? (
                <div className="py-16 text-center text-gray-400 text-sm">Đang tải...</div>
              ) : movements.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">Chưa có biến động nào</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Thời gian</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sản phẩm</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Loại</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Số lượng</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tồn trước</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tồn sau</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tham chiếu</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {movements.map(m => {
                        const isIn = Number(m.quantity) > 0;
                        const d = new Date(m.createdAt);
                        return (
                          <tr key={m.id} className="hover:bg-gray-50/50 transition">
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              <p>{d.toLocaleDateString('vi-VN')}</p>
                              <p className="text-gray-400">{d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">{m.product?.name ?? '—'}</p>
                              <p className="text-[11px] text-gray-400 font-mono">{m.product?.code}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[m.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                {TYPE_LABEL[m.type] ?? m.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                              <span className={isIn ? 'text-green-600' : 'text-red-500'}>
                                {isIn ? '+' : ''}{fmtDec(Number(m.quantity))}
                              </span>
                              {m.product?.unit && <span className="text-xs text-gray-400 ml-1">{m.product.unit}</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-500">{fmtDec(Number(m.stockBefore))}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-800">{fmtDec(Number(m.stockAfter))}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {m.referenceType === 'stock_count' ? (
                                <Link href={`/dashboard/inventory/stock-counts/${m.referenceId}`} className="text-blue-500 hover:text-blue-700 font-medium">
                                  Kiểm #{m.referenceId}
                                </Link>
                              ) : m.referenceType === 'manual' ? (
                                <span className="text-gray-400">Thủ công</span>
                              ) : m.referenceId ? `#${m.referenceId}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{m.notes ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {movPages > 1 && (
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4">
                      <span className="text-xs text-gray-400">
                        {(movPage - 1) * 30 + 1}–{Math.min(movPage * 30, movTotal)} / {movTotal} biến động
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => loadMovements(1)} disabled={movPage <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-sm">«</button>
                        <button onClick={() => loadMovements(movPage - 1)} disabled={movPage <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-sm">‹</button>
                        {stockPageNums(movPage, movPages).map((p, i) =>
                          p === '...' ? (
                            <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-gray-400 text-xs">…</span>
                          ) : (
                            <button key={p} onClick={() => loadMovements(Number(p))}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${
                                movPage === p ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                              }`}>
                              {p}
                            </button>
                          )
                        )}
                        <button onClick={() => loadMovements(movPage + 1)} disabled={movPage >= movPages}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-sm">›</button>
                        <button onClick={() => loadMovements(movPages)} disabled={movPage >= movPages}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-sm">»</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ══ Modal nhập/xuất/điều chỉnh ══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">
                {modalType === 'manual_in' ? '📥 Nhập kho thủ công' :
                 modalType === 'manual_out' ? '📤 Xuất kho thủ công' : '⚖️ Điều chỉnh tồn kho'}
              </h2>
              <div className="flex gap-2 mt-3">
                {([['manual_in','Nhập kho'],['manual_out','Xuất kho'],['adjustment','Điều chỉnh']] as const).map(([t,l]) => (
                  <button key={t} onClick={() => setModalType(t)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg border transition ${
                      modalType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div ref={mDropRef} className="relative">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Sản phẩm <span className="text-red-500">*</span>
                </label>
                {mProduct ? (
                  <div className="flex items-center gap-3 p-3 border border-green-200 rounded-xl bg-green-50">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{mProduct.name}</p>
                      <p className="text-xs text-gray-500">{mProduct.code} · Tồn: <span className="font-medium">{fmtDec(Number(mProduct.stockQuantity))}{mProduct.unit ? ` ${mProduct.unit}` : ''}</span></p>
                    </div>
                    <button onClick={() => { setMProduct(null); setMProductSearch(''); }}
                      className="text-gray-400 hover:text-red-500 transition">✕</button>
                  </div>
                ) : (
                  <>
                    <input
                      autoFocus
                      value={mProductSearch}
                      onChange={e => { setMProductSearch(e.target.value); setShowMDrop(true); }}
                      onFocus={() => setShowMDrop(true)}
                      placeholder="Tìm theo tên hoặc mã..."
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    {showMDrop && mProductResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                        {mProductResults.map(p => (
                          <button key={p.id} onMouseDown={() => { setMProduct(p); setMProductSearch(p.name); setShowMDrop(false); }}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 text-left transition">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                            </div>
                            <span className="text-xs text-gray-500 font-medium">{fmtDec(Number(p.stockQuantity))}{p.unit ? ` ${p.unit}` : ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Số lượng <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min="0.001" step="0.001"
                  value={mQty} onChange={e => setMQty(e.target.value)}
                  placeholder="Nhập số lượng..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Ghi chú</label>
                <input value={mNotes} onChange={e => setMNotes(e.target.value)}
                  placeholder="Lý do nhập/xuất kho..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>

              {mError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{mError}</p>}
            </div>

            <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                Hủy
              </button>
              <button onClick={handleSaveMovement} disabled={mSaving || !mProduct || !mQty}
                className={`flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition shadow-sm disabled:opacity-50 ${
                  modalType === 'manual_in' ? 'bg-green-600 hover:bg-green-700' :
                  modalType === 'manual_out' ? 'bg-orange-500 hover:bg-orange-600' :
                  'bg-purple-600 hover:bg-purple-700'
                }`}>
                {mSaving ? 'Đang lưu...' : modalType === 'manual_in' ? 'Xác nhận nhập kho' : modalType === 'manual_out' ? 'Xác nhận xuất kho' : 'Lưu điều chỉnh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

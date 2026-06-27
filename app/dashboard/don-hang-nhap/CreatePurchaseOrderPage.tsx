'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { purchaseOrdersApi } from '@/lib/purchase-orders';
import { partnersApi } from '@/lib/partners';
import { productsApi } from '@/lib/products';
import { branchesApi } from '@/lib/branches';
import { employeesApi } from '@/lib/employees';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Branch   { id: number; name: string; }
interface Employee { id: number; fullName: string; }
interface SupplierBasic { id: number; code: string; name: string; phone?: string; supplierType?: string | null; }
interface SupplierDetail extends SupplierBasic {
  supplierDebt?: number; address?: string; contactPerson?: string;
  email?: string; taxCode?: string; notes?: string; totalOrders?: number;
}
interface Product {
  id: number; code: string; name: string; unit: string;
  barcode?: string; costPrice?: number; stockQuantity?: number;
  images?: { id: number; url: string }[];
}
interface POItem {
  productId?: number | null; productCode: string; productName: string;
  unit: string; quantity: number; priceForeign: number;
  discountPercent: number; discountAmount: number;
  totalForeign: number; priceVnd: number; totalVnd: number;
  stockQty?: number; imageUrl?: string; _key: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtMoney = (n: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n));
const fmtNum = (n: number | string, d = 0) =>
  new Intl.NumberFormat('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const parseNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;

function calcLine(priceForeign: number, qty: number, discPercent: number, discAmount: number, rate: number) {
  const base = priceForeign * qty;
  const totalForeign = discAmount > 0
    ? Math.max(0, base - discAmount)
    : base * (1 - discPercent / 100);
  return { totalForeign, priceVnd: priceForeign * rate, totalVnd: totalForeign * rate };
}

let _key = 0;
const COLS_KEY = 'po-create-visible-cols';
const COLS_DEFAULT = { image: false, sku: true, unit: true, stock: true, discount: true };

// ─── NumInput ─────────────────────────────────────────────────────────────────
function NumInput({ value, onChange, className, placeholder, allowDecimal }: {
  value: number; onChange: (v: number) => void;
  className?: string; placeholder?: string; allowDecimal?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  const displayed = focused ? raw : (value === 0 ? '' : fmtNum(value, allowDecimal && value % 1 !== 0 ? 2 : 0));
  return (
    <input type="text" inputMode="numeric"
      value={displayed} placeholder={placeholder ?? '0'}
      onFocus={() => { setFocused(true); setRaw(value === 0 ? '' : String(value)); }}
      onChange={e => { const v = e.target.value.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, ''); setRaw(v); onChange(parseNum(v)); }}
      onBlur={() => setFocused(false)}
      className={className} />
  );
}

// ─── TagInput — nhập tags dạng pill ──────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  function addTag(raw: string) {
    const t = raw.trim().replace(/,$/, '');
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  }
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="text-blue-400 hover:text-red-500 leading-none">×</button>
        </span>
      ))}
      <input value={input}
        onChange={e => { if (e.target.value.endsWith(',')) addTag(e.target.value); else setInput(e.target.value); }}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === 'Tab') && input.trim()) { e.preventDefault(); addTag(input); } }}
        placeholder={tags.length === 0 ? 'Thêm tag... (Enter hoặc dấu phẩy)' : ''}
        className="flex-1 min-w-[120px] text-sm border-0 outline-none bg-transparent placeholder-gray-300 focus:ring-0" />
    </div>
  );
}

// ─── SupplierSection ──────────────────────────────────────────────────────────
function SupplierSection({ supplier, onSelect, supplierType, groupFilter, label }: {
  supplier: SupplierDetail | null; onSelect: (s: SupplierDetail | null) => void;
  supplierType?: string; groupFilter?: string; label?: string;
}) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState<SupplierBasic[]>([]);
  const [recent, setRecent]   = useState<SupplierBasic[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p: Record<string, string> = { type: 'supplier', limit: '8', sortBy: 'updatedAt', sortOrder: 'DESC',
      ...(supplierType ? { supplierType } : {}), ...(groupFilter ? { group: groupFilter } : {}) };
    partnersApi.getAll(p).then(d => setRecent(d.data ?? [])).catch(() => {});
  }, [supplierType, groupFilter]);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const search = useCallback((v: string) => {
    setQ(v); clearTimeout(timer.current);
    if (!v) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const p: Record<string, string> = { search: v, type: 'supplier', limit: '15',
          ...(supplierType ? { supplierType } : {}), ...(groupFilter ? { group: groupFilter } : {}) };
        setResults((await partnersApi.getAll(p)).data ?? []);
      } catch { /**/ }
      setLoading(false);
    }, 250);
  }, [supplierType, groupFilter]);

  async function handleSelect(s: SupplierBasic) {
    setOpen(false); setQ(''); setResults([]);
    try { const d = await partnersApi.getOne(s.id); onSelect({ ...s, ...d }); }
    catch { onSelect(s); }
  }

  const displayList = q ? results : recent;

  if (supplier) {
    return (
      <div>
        <div className="px-4 py-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
            {supplier.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-indigo-700 text-sm">{supplier.name}</span>
              {supplier.phone && <span className="text-xs text-gray-500">· {supplier.phone}</span>}
              <span className="text-[10px] text-gray-400 font-mono">{supplier.code}</span>
            </div>
            {supplier.email && <p className="text-[11px] text-gray-400 truncate">{supplier.email}</p>}
          </div>
          <button onClick={() => onSelect(null)} className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="border-t border-gray-100 flex">
          <div className="flex-1 px-4 py-2.5 border-r border-gray-100 min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Thông tin</p>
            {supplier.address
              ? <p className="text-[11px] text-gray-600">{supplier.address}</p>
              : <p className="text-[11px] text-gray-400 italic">Chưa có địa chỉ</p>}
            <div className="mt-1.5 flex flex-wrap gap-x-3">
              {supplier.taxCode && <span className="text-[10px] text-gray-400">MST: <span className="text-gray-600">{supplier.taxCode}</span></span>}
              {supplier.contactPerson && <span className="text-[10px] text-gray-400">LH: <span className="text-gray-600">{supplier.contactPerson}</span></span>}
            </div>
            {supplier.notes && <p className="mt-1.5 text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-1">{supplier.notes}</p>}
          </div>
          <div className="w-44 flex-shrink-0 py-2.5 px-3 space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-gray-400">Đang nợ NCC</span>
              <span className={`text-xs font-semibold ${Number(supplier.supplierDebt) > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {fmtMoney(Number(supplier.supplierDebt) || 0)}
              </span>
            </div>
            {supplier.totalOrders != null && (
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-gray-400">Số lần nhập</span>
                <span className="text-xs font-semibold text-gray-600">{supplier.totalOrders}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={q} onChange={e => { search(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            placeholder={label ?? 'Tìm nhà cung cấp...'}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-gray-50 transition" />
          {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">...</span>}
        </div>
      </div>
      {open && (
        <div className="border-t border-gray-100">
          {!q && <div className="px-4 py-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider bg-gray-50 border-b border-gray-100">
            {groupFilter ? `Nhóm "${groupFilter}" gần đây` : 'NCC gần đây'}
          </div>}
          {displayList.length === 0
            ? <div className="px-4 py-4 text-sm text-gray-400 text-center">
                {q ? 'Không tìm thấy' : groupFilter ? `Chưa có NCC nhóm "${groupFilter}". Thêm tại Đối Tác.` : 'Chưa có NCC'}
              </div>
            : <div className="max-h-52 overflow-y-auto">
                {displayList.map(s => (
                  <button key={s.id} type="button" onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition border-b last:border-0 border-gray-50">
                    <span className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">{s.name.charAt(0).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 font-medium truncate">{s.name}</p>
                      {s.phone && <p className="text-[11px] text-gray-400">{s.phone}</p>}
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{s.code}</span>
                  </button>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  );
}

// ─── Compact Freight Picker (dùng trong sidebar) ──────────────────────────────
function FreightPicker({ value, onSelect }: { value: SupplierBasic | null; onSelect: (s: SupplierBasic | null) => void }) {
  const [q, setQ]       = useState('');
  const [res, setRes]   = useState<SupplierBasic[]>([]);
  const [recent, setRecent] = useState<SupplierBasic[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    partnersApi.getAll({ type: 'supplier', group: 'freight', limit: '10', sortBy: 'updatedAt', sortOrder: 'DESC' })
      .then(d => setRecent(d.data ?? [])).catch(() => {});
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const search = useCallback((v: string) => {
    setQ(v); clearTimeout(timer.current);
    if (!v) { setRes([]); return; }
    timer.current = setTimeout(async () => {
      try { setRes((await partnersApi.getAll({ search: v, type: 'supplier', group: 'freight', limit: '10' })).data ?? []); }
      catch { /**/ }
    }, 250);
  }, []);

  const displayList = q ? res : recent;

  if (value) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold flex-shrink-0">{value.name.charAt(0)}</div>
        <span className="text-xs font-medium text-gray-700 truncate flex-1">{value.name}</span>
        <button type="button" onClick={() => onSelect(null)} className="text-gray-300 hover:text-red-400 transition text-xs leading-none">×</button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={q} onChange={e => { search(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="Tìm công ty VC (nhóm 'freight')..."
          className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white" />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
          {displayList.length === 0
            ? <div className="px-3 py-3 text-xs text-gray-400 text-center">{q ? 'Không tìm thấy' : "Chưa có NCC nhóm 'freight'. Thêm tại Đối Tác."}</div>
            : displayList.map(s => (
            <button key={s.id} type="button" onMouseDown={e => { e.preventDefault(); onSelect(s); setQ(''); setRes([]); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-blue-50 text-left text-xs border-b last:border-0 border-gray-50">
              <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold flex-shrink-0">{s.name.charAt(0)}</span>
              <span className="truncate font-medium">{s.name}</span>
              <span className="text-gray-400 ml-auto font-mono">{s.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ProductSearchBar ─────────────────────────────────────────────────────────
function ProductSearchBar({ onAdd, rate, isImport, scanMode }: { onAdd: (p: Product) => void; rate: number; isImport: boolean; scanMode?: boolean; }) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [recent, setRecent]   = useState<Product[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const timer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    productsApi.getAll({ isActive: 'true', limit: '20', sortBy: 'updatedAt', sortOrder: 'DESC' })
      .then(d => setRecent(d.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const search = useCallback((v: string) => {
    setQ(v); clearTimeout(timer.current);
    if (!v) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try { const d = await productsApi.getAll({ search: v, isActive: 'true', limit: '20' }); setResults(d.data ?? []); setOpen(true); }
      catch { /**/ }
      setLoading(false);
    }, 250);
  }, []);

  function pick(p: Product) {
    onAdd(p); setQ(''); setResults([]); setOpen(false);
    if (scanMode) setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleEnter() {
    if (!q.trim()) return;
    // Thử exact barcode trước (súng quét bắn thẳng → không cần debounce)
    clearTimeout(timer.current);
    setLoading(true);
    try {
      const exact = await productsApi.getAll({ barcode: q.trim(), isActive: 'true', limit: '1' });
      const hit = exact.data?.[0];
      if (hit) { pick(hit); setLoading(false); return; }
    } catch { /**/ }
    // Fallback: lấy kết quả search hiện tại
    if (displayList.length > 0) { pick(displayList[0]); }
    setLoading(false);
  }

  const displayList = q ? results : recent;

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input ref={inputRef} value={q}
          onChange={e => search(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleEnter(); } }}
          placeholder={scanMode ? 'Quét mã vạch...' : 'Tìm theo tên, mã, mã vạch... (Enter để thêm nhanh)'}
          className={`w-full pl-9 pr-8 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
            scanMode
              ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/30 placeholder:text-blue-400'
              : 'border-gray-200 focus:ring-blue-100 focus:border-blue-400'
          }`} />
        {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">...</span>}
      </div>
      {open && displayList.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 h-72 overflow-y-auto">
          {!q && <div className="px-3 py-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider bg-gray-50 border-b border-gray-100">Sản phẩm gần đây</div>}
          {displayList.map(p => (
            <div key={p.id} onClick={() => pick(p)}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 border-b last:border-0 border-gray-50 cursor-pointer transition">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-100">
                {p.images?.[0]?.url
                  ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-gray-800 truncate">{p.name}</span>
                  {p.unit && <span className="text-xs text-gray-400">/ {p.unit}</span>}
                  <a href={`/dashboard/products/${p.id}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="text-[11px] font-mono text-blue-400 hover:underline">{p.code}</a>
                </div>
                <div className="flex items-center gap-2">
                  {p.stockQuantity != null && (
                    <span className={`text-[11px] font-medium ${Number(p.stockQuantity) > 0 ? 'text-emerald-500' : 'text-red-400'}`}>Tồn: {Math.floor(Number(p.stockQuantity))}</span>
                  )}
                  {p.barcode && <span className="text-[11px] text-gray-400 font-mono">| {p.barcode}</span>}
                </div>
              </div>
              {p.costPrice != null && Number(p.costPrice) > 0 && (
                <span className="text-sm font-semibold text-indigo-600 flex-shrink-0">{isImport ? fmtNum(p.costPrice) : fmtMoney(p.costPrice)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CreatePurchaseOrderPage({
  fixedOrderType,
  editId,
}: {
  fixedOrderType?: 'domestic' | 'import';
  editId?: number;
}) {
  const router = useRouter();
  const isEditMode = !!editId;
  const backPath = editId
    ? `/dashboard/don-hang-nhap/${editId}`
    : fixedOrderType === 'import'
      ? '/dashboard/don-hang-nhap/nhap-khau'
      : '/dashboard/don-hang-nhap/trong-nuoc';

  const [branches, setBranches]   = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branchId, setBranchId]   = useState<number | ''>('');
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [branchError, setBranchError] = useState(false);

  const [orderType, setOrderType] = useState<'domestic' | 'import'>(fixedOrderType ?? 'domestic');
  const [supplier, setSupplier]   = useState<SupplierDetail | null>(null);
  const [freightAgent, setFreightAgent] = useState<SupplierDetail | null>(null);
  const [currency, setCurrency]   = useState(fixedOrderType === 'import' ? 'CNY' : 'VND');
  const [exchangeRate, setExchangeRate] = useState(fixedOrderType === 'import' ? 3500 : 1);
  const [date, setDate]           = useState(today());
  const [expectedDate, setExpectedDate] = useState('');
  const [reference, setReference] = useState('');
  const [tags, setTags]           = useState<string[]>([]);
  const [notes, setNotes]         = useState('');
  const [items, setItems]         = useState<POItem[]>([]);

  // Chi phí nhập hàng (trong sidebar phải)
  const [showCosts, setShowCosts] = useState(false);
  const [costs, setCosts]         = useState<{ name: string; amount: number; _key: number }[]>([]);
  const costKey = useRef(0);

  // Chiết khấu đơn
  const [orderDiscountMode, setOrderDiscountMode] = useState<'percent' | 'amount'>('amount');
  const [discountAmount, setDiscountAmount]   = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  // Thanh toán ngay — 2 ô riêng nếu có công ty VC
  const [supplierPayAmt, setSupplierPayAmt]     = useState(0);
  const [supplierPayMethod, setSupplierPayMethod] = useState('cash');
  const [freightPayAmt, setFreightPayAmt]       = useState(0);
  const [freightPayMethod, setFreightPayMethod] = useState('cash');

  const [saving, setSaving]   = useState(false);
  const [savingAs, setSavingAs] = useState<'draft' | 'received' | null>(null);
  const [err, setErr]         = useState('');
  const [editLoading, setEditLoading] = useState(isEditMode);
  const [editCode, setEditCode] = useState('');

  // Price list selector (placeholder — sẽ kết nối Module Bảng Giá khi xây xong)
  const [priceList, setPriceList] = useState<string>('cost');

  // Barcode scan mode — sau mỗi lần quét tự refocus input để quét tiếp
  const [scanMode, setScanMode] = useState(false);

  // Discount popup per row
  const [discountPopup, setDiscountPopup] = useState<{ key: number; mode: 'percent' | 'amount' } | null>(null);

  // Column visibility — persisted
  const [visibleCols, setVisibleCols] = useState<typeof COLS_DEFAULT>(() => {
    try { const s = localStorage.getItem(COLS_KEY); if (s) return { ...COLS_DEFAULT, ...JSON.parse(s) }; } catch { /**/ }
    return COLS_DEFAULT;
  });
  function toggleCol(col: keyof typeof COLS_DEFAULT, val: boolean) {
    setVisibleCols(prev => { const next = { ...prev, [col]: val }; try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch { /**/ } return next; });
  }
  const [showColConfig, setShowColConfig] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    branchesApi.getAll(true).then(d => setBranches(Array.isArray(d) ? d : (d.data ?? d.items ?? []))).catch(() => {});
    employeesApi.getAll({ limit: '100' }).then(d => setEmployees(d.items ?? d.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) return;
    setEditLoading(true);
    purchaseOrdersApi.getOne(editId).then((po: Record<string, unknown>) => {
      setEditCode((po.code as string) ?? '');
      const poOrderType = (po.orderType as string) === 'import' ? 'import' : 'domestic';
      setOrderType(poOrderType);
      const poCurrency = (po.currency as string) ?? 'VND';
      setCurrency(poCurrency);
      setExchangeRate(Number(po.exchangeRate ?? 1));
      setDate((po.date as string) ?? today());
      setExpectedDate((po.expectedDeliveryDate as string) ?? '');
      setReference((po.reference as string) ?? '');
      setNotes((po.notes as string) ?? '');
      const rawTags = (po.tags as string) ?? '';
      setTags(rawTags ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
      setDiscountAmount(Number(po.discountAmount ?? 0));
      if (po.supplier) setSupplier(po.supplier as SupplierDetail);
      if (po.freightAgent) setFreightAgent(po.freightAgent as SupplierBasic);
      if (po.branchId) setBranchId(Number(po.branchId));
      if (po.assignedToId) setEmployeeId(Number(po.assignedToId));
      const shippingFee = Number(po.shippingFee ?? 0);
      if (shippingFee > 0) {
        setShowCosts(true);
        setCosts([{ name: 'Phí vận chuyển', amount: shippingFee, _key: ++costKey.current }]);
      }
      const poItems = (po.items as Record<string, unknown>[]) ?? [];
      setItems(poItems.map((it) => ({
        productId: (it.productId as number) ?? null,
        productCode: (it.productCode as string) ?? '',
        productName: (it.productName as string) ?? '',
        unit: (it.unit as string) ?? 'Cái',
        quantity: Number(it.quantity ?? 1),
        priceForeign: Number(it.priceForeign ?? 0),
        discountPercent: Number(it.discountPercent ?? 0),
        discountAmount: 0,
        totalForeign: Number(it.totalForeign ?? 0),
        priceVnd: Number(it.priceVnd ?? 0),
        totalVnd: Number(it.totalVnd ?? 0),
        _key: ++_key,
      })));
    }).catch(() => setErr('Không thể tải dữ liệu đơn hàng'))
      .finally(() => setEditLoading(false));
  }, [editId]); // eslint-disable-line

  useEffect(() => {
    function h(e: MouseEvent) {
      if (colRef.current && !colRef.current.contains(e.target as Node)) setShowColConfig(false);
      if (!(e.target as Element).closest('[data-discount-popup]')) setDiscountPopup(null);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // F2 toggle scan mode
  useEffect(() => {
    function h(e: KeyboardEvent) {
      if (e.key === 'F2' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setScanMode(m => !m);
      }
    }
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const isImport   = orderType === 'import';
  const rate       = isImport ? (currency === 'VND' ? 1 : exchangeRate) : 1;
  const currSymbol = isImport ? (currency === 'CNY' ? '¥' : '$') : '₫';
  const totalCosts    = costs.reduce((s, c) => s + Number(c.amount), 0);
  const subtotalForeign = items.reduce((s, i) => s + i.totalForeign, 0);
  const subtotalVnd   = subtotalForeign * rate;
  const orderDiscountVnd = orderDiscountMode === 'percent'
    ? subtotalVnd * discountPercent / 100
    : Number(discountAmount);
  const totalVnd      = subtotalVnd - orderDiscountVnd + totalCosts;
  const nccDebt     = totalCosts > 0 ? Math.max(0, totalVnd - totalCosts) : totalVnd;
  const freightDebt = totalCosts > 0 ? totalCosts : 0;

  function switchOrderType(t: 'domestic' | 'import') {
    if (fixedOrderType) return;
    setOrderType(t); setSupplier(null);
    if (t === 'domestic') { setCurrency('VND'); setExchangeRate(1); }
    else { setCurrency('CNY'); setExchangeRate(3500); }
    setItems([]);
  }

  async function selectFreightAgent(s: SupplierBasic | null) {
    if (!s) { setFreightAgent(null); return; }
    try { const d = await partnersApi.getOne(s.id); setFreightAgent({ ...s, ...d }); }
    catch { setFreightAgent(s as SupplierDetail); }
  }

  function addProduct(p: Product) {
    setItems(prev => {
      const ei = prev.findIndex(i => i.productId === p.id);
      if (ei >= 0) {
        return prev.map((it, i) => { if (i !== ei) return it; const qty = Number(it.quantity) + 1; return { ...it, quantity: qty, ...calcLine(Number(it.priceForeign), qty, Number(it.discountPercent), Number(it.discountAmount), rate) }; });
      }
      const price = Number(p.costPrice ?? 0);
      const imageUrl = p.images?.[0]?.url;
      return [...prev, { productId: p.id, productCode: p.code, productName: p.name, unit: p.unit || 'Cái', quantity: 1, priceForeign: price, discountPercent: 0, discountAmount: 0, stockQty: p.stockQuantity, imageUrl, ...calcLine(price, 1, 0, 0, rate), _key: ++_key }];
    });
  }

  function updateItem(key: number, fields: Partial<POItem>) {
    setItems(prev => prev.map(it => { if (it._key !== key) return it; const u = { ...it, ...fields }; return { ...u, ...calcLine(Number(u.priceForeign), Number(u.quantity), Number(u.discountPercent), Number(u.discountAmount), rate) }; }));
  }

  function addQty(key: number, delta: number) {
    setItems(prev => prev.map(it => { if (it._key !== key) return it; const qty = Math.max(0.001, Number(it.quantity) + delta); return { ...it, quantity: qty, ...calcLine(Number(it.priceForeign), qty, Number(it.discountPercent), Number(it.discountAmount), rate) }; }));
  }

  useEffect(() => {
    setItems(prev => prev.map(it => ({ ...it, ...calcLine(Number(it.priceForeign), Number(it.quantity), Number(it.discountPercent), Number(it.discountAmount), rate) })));
  }, [rate]); // eslint-disable-line

  // Tự clamp thanh toán khi tổng thay đổi
  useEffect(() => {
    setSupplierPayAmt(prev => Math.min(prev, nccDebt));
  }, [nccDebt]); // eslint-disable-line
  useEffect(() => {
    setFreightPayAmt(prev => Math.min(prev, freightDebt));
  }, [freightDebt]); // eslint-disable-line

  async function handleSave(finalStatus: 'draft' | 'received') {
    let hasErr = false;
    if (!branchId) { setBranchError(true); hasErr = true; }
    if (items.length === 0) { setErr('Phải có ít nhất 1 sản phẩm'); hasErr = true; }
    if (freightPayAmt > 0 && !freightAgent) { setErr('Đã nhập tiền trả VC nhưng chưa chọn công ty vận chuyển. Vui lòng chọn công ty VC hoặc xóa số tiền trả VC.'); hasErr = true; }
    if (hasErr) return;
    setBranchError(false); setErr('');
    setSaving(true); setSavingAs(finalStatus);
    const payload = {
      orderType, supplierId: supplier?.id ?? null, freightAgentId: freightAgent?.id ?? null,
      branchId: branchId || undefined, assignedToId: employeeId || undefined,
      currency: isImport ? currency : 'VND', exchangeRate: rate,
      date, expectedDeliveryDate: expectedDate || undefined,
      discountAmount: orderDiscountVnd, shippingFee: totalCosts,
      tags: tags.length > 0 ? tags.join(',') : undefined,
      notes: notes || undefined, reference: reference || undefined,
      items: items.map(i => ({
        productId: i.productId, quantity: Number(i.quantity),
        priceForeign: Number(i.priceForeign),
        discountPercent: Number(i.discountPercent),
        discountAmount: Number(i.discountAmount),
      })),
    };
    try {
      if (isEditMode && editId) {
        await purchaseOrdersApi.update(editId, payload);
        router.push(`/dashboard/don-hang-nhap/${editId}`);
        return;
      }

      const created = await purchaseOrdersApi.create({
        ...payload,
        ...(supplierPayAmt > 0 && { initialPaymentAmount: Number(supplierPayAmt), initialPaymentMethod: supplierPayMethod }),
      });

      // Các bước sau (payment, status) — PO đã được tạo, nên lỗi ở đây vẫn navigate về list
      let postErr = '';
      if (freightPayAmt > 0 && freightAgent) {
        try {
          await purchaseOrdersApi.addPayment(created.id, {
            amount: Number(freightPayAmt), paymentMethod: freightPayMethod, paymentTarget: 'freight',
          });
        } catch { postErr = 'Đơn đã tạo nhưng không ghi được thanh toán VC. Vào chi tiết đơn để thanh toán lại.'; }
      }
      if (!postErr && finalStatus === 'received') {
        try {
          await purchaseOrdersApi.updateStatus(created.id, { status: 'received', receivedDate: date });
        } catch { postErr = 'Đơn đã tạo nhưng không cập nhật được trạng thái "Đã nhận". Vào chi tiết đơn để cập nhật lại.'; }
      }

      if (postErr) {
        setErr(postErr);
        setTimeout(() => router.push(backPath), 3000);
      } else {
        router.push(backPath);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Lỗi lưu đơn hàng');
    } finally {
      setSaving(false); setSavingAs(null);
    }
  }

  const pageTitle = isEditMode
    ? `Sửa đơn${editCode ? ' · ' + editCode : ''}`
    : fixedOrderType === 'import' ? 'Tạo đơn nhập khẩu' : 'Tạo đơn nhập trong nước';

  if (editLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Đang tải dữ liệu đơn hàng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(backPath)}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-base font-bold text-gray-900 tracking-tight">{pageTitle}</h1>
            {!fixedOrderType && !isEditMode && (
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button type="button" onClick={() => switchOrderType('domestic')}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${orderType === 'domestic' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Trong Nước</button>
                <button type="button" onClick={() => switchOrderType('import')}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${orderType === 'import' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Nhập Khẩu</button>
              </div>
            )}
            {fixedOrderType && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${fixedOrderType === 'import' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {fixedOrderType === 'import' ? `Nhập Khẩu · ${currency === 'CNY' ? 'CNY (¥)' : 'USD ($)'}` : 'Trong Nước · VND'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(backPath)} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition">Thoát</button>
            {isEditMode ? (
              <button onClick={() => handleSave('draft')} disabled={saving} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60 shadow-sm shadow-blue-200 transition">
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            ) : (
              <>
                <button onClick={() => handleSave('draft')} disabled={saving} className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 bg-white rounded-xl hover:bg-gray-50 disabled:opacity-60 transition">
                  {savingAs === 'draft' ? 'Đang lưu...' : 'Tạo & chưa nhập'}
                </button>
                <button onClick={() => handleSave('received')} disabled={saving} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60 shadow-sm shadow-blue-200 transition">
                  {savingAs === 'received' ? 'Đang nhập...' : 'Tạo & nhập hàng'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-4 max-w-7xl mx-auto space-y-3">

        {/* ══ Row 1: NCC | Thông tin bổ sung ══ */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 text-sm">{isImport ? 'Nhà cung cấp nước ngoài' : 'Nhà cung cấp'}</h2>
                {supplier && <button onClick={() => setSupplier(null)} className="text-xs text-gray-400 hover:text-red-500 transition">Xóa</button>}
              </div>
              <SupplierSection supplier={supplier} onSelect={setSupplier}
                supplierType={isImport ? 'foreign' : undefined}
                label={isImport ? 'Tìm NCC nước ngoài...' : 'Tìm nhà cung cấp theo tên, SĐT...'} />
              {freightAgent && (
                <div className="border-t border-dashed border-gray-100">
                  <div className="px-4 py-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs flex-shrink-0">
                      {freightAgent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide leading-none mb-0.5">Đơn vị vận chuyển</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-700 text-sm">{freightAgent.name}</span>
                        {freightAgent.phone && <span className="text-xs text-gray-500">· {freightAgent.phone}</span>}
                        <span className="text-[10px] text-gray-400 font-mono">{freightAgent.code}</span>
                      </div>
                      {freightAgent.email && <p className="text-[11px] text-gray-400 truncate">{freightAgent.email}</p>}
                    </div>
                    <button onClick={() => setFreightAgent(null)} className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="border-t border-gray-100 flex">
                    <div className="flex-1 px-4 py-2.5 border-r border-gray-100 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Thông tin</p>
                      {freightAgent.address
                        ? <p className="text-[11px] text-gray-600">{freightAgent.address}</p>
                        : <p className="text-[11px] text-gray-400 italic">Chưa có địa chỉ</p>}
                      <div className="mt-1.5 flex flex-wrap gap-x-3">
                        {freightAgent.taxCode && <span className="text-[10px] text-gray-400">MST: <span className="text-gray-600">{freightAgent.taxCode}</span></span>}
                        {freightAgent.contactPerson && <span className="text-[10px] text-gray-400">LH: <span className="text-gray-600">{freightAgent.contactPerson}</span></span>}
                      </div>
                      {freightAgent.notes && <p className="mt-1.5 text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-1">{freightAgent.notes}</p>}
                    </div>
                    <div className="w-44 flex-shrink-0 py-2.5 px-3 space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-400">Công nợ VC</span>
                        <span className={`text-xs font-semibold ${Number(freightAgent.supplierDebt) > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {fmtMoney(Number(freightAgent.supplierDebt) || 0)}
                        </span>
                      </div>
                      {freightAgent.totalOrders != null && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-400">Số lần nhập</span>
                          <span className="text-xs font-semibold text-gray-600">{freightAgent.totalOrders}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-[340px] flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100"><h3 className="font-semibold text-gray-800 text-sm">Thông tin bổ sung</h3></div>
              <div className="divide-y divide-gray-50">
                {/* Chi nhánh — bắt buộc */}
                <div className="px-4 py-2 flex items-start gap-3">
                  <span className="text-xs font-medium text-gray-500 flex-shrink-0 pt-1.5">Chi nhánh <span className="text-red-500">*</span></span>
                  <div className="flex-1">
                    <select value={branchId} onChange={e => { setBranchId(e.target.value ? Number(e.target.value) : ''); setBranchError(false); }}
                      className={`w-full border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400 bg-white transition ${branchError ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}>
                      <option value="">— Chọn chi nhánh —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {branchError && <p className="text-[11px] text-orange-500 mt-1">Chọn chi nhánh để xác định kho nhập</p>}
                  </div>
                </div>
                {/* Nhân viên phụ trách */}
                <div className="px-4 py-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-gray-500 flex-shrink-0">Nhân viên</span>
                  <select value={employeeId} onChange={e => setEmployeeId(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400 bg-white">
                    <option value="">— Không chỉ định —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                  </select>
                </div>
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Ngày đặt</span>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Dự kiến nhận</span>
                  <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                {isImport && (
                  <>
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Tiền tệ</span>
                      <select value={currency} onChange={e => { setCurrency(e.target.value); if (e.target.value === 'VND') setExchangeRate(1); }}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400 bg-white">
                        <option value="CNY">CNY (¥)</option><option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">1 {currency} = ? ₫</span>
                      <NumInput value={exchangeRate} onChange={setExchangeRate} className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400" />
                    </div>
                  </>
                )}
                <div className="px-4 py-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-500 flex-shrink-0">Tham chiếu / PO#</span>
                  <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Mã PO, hợp đồng..."
                    className="w-40 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ Row 2: Sản phẩm ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin sản phẩm</h2>
            <div className="flex items-center gap-2">
              {items.length > 0 && <span className="text-xs text-gray-400">{items.length} sản phẩm</span>}
              <div className="relative" ref={colRef}>
                <button onClick={() => setShowColConfig(v => !v)} title="Tùy chỉnh cột hiển thị"
                  className={`p-1.5 rounded-lg transition ${showColConfig ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {showColConfig && (
                  <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-xl w-60 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cột hiển thị</span>
                      <span className="text-[10px] text-gray-400">Tự động lưu</span>
                    </div>
                    {/* Cột luôn hiển thị */}
                    <div className="px-3 py-1.5 bg-gray-50/60 border-b border-gray-100">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Luôn hiển thị</span>
                    </div>
                    {(['STT', 'Tên sản phẩm', 'Số lượng', 'Đơn giá', 'Thành tiền'] as const).map(label => (
                      <div key={label} className="flex items-center gap-2.5 px-3 py-2 border-b border-gray-50 opacity-50">
                        <div className="w-3.5 h-3.5 rounded border-2 border-blue-400 bg-blue-400 flex items-center justify-center flex-shrink-0">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <span className="text-sm text-gray-500">{label}</span>
                      </div>
                    ))}
                    {/* Cột có thể ẩn/hiện */}
                    <div className="px-3 py-1.5 bg-gray-50/60 border-b border-gray-100 border-t border-gray-100">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Có thể ẩn / hiện</span>
                    </div>
                    {([
                      { key: 'image',    label: 'Ảnh sản phẩm' },
                      { key: 'sku',      label: 'Mã SKU' },
                      { key: 'unit',     label: 'Đơn vị (ĐVT)' },
                      { key: 'stock',    label: 'Tồn kho' },
                      { key: 'discount', label: 'Chiết khấu' },
                    ] as const).map(col => (
                      <label key={col.key} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-50 cursor-pointer border-b last:border-0 border-gray-50">
                        <input type="checkbox" checked={visibleCols[col.key]} onChange={e => toggleCol(col.key, e.target.checked)} className="w-3.5 h-3.5 rounded accent-blue-600" />
                        <span className="text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex gap-2 items-center">
            <div className="flex-1 min-w-0">
              <ProductSearchBar onAdd={addProduct} rate={rate} isImport={isImport} scanMode={scanMode} />
            </div>
            {/* Nút quét mã vạch */}
            <button
              type="button"
              onClick={() => setScanMode(m => !m)}
              title={scanMode ? 'Đang ở chế độ quét mã vạch — bấm để tắt (F2)' : 'Bật chế độ quét mã vạch (súng quét) · F2'}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all flex-shrink-0 ${
                scanMode
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                  : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'
              }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M4 6h2M4 10h2M4 14h2M4 18h2M8 4v16M12 4v16M16 6h2M16 10h2M16 14h2M16 18h2M20 4v16" />
              </svg>
              {scanMode ? 'Đang quét' : 'Quét mã'}
            </button>
            {/* Bảng giá nhập — placeholder, sẽ load từ module Bảng Giá sau khi hoàn thiện */}
            <select value={priceList} onChange={e => setPriceList(e.target.value)}
              title="Bảng giá áp dụng khi thêm sản phẩm"
              className="text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 text-gray-600 min-w-[140px] flex-shrink-0 cursor-pointer">
              <option value="cost">📋 Giá nhập gốc</option>
              {/* TODO: load danh sách bảng giá nhập từ API /price-lists sau khi hoàn thiện module */}
            </select>
          </div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-300">
              <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm font-medium text-gray-400">Tìm và thêm sản phẩm ở ô tìm kiếm trên</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-center font-semibold w-10">STT</th>
                    {visibleCols.image    && <th className="px-2 py-2.5 w-10 text-center">Ảnh</th>}
                    <th className="px-2 py-2.5 text-left font-semibold">Tên sản phẩm</th>
                    {visibleCols.sku      && <th className="px-3 py-2.5 text-left font-semibold w-24">Mã SKU</th>}
                    {visibleCols.unit     && <th className="px-3 py-2.5 text-center font-semibold w-20">ĐVT</th>}
                    {visibleCols.stock    && <th className="px-3 py-2.5 text-right font-semibold w-20">Tồn</th>}
                    <th className="px-3 py-2.5 text-center font-semibold w-44">Số lượng</th>
                    <th className="px-3 py-2.5 text-right font-semibold w-36">{isImport ? `Giá (${currSymbol})` : 'Đơn giá (₫)'}</th>
                    {visibleCols.discount && <th className="px-3 py-2.5 text-center font-semibold w-28">Chiết khấu</th>}
                    <th className="px-4 py-2.5 text-right font-semibold w-36">Thành tiền</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 border-b border-gray-100">
                  {items.map((it, idx) => (
                    <tr key={it._key} className="hover:bg-blue-50/30 transition group">
                      <td className="px-4 py-3 text-center text-xs text-gray-400">{idx + 1}</td>
                      {visibleCols.image && (
                        <td className="px-2 py-2">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-100 overflow-hidden flex items-center justify-center text-gray-300">
                            {it.imageUrl
                              ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
                              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                          </div>
                        </td>
                      )}
                      <td className="px-2 py-3">
                        <div className="font-medium text-gray-800 text-sm">{it.productName}</div>
                        {it.stockQty != null && Number(it.stockQty) <= 0 && (
                          <div className="text-[11px] text-amber-500 flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                            Hết hàng (tồn: 0)
                          </div>
                        )}
                      </td>
                      {visibleCols.sku    && <td className="px-3 py-3 font-mono text-xs text-gray-400">{it.productCode}</td>}
                      {visibleCols.unit   && <td className="px-3 py-3"><input value={it.unit} onChange={e => updateItem(it._key, { unit: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:border-blue-400" /></td>}
                      {visibleCols.stock  && <td className={`px-3 py-3 text-right text-xs font-semibold ${Number(it.stockQty) > 0 ? 'text-emerald-500' : 'text-gray-400'}`}>{it.stockQty != null ? Math.floor(Number(it.stockQty)) : '—'}</td>}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => addQty(it._key, -1)} className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm font-bold transition flex-shrink-0">−</button>
                          <NumInput value={it.quantity} onChange={v => updateItem(it._key, { quantity: v })} allowDecimal className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:border-blue-400" />
                          <button type="button" onClick={() => addQty(it._key, 1)} className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm font-bold transition flex-shrink-0">+</button>
                        </div>
                      </td>
                      <td className="px-3 py-3"><NumInput value={it.priceForeign} onChange={v => updateItem(it._key, { priceForeign: v })} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:border-blue-400" /></td>
                      {visibleCols.discount && (
                        <td className="px-3 py-3 text-center" data-discount-popup>
                          {discountPopup?.key === it._key ? (
                            <div data-discount-popup className="space-y-1.5 min-w-[90px]">
                              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs" data-discount-popup>
                                <button data-discount-popup type="button" onClick={() => setDiscountPopup({ key: it._key, mode: 'percent' })}
                                  className={`flex-1 py-1 font-semibold transition ${discountPopup.mode === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>%</button>
                                <button data-discount-popup type="button" onClick={() => setDiscountPopup({ key: it._key, mode: 'amount' })}
                                  className={`flex-1 py-1 font-semibold border-l border-gray-200 transition ${discountPopup.mode === 'amount' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>₫</button>
                              </div>
                              <input data-discount-popup type="text" inputMode="numeric" autoFocus placeholder="0"
                                value={discountPopup.mode === 'percent' ? (it.discountPercent === 0 ? '' : String(it.discountPercent)) : (it.discountAmount === 0 ? '' : fmtNum(it.discountAmount))}
                                onChange={e => {
                                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                                  if (discountPopup.mode === 'percent') updateItem(it._key, { discountPercent: Math.min(100, parseFloat(raw) || 0), discountAmount: 0 });
                                  else updateItem(it._key, { discountAmount: parseInt(raw.replace(/\./g, '')) || 0, discountPercent: 0 });
                                }}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:border-blue-400" />
                            </div>
                          ) : (
                            <button data-discount-popup type="button"
                              onClick={() => setDiscountPopup({ key: it._key, mode: it.discountAmount > 0 ? 'amount' : 'percent' })}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold transition hover:bg-gray-100 ${it.discountAmount > 0 || it.discountPercent > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                              {it.discountAmount > 0 ? `${fmtNum(it.discountAmount)}₫` : it.discountPercent > 0 ? `${it.discountPercent}%` : '0%'}
                            </button>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {isImport
                          ? <><div className="text-xs text-gray-400">{fmtNum(it.totalForeign, 2)}{currSymbol}</div><div>{fmtMoney(it.totalVnd)}</div></>
                          : fmtMoney(it.totalVnd)}
                      </td>
                      <td className="px-2 py-3">
                        <button type="button" onClick={() => setItems(prev => prev.filter(x => x._key !== it._key))}
                          className="text-gray-200 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 text-sm">
                    <td colSpan={visibleCols.image ? 3 : 2} className="px-4 py-2.5 text-xs text-gray-500 font-medium">
                      {items.length} sản phẩm
                    </td>
                    {visibleCols.sku      && <td />}
                    {visibleCols.unit     && <td />}
                    {visibleCols.stock    && <td />}
                    <td />{/* Số lượng */}
                    <td />{/* Đơn giá */}
                    {visibleCols.discount && <td />}
                    <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                      {isImport
                        ? <><div className="text-xs text-gray-400 font-normal">{fmtNum(subtotalForeign, 2)}{currSymbol}</div><div>{fmtMoney(subtotalVnd)}</div></>
                        : fmtMoney(subtotalVnd)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ══ Row 3: Tags + Ghi chú | Thanh toán (có chi phí) ══ */}
        <div className="flex gap-4 items-start">

          {/* Left — Tags + Ghi chú (1 card) */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              <div className="flex items-center gap-3 px-4 py-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 w-14">Tags</span>
                <div className="flex-1 min-w-0">
                  <TagInput tags={tags} onChange={setTags} />
                </div>
              </div>
              <div className="px-4 py-2 flex items-start gap-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 w-14 pt-1">Ghi chú</span>
                <textarea value={notes}
                  onChange={e => { setNotes(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                  placeholder="Ghi chú nội bộ, lưu ý đơn hàng..."
                  rows={2} style={{ minHeight: '36px' }}
                  className="flex-1 text-sm border-0 outline-none bg-transparent placeholder-gray-300 focus:ring-0 resize-none overflow-hidden" />
              </div>
            </div>
            {err && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{err}</div>}
          </div>

          {/* Right — Thanh toán (bao gồm chi phí nhập hàng) */}
          <div className="w-[340px] flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100"><h3 className="font-semibold text-gray-800 text-sm">Thanh toán</h3></div>
              <div className="divide-y divide-gray-50 text-sm">

                {/* Subtotal */}
                <div className="flex justify-between items-center px-4 py-2">
                  <span className="text-gray-500">Tổng SP ({items.filter(i => i.productId).length})</span>
                  <span className="text-gray-700">
                    {isImport && <span className="text-gray-400 mr-2 text-xs">{fmtNum(subtotalForeign, 2)}{currSymbol}</span>}
                    {fmtMoney(subtotalVnd)}
                  </span>
                </div>

                {/* Chiết khấu đơn */}
                <div className="flex items-center justify-between px-4 py-2 gap-2">
                  <span className="text-gray-500 flex-shrink-0">Chiết khấu đơn</span>
                  <div className="flex items-center gap-1">
                    <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs flex-shrink-0">
                      <button type="button" onClick={() => setOrderDiscountMode('percent')}
                        className={`px-2 py-1 font-semibold transition ${orderDiscountMode === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>%</button>
                      <button type="button" onClick={() => setOrderDiscountMode('amount')}
                        className={`px-2 py-1 font-semibold border-l border-gray-200 transition ${orderDiscountMode === 'amount' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>₫</button>
                    </div>
                    {orderDiscountMode === 'percent' ? (
                      <div className="flex items-center gap-1">
                        <NumInput value={discountPercent} onChange={v => setDiscountPercent(Math.min(100, v))}
                          placeholder="0" className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-blue-400" />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <NumInput value={discountAmount} onChange={setDiscountAmount}
                          className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-blue-400" />
                        <span className="text-xs text-gray-400">₫</span>
                      </div>
                    )}
                  </div>
                </div>
                {orderDiscountVnd > 0 && orderDiscountMode === 'percent' && (
                  <div className="flex justify-end px-4 pb-1">
                    <span className="text-[11px] text-blue-500">= {fmtMoney(orderDiscountVnd)}</span>
                  </div>
                )}

                {/* Chi phí nhập hàng — collapsible trong sidebar */}
                <div>
                  <button type="button" onClick={() => {
                    if (!showCosts) setCosts([{ name: 'Phí vận chuyển', amount: 0, _key: ++costKey.current }]);
                    else { setCosts([]); setFreightAgent(null); }
                    setShowCosts(v => !v);
                  }} className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition">
                    <span className={`font-medium ${showCosts ? 'text-blue-600' : 'text-gray-500'}`}>
                      {showCosts ? 'Chi phí nhập hàng' : '+ Thêm chi phí nhập hàng'}
                    </span>
                    <div className="flex items-center gap-2">
                      {totalCosts > 0 && <span className="text-xs font-semibold text-gray-700">+{fmtMoney(totalCosts)}</span>}
                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showCosts ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                  {showCosts && (
                    <div className="px-4 py-3 bg-gray-50/60 border-t border-gray-100 space-y-3">
                      {/* Compact freight picker */}
                      <div>
                        <p className="text-[11px] font-medium text-gray-400 mb-1.5">Công ty VC <span className="font-normal">(tuỳ chọn — ghi nợ riêng)</span></p>
                        <FreightPicker value={freightAgent} onSelect={selectFreightAgent} />
                      </div>
                      {/* Cost lines */}
                      <div className="space-y-2">
                        {costs.map((c, idx) => (
                          <div key={c._key} className="flex gap-2 items-center">
                            <input value={c.name} onChange={e => setCosts(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                              placeholder="Tên chi phí" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-400 bg-white" />
                            <NumInput value={c.amount} onChange={v => setCosts(prev => prev.map((x, i) => i === idx ? { ...x, amount: v } : x))}
                              className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:border-blue-400 bg-white" />
                            <button type="button" onClick={() => setCosts(prev => prev.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => setCosts(prev => [...prev, { name: '', amount: 0, _key: ++costKey.current }])}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium transition">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Thêm dòng chi phí
                      </button>
                    </div>
                  )}
                </div>

                {/* Tổng cộng */}
                <div className="px-4 py-2.5">
                  <div className="flex justify-between items-center font-bold text-gray-900">
                    <span>Tổng cộng</span>
                    <span className="text-blue-700 text-base">{fmtMoney(totalVnd)}</span>
                  </div>
                  {/* Breakdown nợ khi có chi phí VC */}
                  {totalCosts > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>→ Nợ NCC ({supplier?.name ?? 'chưa chọn'})</span><span>{fmtMoney(nccDebt)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-amber-600">
                        <span>→ Nợ VC {freightAgent ? `(${freightAgent.name})` : ''}</span><span>{fmtMoney(freightDebt)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Thanh toán ngay — chỉ khi tạo mới */}
                {!isEditMode && (<div className="px-4 py-2 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thanh toán ngay</p>
                  {/* Trả NCC */}
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-500">{(freightAgent || totalCosts > 0) ? 'Trả NCC' : 'Số tiền'}</span>
                      {nccDebt > 0 && (
                        <button type="button" onClick={() => setSupplierPayAmt(nccDebt)}
                          className="text-[11px] text-blue-500 hover:text-blue-700 transition">
                          Điền đủ {fmtMoney(nccDebt)}
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <NumInput value={supplierPayAmt} onChange={v => setSupplierPayAmt(Math.min(v, nccDebt))}
                        className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:border-blue-400 flex-shrink-0" />
                      <select value={supplierPayMethod} onChange={e => setSupplierPayMethod(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                        <option value="cash">Tiền mặt</option>
                        <option value="bank_transfer">Chuyển khoản</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>
                  </div>
                  {/* Trả VC — hiện khi có công ty VC hoặc có chi phí vận chuyển */}
                  {(freightAgent || totalCosts > 0) && (
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-amber-600 font-medium truncate">{freightAgent ? `Trả VC (${freightAgent.name})` : 'Trả VC'}</span>
                        {freightDebt > 0 && (
                          <button type="button" onClick={() => setFreightPayAmt(freightDebt)}
                            className="text-[11px] text-blue-500 hover:text-blue-700 transition flex-shrink-0">
                            Điền đủ {fmtMoney(freightDebt)}
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <NumInput value={freightPayAmt} onChange={v => setFreightPayAmt(Math.min(v, freightDebt))}
                          className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:border-blue-400 flex-shrink-0" />
                        <select value={freightPayMethod} onChange={e => setFreightPayMethod(e.target.value)}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white">
                          <option value="cash">Tiền mặt</option>
                          <option value="bank_transfer">Chuyển khoản</option>
                          <option value="other">Khác</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {(supplierPayAmt > 0 || freightPayAmt > 0) && (
                    <p className="text-[11px] text-gray-400">
                      Còn lại: <span className="font-semibold text-gray-600">{fmtMoney(Math.max(0, totalVnd - supplierPayAmt - freightPayAmt))}</span>
                    </p>
                  )}
                </div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

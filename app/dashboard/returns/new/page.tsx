'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { returnsApi } from '@/lib/returns';
import { getToken } from '@/lib/auth';
import { cancelReturnReasonsApi } from '@/lib/cancel-return-reasons';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
async function apiFetch(path: string) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

interface Order {
  id: number; code: string; date: string; totalAmount: number; status: string;
  customer: { id: number; name: string; phone?: string } | null;
  assignedTo?: { id: number; fullName: string } | null;
  items: OrderItem[];
}
interface OrderItem {
  id: number; productId: number | null; productCode: string; productName: string;
  unit: string | null; quantity: number; unitPrice: number; lineTotal: number; isService: boolean;
}
interface ReturnLine {
  orderItemId: number; productCode: string; productName: string; unit: string | null;
  maxQty: number; unitPrice: number; quantity: number; refundAmount: number;
  condition: 'good' | 'damaged' | 'missing_parts'; restoreStock: boolean;
  itemReason: string; selected: boolean;
}
interface ExchangeLine {
  tempId: string;
  productId: number; productCode: string; productName: string;
  imageUrl?: string | null;
  unit: string | null; quantity: number; unitPrice: number;
  discountPercent: number; discountAmount: number;
  taxPercent: number; lineTotal: number;
  stockQuantity?: number;
}
interface ProdResult {
  id: number; code: string; name: string; unit: string | null;
  sellingPrice: number; imageUrl?: string | null;
  stockQuantity?: number; taxPercent?: number; barcode?: string;
}

// REASONS moved to DB — loaded via API, fallback to empty
const REFUND_METHODS = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'bank_transfer', label: 'Chuyển khoản' },
  { value: 'exchange', label: 'Đổi hàng' },
  { value: 'no_refund', label: 'Không hoàn tiền' },
];
const CONDITIONS = [
  { value: 'good', label: 'Còn tốt' },
  { value: 'damaged', label: 'Hỏng hóc' },
  { value: 'missing_parts', label: 'Thiếu PK' },
];
const DATE_PRESETS = [
  { key: 'today',      label: 'Hôm nay' },
  { key: 'yesterday',  label: 'Hôm qua' },
  { key: 'this_week',  label: 'Tuần này' },
  { key: 'last_week',  label: 'Tuần trước' },
  { key: 'this_month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
];

function presetToDates(preset: string): { from: string; to: string } {
  const today = new Date(); const f = (d: Date) => { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  if (preset === 'today')      return { from: f(today), to: f(today) };
  if (preset === 'yesterday')  { const d = new Date(today); d.setDate(d.getDate()-1); return { from: f(d), to: f(d) }; }
  if (preset === 'this_week')  { const d = new Date(today); d.setDate(d.getDate()-d.getDay()+1); return { from: f(d), to: f(today) }; }
  if (preset === 'last_week')  { const s = new Date(today); s.setDate(s.getDate()-s.getDay()-6); const e = new Date(s); e.setDate(e.getDate()+6); return { from: f(s), to: f(e) }; }
  if (preset === 'this_month') { const d = new Date(today.getFullYear(), today.getMonth(), 1); return { from: f(d), to: f(today) }; }
  if (preset === 'last_month') { const s = new Date(today.getFullYear(), today.getMonth()-1, 1); const e = new Date(today.getFullYear(), today.getMonth(), 0); return { from: f(s), to: f(e) }; }
  return { from: '', to: '' };
}

function fmt(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function fmtDt(s: string) {
  const d = new Date(s);
  const date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `${date} ${time}`;
}

// ─── Checkbox dropdown component ──────────────────────────────────────────────
interface CheckDropProps {
  label: string;
  committed: Set<string>;           // applied set (shown in badge count)
  items: { key: string; label: string }[];
  loading?: boolean;
  onApply: (selected: Set<string>) => void;
}
function CheckDrop({ label, committed, items, loading, onApply }: CheckDropProps) {
  const [open, setOpen]     = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set(committed));
  const [q, setQ]           = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Sync pending from outside when dropdown closes (e.g. clearAllFilters)
  useEffect(() => { if (!open) setPending(new Set(committed)); }, [open, committed]);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = items.filter(it => it.label.toLowerCase().includes(q.toLowerCase()));
  const allChecked = filtered.length > 0 && filtered.every(it => pending.has(it.key));

  function toggle(key: string) {
    setPending(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function toggleAll() {
    if (allChecked) { setPending(prev => { const n = new Set(prev); filtered.forEach(it => n.delete(it.key)); return n; }); }
    else { setPending(prev => { const n = new Set(prev); filtered.forEach(it => n.add(it.key)); return n; }); }
  }
  function handleApply() { onApply(new Set(pending)); setOpen(false); }
  function handleClear() { setPending(new Set()); onApply(new Set()); setOpen(false); }

  const active = committed.size > 0;
  const btnLabel = active ? `${label} (${committed.size})` : label;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition whitespace-nowrap ${
          active ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>
        {btnLabel}{active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-0.5"/>}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-40 bg-white border border-gray-200 rounded-2xl shadow-xl w-64 flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm kiếm"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"/>
            </div>
          </div>
          <div className="overflow-y-auto max-h-52 p-1">
            {loading ? (
              <div className="py-4 flex items-center justify-center gap-2 text-gray-400 text-xs">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Đang tải...
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-xs text-gray-300 py-4">Không có dữ liệu</p>
            ) : (
              <>
                <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-3.5 h-3.5 accent-blue-600"/>
                  <span className="text-xs font-semibold text-gray-600">Chọn tất cả ({filtered.length})</span>
                </label>
                {filtered.map(it => (
                  <label key={it.key} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition ${pending.has(it.key) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={pending.has(it.key)} onChange={() => toggle(it.key)} className="w-3.5 h-3.5 accent-blue-600"/>
                    <span className={`text-xs truncate ${pending.has(it.key) ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>{it.label}</span>
                  </label>
                ))}
                {filtered.length === 0 && <p className="text-center text-xs text-gray-300 py-3">Không tìm thấy</p>}
              </>
            )}
          </div>
          <div className="p-2 border-t border-gray-100 flex gap-1.5">
            {committed.size > 0 && (
              <button onClick={handleClear} className="flex-1 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Xoá</button>
            )}
            <button onClick={handleApply}
              className="flex-1 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">
              Lọc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NewReturnPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orders, setOrders]       = useState<Order[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filter option lists loaded from API
  const [customerItems, setCustomerItems] = useState<{ key: string; label: string }[]>([]);
  const [productItems,  setProductItems]  = useState<{ key: string; label: string }[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [productsLoading,  setProductsLoading]  = useState(true);

  // Step 1 filters
  const [search, setSearch]               = useState('');
  const [datePreset, setDatePreset]       = useState('');
  const [customFrom, setCustomFrom]       = useState('');
  const [customTo, setCustomTo]           = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [showDateDrop, setShowDateDrop]   = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [selectedProducts,  setSelectedProducts]  = useState<Set<string>>(new Set());
  const dateDrop = useRef<HTMLDivElement>(null);

  // Step 2 state
  const [lines, setLines]               = useState<ReturnLine[]>([]);
  const [reason, setReason]             = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [notes, setNotes]               = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [documentDate, setDocumentDate]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [stockReceived, setStockReceived] = useState(true);

  // Branch state
  const [branches, setBranches]           = useState<{id: number; name: string}[]>([]);
  const [returnBranchId, setReturnBranchId] = useState<number | ''>('');
  const [returnReasonsList, setReturnReasonsList] = useState<string[]>([]);

  // Exchange (đổi hàng) state
  const [exchangeLines, setExchangeLines] = useState<ExchangeLine[]>([]);
  const [exQuery, setExQuery]             = useState('');
  const [exResults, setExResults]         = useState<ProdResult[]>([]);
  const [exSuggestions, setExSuggestions] = useState<ProdResult[]>([]);
  const [exLoading, setExLoading]         = useState(false);
  const [exDropOpen, setExDropOpen]       = useState(false);
  const [exPriceList, setExPriceList]     = useState('retail');
  const [exShowSettings, setExShowSettings] = useState(false);
  const [exVisibleCols, setExVisibleCols] = useState({ image: false, sku: true, unit: true, stock: true, discount: true, tax: false });
  const [exDiscountPopup, setExDiscountPopup] = useState<{id: string; mode: 'percent' | 'amount'} | null>(null);
  const [exEditingPrice, setExEditingPrice] = useState<{id: string; val: string} | null>(null);
  const exDropRef                         = useRef<HTMLDivElement>(null);
  const exSettingsRef                     = useRef<HTMLDivElement>(null);
  const exDebounce                        = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (dateDrop.current && !dateDrop.current.contains(e.target as Node)) setShowDateDrop(false);
      if (exDropRef.current && !exDropRef.current.contains(e.target as Node)) setExDropOpen(false);
      if (exSettingsRef.current && !exSettingsRef.current.contains(e.target as Node)) setExShowSettings(false);
    }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  // Load customers, products (for filters), branches, and exchange suggestions on mount
  useEffect(() => {
    apiFetch('/partners?limit=200')
      .then(res => {
        const list: { id: number; name: string; type?: string }[] =
          Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        setCustomerItems(
          list
            .filter(p => p.type === 'customer' || p.type === 'both')
            .map(p => ({ key: String(p.id), label: p.name }))
        );
      })
      .catch(() => setCustomerItems([]))
      .finally(() => setCustomersLoading(false));

    apiFetch('/products?limit=200')
      .then(res => {
        const list: { id: number; name: string }[] =
          Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        setProductItems(list.map(p => ({ key: String(p.id), label: p.name })));
      })
      .catch(() => setProductItems([]))
      .finally(() => setProductsLoading(false));

    // Branches
    apiFetch('/branches?limit=50')
      .then(res => {
        const list: { id: number; name: string }[] =
          Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        setBranches(list);
      })
      .catch(() => setBranches([]));

    // Return reasons from DB
    cancelReturnReasonsApi.getAll({ type: 'return', active: true })
      .then(list => setReturnReasonsList(list.map(r => r.name)))
      .catch(() => setReturnReasonsList(['Sản phẩm bị lỗi / hỏng', 'Khách hàng đổi ý', 'Khác']));

    // Initial exchange product suggestions (latest 10)
    apiFetch('/products?limit=10&sortBy=createdAt&sortOrder=DESC')
      .then(res => {
        const list: { id: number; code: string; name: string; unit?: string | null; sellingPrice?: number; imageUrl?: string | null; stockQuantity?: number; taxPercent?: number; barcode?: string }[] =
          Array.isArray(res.data) ? res.data : [];
        setExSuggestions(list.map(p => ({ id: p.id, code: p.code, name: p.name, unit: p.unit ?? null, sellingPrice: Number(p.sellingPrice ?? 0), imageUrl: p.imageUrl ?? null, stockQuantity: p.stockQuantity ?? 0, taxPercent: p.taxPercent ?? 0, barcode: p.barcode })));
      })
      .catch(() => setExSuggestions([]));
  }, []);

  // Debounced exchange product search
  useEffect(() => {
    if (exDebounce.current) clearTimeout(exDebounce.current);
    if (!exQuery.trim()) { setExResults([]); return; }
    exDebounce.current = setTimeout(async () => {
      setExLoading(true);
      try {
        const res = await apiFetch(`/products?search=${encodeURIComponent(exQuery)}&limit=10`);
        const list: { id: number; code: string; name: string; unit?: string | null; sellingPrice?: number; imageUrl?: string | null; stockQuantity?: number; taxPercent?: number; barcode?: string }[] =
          Array.isArray(res.data) ? res.data : [];
        setExResults(list.map(p => ({ id: p.id, code: p.code, name: p.name, unit: p.unit ?? null, sellingPrice: Number(p.sellingPrice ?? 0), imageUrl: p.imageUrl ?? null, stockQuantity: p.stockQuantity ?? 0, taxPercent: p.taxPercent ?? 0, barcode: p.barcode })));
      } catch { setExResults([]); }
      setExLoading(false);
    }, 300);
  }, [exQuery]);

  // Load orders — filtered by server-side params + client-side customer/product filter
  const loadOrders = useCallback(async (s = '', df = '', dt = '', custIds?: Set<string>, prodIds?: Set<string>) => {
    setOrderLoading(true);
    try {
      // Build customer/product params
      const custParam = custIds && custIds.size > 0 ? `&customerId=${[...custIds].join(',')}` : '';
      // For products we filter client-side since API doesn't support multi-product filter
      const build = (status: string) =>
        apiFetch(`/orders?limit=100&status=${status}${s ? `&search=${encodeURIComponent(s)}` : ''}${df ? `&dateFrom=${df}` : ''}${dt ? `&dateTo=${dt}` : ''}${custParam}`);
      const [c, p] = await Promise.all([build('completed'), build('processing')]);
      let combined: Order[] = [...(c.data ?? []), ...(p.data ?? [])];
      // Dedup
      const seen = new Set<number>();
      combined = combined.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      // Client-side product filter: keep orders that contain selected product(s)
      if (prodIds && prodIds.size > 0) {
        combined = combined.filter(o =>
          o.items.some(it => it.productId !== null && prodIds.has(String(it.productId)))
        );
      }
      setAllOrders(combined);
      setOrders(combined);
      setOrderError('');
    } catch (e: unknown) { setAllOrders([]); setOrders([]); setOrderError(e instanceof Error ? e.message : 'Không thể tải đơn hàng. Kiểm tra kết nối server.'); }
    setOrderLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  function applySearch(s: string) {
    setSearch(s);
    if (s.length === 0 || s.length > 1) loadOrders(s, dateFrom, dateTo, selectedCustomers, selectedProducts);
  }
  function applyDatePreset(preset: string) {
    setDatePreset(preset);
    if (preset) { const { from, to } = presetToDates(preset); setDateFrom(from); setDateTo(to); loadOrders(search, from, to, selectedCustomers, selectedProducts); }
    else { setDateFrom(''); setDateTo(''); loadOrders(search, '', '', selectedCustomers, selectedProducts); }
    setShowDateDrop(false);
  }
  function applyCustomDate() {
    setDatePreset('custom'); setDateFrom(customFrom); setDateTo(customTo);
    loadOrders(search, customFrom, customTo, selectedCustomers, selectedProducts); setShowDateDrop(false);
  }
  function applyCustomerFilter(next: Set<string>) {
    setSelectedCustomers(next);
    loadOrders(search, dateFrom, dateTo, next, selectedProducts);
  }
  function applyProductFilter(next: Set<string>) {
    setSelectedProducts(next);
    loadOrders(search, dateFrom, dateTo, selectedCustomers, next);
  }
  function clearAllFilters() {
    setSearch(''); setDatePreset(''); setDateFrom(''); setDateTo(''); setCustomFrom(''); setCustomTo('');
    setSelectedCustomers(new Set()); setSelectedProducts(new Set());
    loadOrders('', '', '', new Set(), new Set());
  }

  const hasFilter = datePreset || selectedCustomers.size > 0 || selectedProducts.size > 0;
  const dateLabel = datePreset === 'custom'
    ? `${customFrom}–${customTo}`
    : DATE_PRESETS.find(p => p.key === datePreset)?.label ?? 'Ngày tạo';

  function selectOrder(order: Order) {
    setSelectedOrder(order);
    setLines(order.items.map(it => ({
      orderItemId: it.id, productCode: it.productCode, productName: it.productName, unit: it.unit,
      maxQty: it.quantity, unitPrice: Number(it.unitPrice),
      quantity: 1, refundAmount: Number(it.unitPrice),
      condition: 'good', restoreStock: true, itemReason: '', selected: false,
    })));
    setStep(2);
  }

  function updateLine(idx: number, patch: Partial<ReturnLine>) {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, ...patch };
      if (patch.condition === 'damaged') next.restoreStock = false;
      if (patch.condition === 'good' || patch.condition === 'missing_parts') next.restoreStock = stockReceived;
      return next;
    }));
  }

  const selectedLines  = lines.filter(l => l.selected);
  const totalRefund    = selectedLines.reduce((s, l) => s + l.refundAmount * l.quantity, 0);
  const totalExchange  = exchangeLines.reduce((s, l) => s + l.lineTotal, 0);
  const netAmount      = totalRefund - totalExchange;

  function calcExLineTotal(qty: number, price: number, discPct: number, discAmt: number, taxPct: number) {
    const base = qty * price;
    const afterDisc = discAmt > 0 ? Math.max(0, base - discAmt) : base * (1 - discPct / 100);
    return Math.round(afterDisc * (1 + taxPct / 100));
  }

  function addExchangeProduct(p: ProdResult) {
    setExchangeLines(prev => {
      const existing = prev.find(l => l.productId === p.id);
      if (existing) {
        return prev.map(l => l.productId === p.id
          ? { ...l, quantity: l.quantity + 1, lineTotal: calcExLineTotal(l.quantity + 1, l.unitPrice, l.discountPercent, l.discountAmount, l.taxPercent) }
          : l);
      }
      const tax = p.taxPercent ?? 0;
      const lineTotal = calcExLineTotal(1, p.sellingPrice, 0, 0, tax);
      return [...prev, {
        tempId: `ex-${p.id}-${Date.now()}`,
        productId: p.id, productCode: p.code, productName: p.name,
        imageUrl: p.imageUrl ?? null, unit: p.unit,
        quantity: 1, unitPrice: p.sellingPrice,
        discountPercent: 0, discountAmount: 0,
        taxPercent: tax, lineTotal,
        stockQuantity: p.stockQuantity,
      }];
    });
    setExQuery(''); setExResults([]); setExDropOpen(false);
  }

  function updateExLine(tempId: string, patch: Partial<ExchangeLine>) {
    setExchangeLines(prev => prev.map(l => {
      if (l.tempId !== tempId) return l;
      const next = { ...l, ...patch };
      next.lineTotal = calcExLineTotal(next.quantity, next.unitPrice, next.discountPercent, next.discountAmount, next.taxPercent);
      return next;
    }));
  }

  function removeExLine(tempId: string) {
    setExchangeLines(prev => prev.filter(l => l.tempId !== tempId));
    if (exDiscountPopup?.id === tempId) setExDiscountPopup(null);
  }

  function goToStep1() {
    setStep(1);
    setExchangeLines([]);
    setExQuery('');
    setExResults([]);
    setExDropOpen(false);
    setExShowSettings(false);
  }

  function toggleStockReceived(received: boolean) {
    setStockReceived(received);
    setLines(prev => prev.map(l => ({
      ...l,
      restoreStock: received ? l.condition !== 'damaged' : false,
    })));
  }

  async function handleSubmit() {
    if (selectedLines.length === 0) { setError('Vui lòng chọn ít nhất 1 sản phẩm để trả'); return; }
    if (!reason) { setError('Vui lòng chọn lý do trả hàng'); return; }
    setSaving(true); setError('');
    try {
      const ret = await returnsApi.create({
        orderId: selectedOrder!.id, refundMethod, reason, notes: notes || undefined,
        returnBranchId: returnBranchId || undefined,
        referenceCode: referenceCode || undefined,
        documentDate: documentDate || undefined,
        items: selectedLines.map(l => ({
          orderItemId: l.orderItemId, quantity: l.quantity, refundAmount: l.refundAmount * l.quantity,
          condition: l.condition, restoreStock: l.restoreStock, itemReason: l.itemReason || undefined,
        })),
        exchangeItems: exchangeLines.length > 0 ? exchangeLines.map(e => ({
          productId: e.productId, productCode: e.productCode, productName: e.productName,
          unit: e.unit ?? undefined, quantity: e.quantity, unitPrice: e.unitPrice,
          discountAmount: e.discountAmount, taxPercent: e.taxPercent, lineTotal: e.lineTotal,
        })) : undefined,
      });
      router.push(`/dashboard/returns/${ret.id}`);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Lỗi khi tạo phiếu trả'); setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center gap-3 flex-shrink-0">
        <Link href="/dashboard/returns"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Tạo phiếu trả hàng</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Bước {step}/2 — {step === 1 ? 'Chọn đơn hàng gốc' : `Đơn ${selectedOrder?.code} · Chọn sản phẩm cần trả`}
          </p>
        </div>
        {step === 2 && (
          <button onClick={goToStep1} className="ml-auto px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
            ← Chọn đơn khác
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {/* ══════════════ BƯỚC 1 ══════════════ */}
        {step === 1 && (
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input value={search} onChange={e => applySearch(e.target.value)}
                  placeholder="Tìm theo mã đơn hàng, tên, SĐT khách hàng"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"/>
              </div>

              {/* Date preset dropdown */}
              <div ref={dateDrop} className="relative">
                <button onClick={() => setShowDateDrop(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition whitespace-nowrap ${
                    datePreset ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {dateLabel}{datePreset && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>}
                  <svg className={`w-3 h-3 transition-transform ${showDateDrop ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {showDateDrop && (
                  <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-3" style={{ minWidth: '280px' }}>
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      {DATE_PRESETS.map(p => (
                        <button key={p.key} onClick={() => applyDatePreset(p.key)}
                          className={`px-2 py-2 text-xs rounded-xl text-center transition ${datePreset === p.key ? 'bg-blue-600 text-white font-semibold' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-2.5">
                      <p className="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wider">Tuỳ chọn khoảng ngày</p>
                      <div className="space-y-1.5 mb-2.5">
                        <div>
                          <label className="text-[10px] text-gray-400 mb-0.5 block">Từ ngày</label>
                          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400"/>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-0.5 block">Đến ngày</label>
                          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400"/>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {datePreset && <button onClick={() => applyDatePreset('')} className="flex-1 py-2 text-xs text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Xoá</button>}
                        <button onClick={applyCustomDate} disabled={!customFrom && !customTo}
                          className="flex-1 py-2 text-xs bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 font-semibold transition">Lọc</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sản phẩm dropdown */}
              <CheckDrop
                label="Sản phẩm"
                committed={selectedProducts}
                items={productItems}
                loading={productsLoading}
                onApply={applyProductFilter}
              />

              {/* Khách hàng dropdown */}
              <CheckDrop
                label="Khách hàng"
                committed={selectedCustomers}
                items={customerItems}
                loading={customersLoading}
                onApply={applyCustomerFilter}
              />

              {/* Clear */}
              {hasFilter && (
                <button onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200 transition">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  Xoá lọc
                </button>
              )}

              <span className="ml-auto text-xs text-gray-400">{orders.length} đơn hàng</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm bg-white">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Mã đơn hàng</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Ngày tạo</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Khách hàng</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Sản phẩm</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Tổng tiền</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orderLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}><td colSpan={7} className="px-5 py-3.5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-full"/>
                      </td></tr>
                    ))
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-16 text-center text-sm">
                      {orderError ? (
                        <div className="text-red-500">
                          <svg className="w-10 h-10 text-red-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div className="mb-2">{orderError}</div>
                          <button onClick={() => loadOrders(search, dateFrom, dateTo, selectedCustomers, selectedProducts)}
                            className="text-xs underline text-red-500 hover:text-red-700">Thử tải lại</button>
                        </div>
                      ) : (
                        <div className="text-gray-400">
                          <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                          </svg>
                          Không tìm thấy đơn hàng phù hợp
                        </div>
                      )}
                    </td></tr>
                  ) : orders.map(o => {
                    const firstItem = o.items[0];
                    const moreItems = o.items.length - 1;
                    return (
                      <tr key={o.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-sm font-semibold text-gray-800">{o.code}</span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmtDt(o.date)}</td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-gray-700 font-medium">{o.customer?.name ?? 'Khách lẻ'}</p>
                          {o.customer?.phone && <p className="text-xs text-gray-400">{o.customer.phone}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600 max-w-[220px]">
                          {firstItem ? (
                            <span className="truncate block">{firstItem.productName}{moreItems > 0 && <span className="text-gray-400 ml-1">+{moreItems} SP</span>}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-800 whitespace-nowrap">{fmt(o.totalAmount)}đ</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            o.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                            {o.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button onClick={() => selectOrder(o)}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors whitespace-nowrap">
                            Đổi trả
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer hint */}
            <div className="bg-white border-t border-gray-100 px-6 py-2.5 text-center">
              <p className="text-xs text-gray-400">Chỉ hiển thị đơn đang xử lý và đã hoàn thành</p>
            </div>
          </div>
        )}

        {/* ══════════════ BƯỚC 2 ══════════════ */}
        {step === 2 && selectedOrder && (
          <div className="flex flex-col h-full">
            {/* Sub-header */}
            {error && (
              <div className="bg-red-50 border-b border-red-200 text-red-600 text-sm px-6 py-2.5 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {error}
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-auto">
              <div className="max-w-5xl mx-auto px-6 py-5 space-y-4">

                {/* ── Row 1: Thông tin phiếu + Thông tin bổ sung ── */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Left 2/3: Thông tin phiếu */}
                  <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      Thông tin phiếu
                    </h2>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Khách hàng</p>
                        <p className="text-sm font-semibold text-blue-600">{selectedOrder.customer?.name ?? 'Khách lẻ'}</p>
                        {selectedOrder.customer?.phone && <p className="text-xs text-gray-400">{selectedOrder.customer.phone}</p>}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Mã đơn hàng gốc</p>
                        <p className="text-sm font-mono font-bold text-gray-800">{selectedOrder.code}</p>
                        <p className={`text-xs font-medium ${selectedOrder.status === 'completed' ? 'text-emerald-600' : 'text-blue-600'}`}>
                          {selectedOrder.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Chi nhánh trả hàng</p>
                        <select value={returnBranchId} onChange={e => setReturnBranchId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 bg-white">
                          <option value="">Chi nhánh mặc định</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Lý do trả hàng <span className="text-red-500">*</span></p>
                        <select value={reason} onChange={e => setReason(e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400 bg-white">
                          <option value="">Chọn lý do...</option>
                          {returnReasonsList.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Right 1/3: Thông tin bổ sung */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      Thông tin bổ sung
                    </h2>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Mã tham chiếu</p>
                      <input value={referenceCode} onChange={e => setReferenceCode(e.target.value)}
                        placeholder="Mã hóa đơn, số chứng từ..."
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400"/>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Ngày chứng từ</p>
                      <input type="date" value={documentDate} onChange={e => setDocumentDate(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-400"/>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Ghi chú</p>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                        placeholder="Ghi chú thêm về phiếu trả..."
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"/>
                    </div>
                  </div>
                </div>

                {/* ── Row 2: Sản phẩm trả ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                      Sản phẩm trả
                    </h2>
                    <span className="text-xs text-gray-400">{selectedLines.length} / {lines.length} sản phẩm được chọn</span>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="w-10 px-4 py-3">
                          <input type="checkbox"
                            checked={lines.length > 0 && lines.every(l => l.selected)}
                            onChange={e => setLines(prev => prev.map(l => ({ ...l, selected: e.target.checked })))}
                            className="w-3.5 h-3.5 accent-blue-600"/>
                        </th>
                        <th className="text-left px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                        <th className="text-center px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-20">ĐVT</th>
                        <th className="text-center px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-36">Số lượng trả</th>
                        <th className="text-right px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Đơn giá gốc</th>
                        <th className="text-right px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Đơn giá trả</th>
                        <th className="text-right px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Thành tiền</th>
                        <th className="text-center px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-36">Tình trạng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lines.map((line, idx) => (
                        <tr key={line.orderItemId} className={`transition-colors ${line.selected ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}>
                          <td className="px-4 py-3 text-center">
                            <input type="checkbox" checked={line.selected}
                              onChange={e => updateLine(idx, { selected: e.target.checked })}
                              className="w-3.5 h-3.5 accent-blue-600"/>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-sm font-medium text-gray-800 leading-snug">{line.productName}</p>
                            <p className="text-xs text-gray-400 font-mono">{line.productCode}</p>
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-gray-500">{line.unit ?? '—'}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => updateLine(idx, { quantity: Math.max(line.selected ? 1 : 0, line.quantity-1) })}
                                className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0 disabled:opacity-30"
                                disabled={!line.selected}>−</button>
                              <span className="text-sm font-semibold text-gray-700 w-8 text-center">{line.quantity}</span>
                              <button onClick={() => updateLine(idx, { quantity: Math.min(line.maxQty, line.quantity+1) })}
                                className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0 disabled:opacity-30"
                                disabled={!line.selected}>+</button>
                              <span className="text-xs text-gray-400 ml-1">/ {line.maxQty}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-sm text-gray-500">{fmt(line.unitPrice)}</td>
                          <td className="px-3 py-3 text-right">
                            <input type="number" min={0} value={line.refundAmount}
                              onChange={e => updateLine(idx, { refundAmount: Math.max(0, parseInt(e.target.value)||0) })}
                              disabled={!line.selected}
                              className="w-full text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400"/>
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-gray-800">
                            {line.selected ? `${fmt(line.refundAmount * line.quantity)}` : '—'}
                          </td>
                          <td className="px-3 py-3">
                            <select value={line.condition}
                              onChange={e => updateLine(idx, { condition: e.target.value as ReturnLine['condition'] })}
                              disabled={!line.selected}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400">
                              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Table footer */}
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <span className="text-xs text-gray-400">
                      Số lượng trả: <span className="font-semibold text-gray-600">{selectedLines.reduce((s,l)=>s+l.quantity,0)} cái / {selectedLines.length} sản phẩm</span>
                    </span>
                    <span className="text-xs text-gray-400">
                      Cần hoàn tiền trả hàng: <span className="font-bold text-red-600">{fmt(totalRefund)}đ</span>
                    </span>
                  </div>
                </div>

                {/* ── Row 3: Nhận hàng trả lại ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        Nhận hàng trả lại
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {stockReceived
                          ? 'Hàng trả sẽ được nhập lại vào kho sau khi duyệt phiếu'
                          : 'Bạn cần thực hiện nhận hàng trả lại thủ công sau khi tạo phiếu'}
                      </p>
                    </div>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold flex-shrink-0">
                      <button
                        onClick={() => toggleStockReceived(true)}
                        className={`px-4 py-2 transition-colors ${stockReceived ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                        Đã nhận &amp; nhập kho
                      </button>
                      <button
                        onClick={() => toggleStockReceived(false)}
                        className={`px-4 py-2 border-l border-gray-200 transition-colors ${!stockReceived ? 'bg-gray-100 text-gray-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
                        Chưa nhận hàng
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Row 4: Đổi hàng ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  {/* Header */}
                  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                      Đổi hàng
                    </h2>
                    <div className="flex items-center gap-2 ml-auto">
                      {/* Price list selector */}
                      <select value={exPriceList} onChange={e => setExPriceList(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400 bg-white text-gray-600">
                        <option value="retail">Giá bán lẻ</option>
                        <option value="wholesale">Giá bán buôn</option>
                      </select>
                      {/* Settings gear */}
                      <div ref={exSettingsRef} className="relative">
                        <button onClick={() => setExShowSettings(p => !p)}
                          className={`p-1.5 rounded-lg border transition-colors ${exShowSettings ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        </button>
                        {exShowSettings && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4 w-52">
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">Cột hiển thị</p>
                            {([
                              { key: 'image',    label: 'Ảnh sản phẩm' },
                              { key: 'sku',      label: 'Mã SKU' },
                              { key: 'unit',     label: 'Đơn vị tính' },
                              { key: 'stock',    label: 'Tồn kho' },
                              { key: 'discount', label: 'Chiết khấu %' },
                              { key: 'tax',      label: 'Thuế %' },
                            ] as { key: keyof typeof exVisibleCols; label: string }[]).map(col => (
                              <label key={col.key} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
                                <input type="checkbox" checked={exVisibleCols[col.key]}
                                  onChange={e => setExVisibleCols(p => ({ ...p, [col.key]: e.target.checked }))}
                                  className="w-3.5 h-3.5 accent-blue-600"/>
                                <span className="text-sm text-gray-600 group-hover:text-gray-800">{col.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="px-5 py-3 border-b border-gray-100" ref={exDropRef}>
                    <div className="relative">
                      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:border-blue-400 bg-white">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input
                          value={exQuery}
                          onChange={e => setExQuery(e.target.value)}
                          onFocus={() => setExDropOpen(true)}
                          onKeyDown={async e => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            if (!exQuery.trim()) return;
                            if (exDebounce.current) clearTimeout(exDebounce.current);
                            setExLoading(true);
                            try {
                              const exact = await apiFetch(`/products?barcode=${encodeURIComponent(exQuery.trim())}&limit=1`);
                              const hit = Array.isArray(exact.data) ? exact.data[0] : null;
                              if (hit) {
                                addExchangeProduct({ id: hit.id, code: hit.code, name: hit.name, unit: hit.unit ?? null, sellingPrice: Number(hit.sellingPrice ?? 0), imageUrl: hit.imageUrl ?? null, stockQuantity: hit.stockQuantity ?? 0, taxPercent: hit.taxPercent ?? 0, barcode: hit.barcode });
                                setExQuery(''); setExResults([]); setExDropOpen(false);
                                setExLoading(false); return;
                              }
                            } catch { /**/ }
                            const list = exQuery ? exResults : exSuggestions;
                            if (list.length > 0) {
                              addExchangeProduct(list[0]);
                              setExQuery(''); setExResults([]); setExDropOpen(false);
                            }
                            setExLoading(false);
                          }}
                          placeholder="Tìm sản phẩm đổi hoặc quét barcode... (Enter để thêm nhanh)"
                          className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"/>
                        {exLoading && <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                        {exQuery && <button onClick={() => { setExQuery(''); setExResults([]); }} className="text-gray-300 hover:text-gray-500 p-0.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>}
                      </div>
                      {/* Dropdown - shows suggestions on focus or results on search */}
                      {exDropOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-72 overflow-y-auto">
                          {(() => {
                            const list = exQuery ? exResults : exSuggestions;
                            if (exLoading) return <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2"><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Đang tìm...</div>;
                            if (!list.length) return <div className="px-4 py-3 text-sm text-gray-400">Không tìm thấy sản phẩm</div>;
                            return (<>
                              {!exQuery && <div className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50">Sản phẩm gần đây</div>}
                              {list.map(p => {
                                const stock = p.stockQuantity ?? 0;
                                const outOfStock = stock <= 0;
                                return (
                                  <button key={p.id} onClick={() => addExchangeProduct(p)}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-gray-50 last:border-0 ${outOfStock ? 'opacity-60 hover:bg-red-50' : 'hover:bg-blue-50'}`}>
                                    {exVisibleCols.image && (
                                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">SP</div>}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-xs text-gray-400 font-mono">{p.code}{p.unit ? ` · ${p.unit}` : ''}</p>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[11px] font-medium ${outOfStock ? 'text-red-500' : stock <= 5 ? 'text-orange-500' : 'text-emerald-600'}`}>
                                            {outOfStock ? '⚠ Hết hàng' : `Tồn: ${fmt(stock)}`}
                                          </span>
                                          {p.barcode && <span className="text-[11px] text-gray-400 font-mono">| {p.barcode}</span>}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-sm font-semibold text-blue-600">{fmt(p.sellingPrice)}đ</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </>);
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Exchange product table */}
                  {exchangeLines.length > 0 ? (
                    <div className="overflow-x-auto overflow-y-visible">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-8">STT</th>
                            {exVisibleCols.image && <th className="px-2 py-2.5 w-10"/>}
                            <th className="text-left px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Sản phẩm</th>
                            {exVisibleCols.sku && <th className="text-left px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-24">Mã SKU</th>}
                            {exVisibleCols.unit && <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-16">ĐVT</th>}
                            {exVisibleCols.stock && <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-20">Tồn kho</th>}
                            <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-32">Số lượng</th>
                            <th className="text-right px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Đơn giá</th>
                            {exVisibleCols.discount && <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Chiết khấu</th>}
                            {exVisibleCols.tax && <th className="text-center px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-20">Thuế</th>}
                            <th className="text-right px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Thành tiền</th>
                            <th className="w-8"/>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {exchangeLines.map((line, idx) => (
                            <tr key={line.tempId} className="hover:bg-gray-50/50 group">
                              <td className="px-4 py-3 text-xs text-gray-400 text-center">{idx + 1}</td>
                              {exVisibleCols.image && (
                                <td className="px-2 py-3">
                                  <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden">
                                    {line.imageUrl ? <img src={line.imageUrl} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px]">SP</div>}
                                  </div>
                                </td>
                              )}
                              <td className="px-3 py-3">
                                <p className="text-sm font-medium text-gray-800 leading-snug">{line.productName}</p>
                                {line.stockQuantity !== undefined && line.quantity > line.stockQuantity && (
                                  <p className="text-[11px] text-orange-500 flex items-center gap-1 mt-0.5">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    Vượt tồn kho (còn {line.stockQuantity})
                                  </p>
                                )}
                              </td>
                              {exVisibleCols.sku && <td className="px-3 py-3 text-xs text-gray-400 font-mono">{line.productCode}</td>}
                              {exVisibleCols.unit && <td className="px-3 py-3 text-center text-xs text-gray-500">{line.unit ?? '—'}</td>}
                              {exVisibleCols.stock && (
                                <td className="px-3 py-3 text-center">
                                  {(() => {
                                    const st = exSuggestions.find(p => p.id === line.productId)?.stockQuantity
                                           ?? exResults.find(p => p.id === line.productId)?.stockQuantity;
                                    if (st === undefined) return <span className="text-xs text-gray-300">—</span>;
                                    return <span className={`text-xs font-medium ${st <= 0 ? 'text-red-500' : st <= 5 ? 'text-orange-500' : 'text-emerald-600'}`}>{fmt(st)}</span>;
                                  })()}
                                </td>
                              )}
                              <td className="px-3 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => line.quantity > 1 ? updateExLine(line.tempId, { quantity: line.quantity - 1 }) : removeExLine(line.tempId)}
                                    className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0">−</button>
                                  <input type="text" value={line.quantity}
                                    onChange={e => { const v = parseInt(e.target.value.replace(/\D/g,''))||1; updateExLine(line.tempId, { quantity: Math.max(1, v) }); }}
                                    className="w-10 text-center text-sm border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-blue-400"/>
                                  <button onClick={() => updateExLine(line.tempId, { quantity: line.quantity + 1 })}
                                    className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0">+</button>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <input type="text" inputMode="numeric"
                                  value={exEditingPrice?.id === line.tempId ? exEditingPrice.val : (line.unitPrice === 0 ? '' : fmt(line.unitPrice))}
                                  onFocus={() => setExEditingPrice({ id: line.tempId, val: String(line.unitPrice) })}
                                  onChange={e => {
                                    const raw = e.target.value.replace(/\D/g, '');
                                    setExEditingPrice({ id: line.tempId, val: raw });
                                    updateExLine(line.tempId, { unitPrice: parseInt(raw) || 0 });
                                  }}
                                  onBlur={() => setExEditingPrice(null)}
                                  className="w-full text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400"/>
                              </td>
                              {exVisibleCols.discount && (
                                <td className="px-3 py-3 text-center relative">
                                  {exDiscountPopup?.id === line.tempId ? (
                                    <div className="flex flex-col gap-1.5">
                                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[11px]">
                                        <button onClick={() => setExDiscountPopup(p => p ? { ...p, mode: 'percent' } : null)}
                                          className={`flex-1 py-1 font-semibold ${exDiscountPopup.mode === 'percent' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>%</button>
                                        <button onClick={() => setExDiscountPopup(p => p ? { ...p, mode: 'amount' } : null)}
                                          className={`flex-1 py-1 border-l border-gray-200 font-semibold ${exDiscountPopup.mode === 'amount' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>đ</button>
                                      </div>
                                      <input autoFocus type="text" inputMode="numeric"
                                        value={exDiscountPopup.mode === 'percent' ? line.discountPercent : line.discountAmount}
                                        onChange={e => {
                                          const v = parseInt(e.target.value.replace(/\D/g,''))||0;
                                          if (exDiscountPopup!.mode === 'percent') {
                                            updateExLine(line.tempId, { discountPercent: Math.min(100, v), discountAmount: 0 });
                                          } else {
                                            updateExLine(line.tempId, { discountAmount: v, discountPercent: 0 });
                                          }
                                        }}
                                        onBlur={() => setExDiscountPopup(null)}
                                        className="w-full text-sm text-center border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"/>
                                    </div>
                                  ) : (
                                    <button onClick={() => setExDiscountPopup({ id: line.tempId, mode: line.discountPercent > 0 ? 'percent' : 'amount' })}
                                      className="text-sm text-gray-500 hover:text-blue-600 hover:underline px-2 py-1 rounded transition-colors">
                                      {line.discountAmount > 0 ? `${fmt(line.discountAmount)}đ` : line.discountPercent > 0 ? `${line.discountPercent}%` : '0%'}
                                    </button>
                                  )}
                                </td>
                              )}
                              {exVisibleCols.tax && (
                                <td className="px-3 py-3 text-center">
                                  <button onClick={() => {
                                    const next = line.taxPercent === 0 ? 10 : line.taxPercent === 10 ? 8 : 0;
                                    updateExLine(line.tempId, { taxPercent: next });
                                  }} className="text-xs text-gray-500 hover:text-blue-600 hover:underline px-2 py-1 rounded transition-colors">
                                    {line.taxPercent > 0 ? `${line.taxPercent}%` : '0%'}
                                  </button>
                                </td>
                              )}
                              <td className="px-3 py-3 text-right text-sm font-semibold text-gray-800">
                                {fmt(line.lineTotal)}
                              </td>
                              <td className="px-2 py-3 text-center">
                                <button onClick={() => removeExLine(line.tempId)}
                                  className="text-gray-200 group-hover:text-gray-400 hover:text-red-400 transition-colors p-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-5 py-7 text-center">
                      <p className="text-sm text-gray-400">Tìm sản phẩm ở trên để thêm vào đơn đổi</p>
                      <p className="text-xs text-gray-300 mt-1">Tuỳ chọn — bỏ qua nếu chỉ hoàn tiền</p>
                    </div>
                  )}

                  {/* Exchange footer */}
                  {exchangeLines.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <span className="text-xs text-gray-400">{exchangeLines.length} sản phẩm · {exchangeLines.reduce((s,l)=>s+l.quantity,0)} cái</span>
                      <span className="text-xs text-gray-500">
                        Tổng tiền đổi hàng: <span className="font-bold text-orange-600">{fmt(totalExchange)}đ</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Row 5: Hoàn tiền ── */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    Hoàn tiền
                  </h2>
                  <div className="max-w-md ml-auto space-y-1.5">
                    <div className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-500">Cần hoàn tiền trả hàng</span>
                      <span className="font-semibold text-gray-800">{fmt(totalRefund)}đ</span>
                    </div>
                    {exchangeLines.length > 0 && (
                      <div className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-500">Khách cần trả đơn đổi</span>
                        <span className="font-semibold text-orange-600">− {fmt(totalExchange)}đ</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-1"/>
                    <div className="flex items-center justify-between text-sm py-1">
                      <span className="font-semibold text-gray-700">
                        {netAmount >= 0 ? 'Tổng tiền cần hoàn trả khách' : 'Khách cần trả thêm'}
                      </span>
                      <span className={`font-bold text-base ${netAmount >= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {fmt(Math.abs(netAmount))}đ
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-500">Phương thức</span>
                      <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-400 bg-white">
                        {REFUND_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    {refundMethod === 'bank_transfer' && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          Tài khoản ngân hàng nhận tiền
                        </div>
                        <select
                          disabled
                          className="w-full text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-400 cursor-not-allowed opacity-70"
                        >
                          <option>-- Chưa có module Tài khoản ngân hàng --</option>
                        </select>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 mb-0.5">Tên ngân hàng</div>
                            <input disabled placeholder="VD: Vietcombank" className="w-full text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-400 cursor-not-allowed opacity-70" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 mb-0.5">Số tài khoản</div>
                            <input disabled placeholder="VD: 0123456789" className="w-full text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-400 cursor-not-allowed opacity-70" />
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-0.5">Chủ tài khoản</div>
                          <input disabled placeholder="VD: NGUYEN VAN A" className="w-full text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-400 cursor-not-allowed opacity-70" />
                        </div>
                        <p className="text-xs text-blue-500 flex items-start gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Sẽ tích hợp tự động từ module <strong>Tài khoản ngân hàng</strong> khi hoàn thiện. Tạm thời nhập thủ công nội dung ghi chú bên dưới.
                        </p>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-1"/>
                    <div className="flex items-center justify-between text-sm py-1">
                      <span className="font-semibold text-gray-700">Còn phải hoàn trả khách</span>
                      <span className={`font-bold text-base ${netAmount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {netAmount >= 0 ? fmt(netAmount) : `+ ${fmt(Math.abs(netAmount))}`}đ
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Fixed bottom bar */}
            <div className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-xs text-gray-400">
                  Trả: {selectedLines.length} SP · {selectedLines.reduce((s,l)=>s+l.quantity,0)} cái
                  {exchangeLines.length > 0 && ` · Đổi: ${exchangeLines.length} SP`}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-red-600">
                    {netAmount >= 0 ? `Hoàn: ${fmt(netAmount)}đ` : `Thu: ${fmt(Math.abs(netAmount))}đ`}
                  </p>
                  {exchangeLines.length > 0 && (
                    <p className="text-xs text-gray-400">({fmt(totalRefund)} − {fmt(totalExchange)})</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={goToStep1}
                  className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
                  ← Chọn đơn khác
                </button>
                <button onClick={handleSubmit} disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
                  {saving ? 'Đang tạo...' : 'Tạo phiếu trả hàng'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

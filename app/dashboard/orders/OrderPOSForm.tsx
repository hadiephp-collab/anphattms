'use client';
// Form tạo đơn hàng — layout giống Sapo: main content cuộn + sidebar sticky

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ordersApi } from '@/lib/orders';
import { productsApi } from '@/lib/products';
import { partnersApi } from '@/lib/partners';
import { employeesApi } from '@/lib/employees';
import { branchesApi, Branch } from '@/lib/branches';
import { getBranchIds } from '@/lib/auth';

interface Product {
  id: number; code: string; name: string; unit?: string;
  barcode?: string; sellingPrice?: number; stockQuantity?: number;
  images?: { id: number; url: string }[];
}
interface Employee { id: number; fullName: string; code: string; isActive: boolean; }
interface Customer { id: number; name: string; phone?: string; code?: string; }
interface CustomerDetail {
  id: number; code: string; name: string; phone?: string; email?: string;
  address?: string; province?: string; taxCode?: string; contactPerson?: string;
  birthday?: string; gender?: string; group?: string;
  rank?: 'new' | 'normal' | 'loyal' | 'vip';
  customerType?: 'individual' | 'business';
  totalDebt: number; totalOrders: number; totalRevenue: number;
  creditLimit: number; paymentTerm?: number;
  bankAccount?: string; bankName?: string; notes?: string;
}
interface OrderItem {
  tempId: string;
  productId: number;
  productCode: string; productName: string; unit: string;
  quantity: number; unitPrice: number;
  discountPercent: number; discountAmount: number;
  taxPercent: number; lineTotal: number;
  stockQty?: number; imageUrl?: string;
  isService?: boolean;
}
interface OrderTab {
  id: string; label: string;
  customerId?: number; customerName?: string; customerPhone?: string;
  shippingAddress?: string;
  assignedToId?: number;
  date: string; deliveryDate: string;
  shippingMethod: 'delivery' | 'pickup' | 'later'; shippingFee: number;
  shipFeeBearer: 'shop' | 'customer';
  discountPercent: number; discountAmount: number;
  notes: string; source: string; tags: string; reference: string;
  items: OrderItem[];
  paidAmount: number; paymentMethod: 'cash' | 'bank_transfer' | 'other';
}

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
const fmtM = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : String(Math.round(n));
const DENOMS = [10000, 20000, 50000, 100000, 200000, 500000];
const fmtDenom = (n: number) => n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}k`;
const uid = () => Math.random().toString(36).slice(2, 8);

const RANK_LABEL: Record<string, string> = { new: 'Mới', normal: 'Thường', loyal: 'Thân thiết', vip: 'VIP' };
const RANK_COLOR: Record<string, string> = {
  new:    'bg-gray-100 text-gray-500',
  normal: 'bg-blue-100 text-blue-600',
  loyal:  'bg-green-100 text-green-600',
  vip:    'bg-amber-100 text-amber-600',
};

function parseVN(s: string): number {
  return parseInt(s.replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;
}

function newTab(idx: number): OrderTab {
  return {
    id: uid(), label: `Đơn ${idx + 1}`,
    date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
    deliveryDate: '', shippingMethod: 'delivery', shippingFee: 0,
    shipFeeBearer: 'customer',
    discountPercent: 0, discountAmount: 0, notes: '',
    source: '', tags: '', reference: '',
    items: [], paidAmount: 0, paymentMethod: 'cash',
  };
}

export default function OrderPOSForm({ mode = 'create', orderId }: { mode?: 'create' | 'edit'; orderId?: number } = {}) {
  const router = useRouter();

  const [tabs, setTabs] = useState<OrderTab[]>([newTab(0)]);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const tab = tabs[activeTabIdx];

  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [suggestions, setSuggestions]   = useState<Product[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);

  // Product search
  const [productQuery, setProductQuery]     = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [productLoading, setProductLoading]   = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const productDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Customer search
  const [customerQuery, setCustomerQuery]         = useState('');
  const [customerResults, setCustomerResults]     = useState<Customer[]>([]);
  const [showCustomerDrop, setShowCustomerDrop]   = useState(false);
  const [customerLoading, setCustomerLoading]     = useState(false);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<CustomerDetail | null>(null);
  const [loadingCustomerDetail, setLoadingCustomerDetail]   = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);
  const customerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline price/qty edit
  const [editingPrice, setEditingPrice]         = useState<{ id: string; val: string } | null>(null);
  const [editingQty, setEditingQty]             = useState<{ id: string; val: string } | null>(null);
  const [editingPaid, setEditingPaid]           = useState<string | null>(null);
  const [editingShippingFee, setEditingShippingFee] = useState<string | null>(null);

  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [assignedError, setAssignedError] = useState(false);

  // Discount mode (order-level)
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [editingDiscountAmt, setEditingDiscountAmt] = useState<string | null>(null);
  const [showShipFeeInput, setShowShipFeeInput] = useState(false);

  // Per-item discount popup
  const [discountPopup, setDiscountPopup] = useState<{ id: string; mode: 'percent' | 'amount' } | null>(null);

  // Price list selector (UI placeholder — sẽ kết nối Module Bảng Giá khi xây xong)
  const [priceList, setPriceList] = useState<string>('retail');

  // Column config — persist to localStorage
  const [showColConfig, setShowColConfig] = useState(false);
  const COLS_DEFAULT = { image: true, sku: true, unit: false, discount: true, tax: false, stock: false };
  const [visibleCols, setVisibleCols] = useState<typeof COLS_DEFAULT>(COLS_DEFAULT);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('orderVisibleCols');
      if (saved) setVisibleCols(prev => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  }, []);
  const colConfigRef = useRef<HTMLDivElement>(null);

  function toggleCol(key: keyof typeof COLS_DEFAULT, val: boolean) {
    const next = { ...visibleCols, [key]: val };
    setVisibleCols(next);
    try { localStorage.setItem('orderVisibleCols', JSON.stringify(next)); } catch {}
  }

  // Edit mode
  const [editOrderCode, setEditOrderCode] = useState('');
  const [editLoading, setEditLoading]     = useState(mode === 'edit');

  // Branch
  const [branchId, setBranchId] = useState<number | undefined>(undefined);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);

  // Tag chip input
  const [tagInput, setTagInput] = useState('');

  // Confirm modal
  const [showConfirm, setShowConfirm] = useState(false);

  // Quick-add customer modal
  const [showQuickAdd, setShowQuickAdd]   = useState(false);
  const [qaName, setQaName]               = useState('');
  const [qaPhone, setQaPhone]             = useState('');
  const [qaEmail, setQaEmail]             = useState('');
  const [qaSaving, setQaSaving]           = useState(false);
  const [qaError, setQaError]             = useState('');

  // Ref để focus input khách hàng khi click vào card
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Inline address edit
  const [showAddressEdit, setShowAddressEdit] = useState(false);
  const [editingAddress, setEditingAddress]   = useState('');

  useEffect(() => {
    productsApi.getAll({ limit: '8', isSaleable: 'true', sortBy: 'createdAt', sortOrder: 'DESC' })
      .then((res: any) => setSuggestions(res.data ?? res.items ?? []))
      .catch(() => {});
    // Không filter type để lấy cả customer + both
    partnersApi.getAll({ limit: '8', sortBy: 'createdAt', sortOrder: 'DESC' })
      .then((res: any) => setRecentCustomers(res.data ?? res.items ?? []))
      .catch(() => {});
    employeesApi.getAll({ limit: '100', isActive: 'true' })
      .then((res: any) => setEmployees(res.items ?? []))
      .catch(() => {});
    const userBranchIds = getBranchIds();
    if (userBranchIds.length === 1) {
      setBranchId(userBranchIds[0]);
      branchesApi.getAll(true).then(all => {
        const b = all.find(x => x.id === userBranchIds[0]);
        if (b) setAvailableBranches([b]);
      }).catch(() => {});
    } else if (userBranchIds.length > 1) {
      branchesApi.getAll(true).then(all => {
        setAvailableBranches(all.filter(b => userBranchIds.includes(b.id)));
      }).catch(() => {});
    }
  }, []);

  // Load order data khi mode='edit'
  useEffect(() => {
    if (mode !== 'edit' || !orderId) return;
    ordersApi.getOne(orderId).then((order: any) => {
      const discPct = Number(order.discountPercent) || 0;
      const discAmt = Number(order.discountAmount) || 0;
      setTabs(prev => [{
        ...prev[0],
        customerId:     order.customer?.id,
        customerName:   order.customer?.name,
        customerPhone:  order.customer?.phone,
        assignedToId:   order.assignedTo?.id,
        date:           order.date?.slice(0, 10) ?? '',
        deliveryDate:   order.deliveryDate?.slice(0, 10) ?? '',
        shippingMethod: (order.shippingMethod as 'delivery' | 'pickup' | 'later') ?? 'delivery',
        shippingFee:    Number(order.shippingFee) || 0,
        shipFeeBearer:  'customer' as const,
        discountPercent: discPct,
        discountAmount:  discAmt,
        notes:     order.notes ?? '',
        source:    order.source ?? '',
        tags:      order.tags ?? '',
        reference: order.reference ?? '',
        items: (order.items ?? []).map((it: any) => {
          const qty = Number(it.quantity);
          const price = Number(it.unitPrice);
          const dp = Number(it.discountPercent) || 0;
          return {
            tempId: uid(), productId: it.productId,
            productCode: it.productCode, productName: it.productName,
            unit: it.unit ?? '', quantity: qty, unitPrice: price,
            discountPercent: dp, discountAmount: 0, taxPercent: 0,
            lineTotal: Math.round(qty * price * (1 - dp / 100)),
          };
        }),
        paidAmount: 0, paymentMethod: 'cash' as const,
      }]);
      if (discPct > 0) setDiscountMode('percent');
      else if (discAmt > 0) setDiscountMode('amount');
      if (order.customer?.id) {
        partnersApi.getOne(order.customer.id)
          .then((d: any) => setSelectedCustomerDetail(d))
          .catch(() => {});
      }
      setEditOrderCode(order.code);
      setEditLoading(false);
    }).catch(() => setEditLoading(false));
  }, [mode, orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Product search debounce
  useEffect(() => {
    if (productDebounce.current) clearTimeout(productDebounce.current);
    if (!productQuery.trim()) { setProductResults([]); return; }
    productDebounce.current = setTimeout(async () => {
      setProductLoading(true);
      try {
        const res = await productsApi.getAll({ search: productQuery, limit: '8', isSaleable: 'true' });
        setProductResults(res.data ?? []);
      } catch {}
      setProductLoading(false);
    }, 300);
  }, [productQuery]);

  // Customer search debounce
  useEffect(() => {
    if (customerDebounce.current) clearTimeout(customerDebounce.current);
    if (!customerQuery.trim()) { setCustomerResults([]); return; }
    customerDebounce.current = setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const res = await partnersApi.getAll({ search: customerQuery, limit: '8' });
        setCustomerResults(res.data ?? res.items ?? []);
      } catch {}
      setCustomerLoading(false);
    }, 300);
  }, [customerQuery]);

  // Click outside
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (productRef.current && !productRef.current.contains(e.target as Node)) setShowProductDrop(false);
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerDrop(false);
      if (colConfigRef.current && !colConfigRef.current.contains(e.target as Node)) setShowColConfig(false);
      const target = e.target as Element;
      if (!target.closest('[data-discount-popup]')) setDiscountPopup(null);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Tab helpers ───────────────────────────────────────────────────────────────
  function updateTab(patch: Partial<OrderTab>) {
    setTabs(prev => prev.map((t, i) => i === activeTabIdx ? { ...t, ...patch } : t));
  }
  function addTab() {
    const next = newTab(tabs.length);
    setTabs(prev => [...prev, next]);
    setActiveTabIdx(tabs.length);
    setProductQuery('');
  }
  function closeTab(idx: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (tabs.length === 1) return;
    setTabs(prev => prev.filter((_, i) => i !== idx));
    setActiveTabIdx(Math.max(0, idx === activeTabIdx ? idx - 1 : activeTabIdx > idx ? activeTabIdx - 1 : activeTabIdx));
  }

  // ── Customer helpers ──────────────────────────────────────────────────────────
  function selectCustomer(c: Customer) {
    updateTab({ customerId: c.id, customerName: c.name, customerPhone: c.phone });
    setShowCustomerDrop(false);
    setCustomerQuery('');
    setSelectedCustomerDetail(null);
    setShowAddressEdit(false);
    if (c.id > 0) {
      setLoadingCustomerDetail(true);
      partnersApi.getOne(c.id)
        .then((d: any) => {
          setSelectedCustomerDetail(d);
          // Pre-populate shipping address from partner
          const addr = [d.address, d.province].filter(Boolean).join(', ');
          if (addr) updateTab({ shippingAddress: addr });
        })
        .catch(() => {})
        .finally(() => setLoadingCustomerDetail(false));
    }
  }
  function clearCustomer() {
    updateTab({ customerId: undefined, customerName: undefined, customerPhone: undefined, shippingAddress: undefined });
    setCustomerQuery('');
    setSelectedCustomerDetail(null);
    setShowAddressEdit(false);
  }

  // ── Item helpers ──────────────────────────────────────────────────────────────
  function addProduct(product: Product) {
    setShowProductDrop(false);
    setProductQuery('');
    const existing = tab.items.find(it => it.productId === product.id);
    if (existing) {
      updateItem(existing.tempId, { quantity: existing.quantity + 1 });
      return;
    }
    const unitPrice = Number(product.sellingPrice) || 0;
    const stockQty = Math.floor(Number(product.stockQuantity));
    updateTab({ items: [...tab.items, {
      tempId: uid(),
      productId: product.id, productCode: product.code, productName: product.name,
      unit: product.unit ?? '', quantity: 1, unitPrice, discountPercent: 0, discountAmount: 0, taxPercent: 0,
      lineTotal: unitPrice, stockQty, imageUrl: product.images?.[0]?.url,
    }]});
  }
  function updateItem(tempId: string, patch: Partial<OrderItem>) {
    setTabs(prev => prev.map((t, i) => {
      if (i !== activeTabIdx) return t;
      const items = t.items.map(it => {
        if (it.tempId !== tempId) return it;
        const merged = { ...it, ...patch };
        const base = merged.quantity * merged.unitPrice;
        const discounted = merged.discountAmount > 0
          ? Math.max(0, base - merged.discountAmount)
          : base * (1 - (merged.discountPercent ?? 0) / 100);
        merged.lineTotal = Math.round(discounted * (1 + (merged.taxPercent ?? 0) / 100));
        return merged;
      });
      return { ...t, items };
    }));
  }
  function addServiceLine() {
    updateTab({ items: [...tab.items, {
      tempId: uid(), productId: 0, productCode: '', productName: '',
      unit: '', quantity: 1, unitPrice: 0, discountPercent: 0, discountAmount: 0, taxPercent: 0,
      lineTotal: 0, isService: true,
    }]});
  }
  function removeItem(tempId: string) {
    updateTab({ items: tab.items.filter(it => it.tempId !== tempId) });
  }

  // ── Calculations ──────────────────────────────────────────────────────────────
  const subtotal      = tab.items.reduce((s, it) => s + it.lineTotal, 0);
  const orderDiscount    = tab.discountAmount > 0 ? tab.discountAmount : Math.round(subtotal * tab.discountPercent / 100);
  const customerShipFee = tab.shipFeeBearer === 'shop' ? 0 : tab.shippingFee;
  const totalAmount      = Math.max(0, subtotal - orderDiscount + customerShipFee);
  const debtAmount       = Math.max(0, totalAmount - tab.paidAmount);
  const changeAmount     = Math.max(0, tab.paidAmount - totalAmount);

  const displayList   = productQuery ? productResults : suggestions;
  const customerList  = customerQuery ? customerResults : recentCustomers;

  // ── Submit ────────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (tab.items.length === 0) { setError('Chưa có sản phẩm nào'); return; }
    if (!tab.assignedToId) { setAssignedError(true); setError('Vui lòng chọn nhân viên bán hàng'); return; }
    if (debtAmount > 0 && !tab.customerId) {
      setError(`Đơn có công nợ ${fmt(debtAmount)}đ — vui lòng chọn khách hàng để theo dõi`);
      return;
    }
    setAssignedError(false); setError('');
    setShowConfirm(true);
  }

  async function doActualSubmit() {
    setSubmitting(true); setShowConfirm(false);
    const payload = {
      customerId:     (tab.customerId && tab.customerId > 0) ? tab.customerId : undefined,
      branchId:       branchId ?? undefined,
      assignedToId:   tab.assignedToId,
      date:           tab.date || undefined,
      deliveryDate:   tab.deliveryDate || undefined,
      shippingMethod: tab.shippingMethod,
      shippingFee:    tab.shippingFee,
      discountPercent: tab.discountPercent,
      discountAmount:  tab.discountAmount,
      notes:           tab.notes    || undefined,
      source:          tab.source   || undefined,
      tags:            tab.tags     || undefined,
      reference:       tab.reference || undefined,
      shippingAddress: tab.shippingAddress || undefined,
      items: tab.items.map(it => ({
        productId: it.productId > 0 ? it.productId : undefined,
        productName: it.isService ? it.productName : undefined,
        quantity:  it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
        discountAmount: it.discountAmount,
        taxPercent: it.taxPercent,
      })),
    };
    try {
      if (mode === 'edit' && orderId) {
        await ordersApi.update(orderId, payload);
        router.push(`/dashboard/orders/${orderId}`);
      } else {
        const res = await ordersApi.create({
          ...payload,
          initialPayment: tab.paidAmount > 0 ? tab.paidAmount : undefined,
          paymentMethod:  tab.paymentMethod,
        });
        router.push(`/dashboard/orders/${res.id}`);
      }
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  // ── Quick-add customer ────────────────────────────────────────────────────────
  async function handleQuickAdd() {
    if (!qaName.trim()) { setQaError('Vui lòng nhập tên khách hàng'); return; }
    setQaSaving(true); setQaError('');
    try {
      const created: any = await partnersApi.create({
        name: qaName.trim(),
        phone: qaPhone.trim() || undefined,
        email: qaEmail.trim() || undefined,
        type: 'customer',
      });
      selectCustomer({ id: created.id, name: created.name, phone: created.phone });
      // selectCustomer already calls getOne internally
      setShowQuickAdd(false); setQaName(''); setQaPhone(''); setQaEmail('');
      // Refresh recent list
      partnersApi.getAll({ limit: '8', sortBy: 'createdAt', sortOrder: 'DESC' })
        .then((res: any) => setRecentCustomers(res.data ?? res.items ?? [])).catch(() => {});
    } catch (e: any) {
      setQaError(e.message ?? 'Tạo thất bại');
    }
    setQaSaving(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="font-bold text-gray-800 text-base">
              {mode === 'edit' ? `Chỉnh sửa đơn hàng${editOrderCode ? ` — ${editOrderCode}` : ''}` : 'Tạo đơn hàng'}
            </h1>

            {/* Multi-tab — chỉ hiện ở create mode */}
            {mode === 'create' && (
              <div className="flex items-center gap-1 ml-2">
                {tabs.map((t, idx) => (
                  <button key={t.id} onClick={() => setActiveTabIdx(idx)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      idx === activeTabIdx ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {t.label}
                    {tabs.length > 1 && (
                      <span onClick={e => closeTab(idx, e)} className="ml-0.5 hover:text-red-300 font-bold leading-none">×</span>
                    )}
                  </button>
                ))}
                <button onClick={addTab}
                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-sm transition">
                  +
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} disabled={submitting}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              {mode === 'edit' ? 'Hủy' : 'Thoát'}
            </button>
            <button onClick={handleSubmit} disabled={submitting || tab.items.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-sm">
              {submitting ? (mode === 'edit' ? 'Đang lưu...' : 'Đang tạo...') : mode === 'edit' ? 'Lưu thay đổi' : 'Tạo đơn hàng'}
            </button>
          </div>
        </div>
      </div>

      {/* Loading overlay khi đang fetch order để edit */}
      {editLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Body ── */}
      <div className={`p-5 max-w-7xl mx-auto space-y-4 ${editLoading ? 'hidden' : ''}`}>

        {/* ══ Row 1: Khách hàng + Thông tin bổ sung ══ */}
        <div className="flex gap-5 items-start">
          <div className="flex-1 min-w-0">
          {/* ── Thông tin khách hàng ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Thông tin khách hàng</h2>
              {tab.customerId && tab.customerName !== 'Khách vãng lai' && (
                <button onClick={clearCustomer} className="text-xs text-gray-400 hover:text-red-500 transition">Xóa</button>
              )}
            </div>

            {tab.customerId ? (
              /* Customer selected — compact info like Sapo */
              <div>
                {/* Top row: avatar + name/phone + badges + X */}
                <div className="px-4 py-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                    {(tab.customerName ?? 'K').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-blue-700 text-sm leading-tight">{tab.customerName}</span>
                      {tab.customerPhone && <span className="text-xs text-gray-500">· {tab.customerPhone}</span>}
                      {selectedCustomerDetail?.code && (
                        <span className="text-[10px] text-gray-400 font-mono">{selectedCustomerDetail.code}</span>
                      )}
                      {selectedCustomerDetail?.rank && (
                        <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full ${RANK_COLOR[selectedCustomerDetail.rank]}`}>
                          {RANK_LABEL[selectedCustomerDetail.rank]}
                        </span>
                      )}
                    </div>
                    {selectedCustomerDetail?.email && (
                      <p className="text-[11px] text-gray-400 truncate">{selectedCustomerDetail.email}</p>
                    )}
                  </div>
                  <button onClick={clearCustomer} className="text-gray-300 hover:text-red-500 transition p-1 flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Stats + Address in 2-column compact layout */}
                {loadingCustomerDetail ? (
                  <div className="px-4 py-2 text-[11px] text-gray-400 animate-pulse border-t border-gray-100">Đang tải...</div>
                ) : selectedCustomerDetail && tab.customerId !== -1 && (
                  <div className="border-t border-gray-100 flex">
                    {/* LEFT: Address section */}
                    <div className="flex-1 px-4 py-2.5 border-r border-gray-100 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">ĐỊA CHỈ GIAO HÀNG</span>
                        <button
                          onClick={() => { setEditingAddress(tab.shippingAddress ?? ''); setShowAddressEdit(v => !v); }}
                          className="text-[10px] text-blue-500 hover:text-blue-700 font-medium ml-1">
                          {tab.shippingAddress ? 'Thay đổi' : 'Thêm'}
                        </button>
                      </div>
                      {showAddressEdit ? (
                        <div className="mt-1 space-y-1.5">
                          <textarea
                            autoFocus
                            rows={2}
                            value={editingAddress}
                            onChange={e => setEditingAddress(e.target.value)}
                            placeholder="Nhập địa chỉ giao hàng..."
                            className="w-full text-xs border border-blue-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none" />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { updateTab({ shippingAddress: editingAddress.trim() || undefined }); setShowAddressEdit(false); }}
                              className="flex-1 text-[11px] py-1 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
                              Lưu
                            </button>
                            <button
                              onClick={() => setShowAddressEdit(false)}
                              className="flex-1 text-[11px] py-1 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition">
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : tab.shippingAddress ? (
                        <p className="text-[11px] text-gray-600 leading-relaxed">{tab.shippingAddress}</p>
                      ) : (
                        <p className="text-[11px] text-gray-400 italic">Chưa có địa chỉ</p>
                      )}
                      {/* Extra info */}
                      {(selectedCustomerDetail.taxCode || selectedCustomerDetail.contactPerson || selectedCustomerDetail.group) && (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {selectedCustomerDetail.taxCode && (
                            <span className="text-[10px] text-gray-400">MST: <span className="text-gray-600">{selectedCustomerDetail.taxCode}</span></span>
                          )}
                          {selectedCustomerDetail.contactPerson && (
                            <span className="text-[10px] text-gray-400">LH: <span className="text-gray-600">{selectedCustomerDetail.contactPerson}</span></span>
                          )}
                          {selectedCustomerDetail.group && (
                            <span className="text-[10px] text-gray-400">Nhóm: <span className="text-gray-600">{selectedCustomerDetail.group}</span></span>
                          )}
                        </div>
                      )}
                      {selectedCustomerDetail.notes && (
                        <p className="mt-1.5 text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-1">{selectedCustomerDetail.notes}</p>
                      )}
                    </div>

                    {/* RIGHT: Stats */}
                    <div className="w-44 flex-shrink-0 py-2.5 px-3 space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-400">Nợ phải thu</span>
                        <span className={`text-xs font-semibold ${Number(selectedCustomerDetail.totalDebt) > 0 ? 'text-red-500' : 'text-gray-600'}`}>
                          {Number(selectedCustomerDetail.totalDebt) > 0 ? `${fmtM(Number(selectedCustomerDetail.totalDebt))}đ` : '0'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-400">Tổng đơn hàng</span>
                        <span className="text-xs font-semibold text-gray-600">{selectedCustomerDetail.totalOrders}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-400">Doanh thu</span>
                        <span className="text-xs font-semibold text-gray-600">
                          {Number(selectedCustomerDetail.totalRevenue) > 0 ? `${fmtM(Number(selectedCustomerDetail.totalRevenue))}đ` : '0'}
                        </span>
                      </div>
                      {Number(selectedCustomerDetail.creditLimit) > 0 && (
                        <div className="flex justify-between items-baseline border-t border-gray-100 pt-1.5 mt-1">
                          <span className="text-[10px] text-gray-400">Hạn mức</span>
                          <span className="text-xs font-semibold text-gray-600">{fmtM(Number(selectedCustomerDetail.creditLimit))}đ</span>
                        </div>
                      )}
                      {selectedCustomerDetail.paymentTerm && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-gray-400">Hạn TT</span>
                          <span className="text-xs font-semibold text-gray-600">{selectedCustomerDetail.paymentTerm} ngày</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Search section — entire area is clickable */
              <div ref={customerRef} className="relative">
                <div className="px-4 pt-3 pb-2"
                  onClick={() => { customerInputRef.current?.focus(); setShowCustomerDrop(true); }}>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      ref={customerInputRef}
                      value={customerQuery}
                      onChange={e => { setCustomerQuery(e.target.value); setShowCustomerDrop(true); }}
                      onFocus={() => setShowCustomerDrop(true)}
                      placeholder="Tìm theo tên, SĐT, mã khách hàng..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-gray-50 transition" />
                    {customerLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
                  </div>
                </div>

                {/* Dropdown — always visible when focused (not floating) */}
                {showCustomerDrop && (
                  <div className="border-t border-gray-100">
                    {/* Thêm mới */}
                    <button
                      onMouseDown={e => { e.preventDefault(); setShowCustomerDrop(false); setShowQuickAdd(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 text-left border-b border-gray-100 transition">
                      <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg font-bold flex-shrink-0">+</span>
                      <div>
                        <p className="text-sm font-semibold text-green-700">Thêm khách hàng mới</p>
                        <p className="text-[11px] text-gray-400">Tạo nhanh không cần rời trang</p>
                      </div>
                    </button>
                    {/* Khách vãng lai */}
                    <button
                      onMouseDown={e => { e.preventDefault(); updateTab({ customerId: -1 as any, customerName: 'Khách vãng lai', customerPhone: undefined }); setShowCustomerDrop(false); setCustomerQuery(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100 transition">
                      <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-bold flex-shrink-0">?</span>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Khách vãng lai</p>
                        <p className="text-[11px] text-gray-400">Không lưu thông tin khách</p>
                      </div>
                    </button>
                    {/* Label section */}
                    <div className="px-4 py-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                      {customerQuery ? 'Kết quả tìm kiếm' : 'Khách hàng gần đây'}
                    </div>
                    {/* List */}
                    {customerList.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-gray-400 text-center">
                        {customerQuery ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng nào'}
                      </div>
                    ) : (
                      <div className="max-h-52 overflow-y-auto">
                        {customerList.slice(0, 8).map(c => (
                          <button key={c.id}
                            onMouseDown={e => { e.preventDefault(); selectCustomer(c); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition">
                            <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 font-medium truncate">{c.name}</p>
                              {c.phone && <p className="text-[11px] text-gray-400">{c.phone}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!showCustomerDrop && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-400">Bấm vào đây để tìm hoặc thêm khách hàng</p>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>

          {/* ── Thông tin bổ sung (song song với Khách hàng) ── */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Thông tin bổ sung</h3>
              </div>
              {/* Compact inline rows */}
              <div className="divide-y divide-gray-50">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Bán tại</span>
                  {availableBranches.length === 1 ? (
                    <span className="text-xs text-gray-600 flex-1 truncate">{availableBranches[0].name}</span>
                  ) : availableBranches.length > 1 ? (
                    <select value={branchId ?? ''} onChange={e => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
                      className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white focus:ring-1 focus:ring-blue-200">
                      <option value="">— Chọn chi nhánh —</option>
                      {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-400 flex-1">Tất cả chi nhánh</span>
                  )}
                </div>
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Bán bởi <span className="text-red-400">*</span></span>
                  </div>
                  <select value={tab.assignedToId ?? ''}
                    onChange={e => { updateTab({ assignedToId: e.target.value ? Number(e.target.value) : undefined }); setAssignedError(false); }}
                    className={`w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none bg-white focus:ring-1 focus:ring-blue-200 ${assignedError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
                    <option value="">— Chọn nhân viên —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                  </select>
                  {assignedError && <p className="text-[10px] text-red-500 mt-0.5">Bắt buộc chọn nhân viên</p>}
                </div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Nguồn</span>
                  <select value={tab.source} onChange={e => updateTab({ source: e.target.value })}
                    className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white focus:ring-1 focus:ring-blue-200">
                    <option value="">— Không rõ —</option>
                    <option value="counter">Tại quầy</option>
                    <option value="phone">Điện thoại</option>
                    <option value="zalo">Zalo</option>
                    <option value="facebook">Facebook</option>
                    <option value="web">Website</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Ngày đặt</span>
                  <input type="date" value={tab.date} onChange={e => updateTab({ date: e.target.value })}
                    className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-200" />
                </div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Hẹn giao</span>
                  <input type="date" value={tab.deliveryDate} onChange={e => updateTab({ deliveryDate: e.target.value })}
                    className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-200" />
                </div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-[11px] text-gray-400 w-16 flex-shrink-0">Tham chiếu</span>
                  <input value={tab.reference} onChange={e => updateTab({ reference: e.target.value })}
                    placeholder="Mã PO, hóa đơn..."
                    className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none font-mono focus:ring-1 focus:ring-blue-200" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Thông tin sản phẩm (full width) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin sản phẩm</h2>
              <div className="flex items-center gap-2">
                {tab.items.length > 0 && (
                  <span className="text-xs text-gray-400">{tab.items.length} sản phẩm</span>
                )}
                {/* Gear icon — column config */}
                <div className="relative" ref={colConfigRef}>
                  <button
                    onClick={() => setShowColConfig(v => !v)}
                    title="Tùy chỉnh cột hiển thị"
                    className={`p-1.5 rounded-lg transition ${showColConfig ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  {showColConfig && (
                    <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-xl w-52 overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cột hiển thị</span>
                      </div>
                      {([
                        { key: 'image',    label: 'Ảnh sản phẩm' },
                        { key: 'sku',      label: 'Mã SKU' },
                        { key: 'unit',     label: 'Đơn vị tính' },
                        { key: 'stock',    label: 'Tồn kho' },
                        { key: 'discount', label: 'Chiết khấu %' },
                        { key: 'tax',      label: 'Thuế %' },
                      ] as const).map(col => (
                        <label key={col.key} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-50">
                          <input
                            type="checkbox"
                            checked={visibleCols[col.key]}
                            onChange={e => toggleCol(col.key, e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-blue-600" />
                          <span className="text-sm text-gray-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Product search */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100" ref={productRef}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={productQuery}
                    onChange={e => { setProductQuery(e.target.value); setShowProductDrop(true); }}
                    onFocus={() => setShowProductDrop(true)}
                    onKeyDown={async e => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      if (!productQuery.trim()) return;
                      // Exact barcode lookup trước (súng quét không qua debounce)
                      try {
                        const exact = await productsApi.getAll({ barcode: productQuery.trim(), isSaleable: 'true', limit: '1' });
                        if (exact.data?.[0]) { addProduct(exact.data[0]); return; }
                      } catch { /**/ }
                      if (productResults.length > 0) addProduct(productResults[0]);
                    }}
                    placeholder="Tìm theo tên, mã SKU, mã vạch... (Enter để thêm nhanh)"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100" />
                  {productLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}

                  {showProductDrop && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden max-h-64 overflow-y-auto">
                      {!productQuery && (
                        <div className="px-4 py-2 text-[11px] text-gray-400 font-semibold uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                          Sản phẩm mới nhất
                        </div>
                      )}
                      {displayList.length === 0 && productQuery ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Không tìm thấy sản phẩm</div>
                      ) : displayList.map(p => (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 border-b last:border-0 border-gray-50 cursor-pointer group"
                        onClick={() => addProduct(p)}>
                        {/* Thumbnail */}
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                          {p.images?.[0]?.url
                            ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Name + unit + code gộp 1 hàng */}
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 truncate">{p.name}</span>
                            {p.unit && <span className="text-xs text-gray-400">/ {p.unit}</span>}
                            <a
                              href={`/dashboard/products/${p.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-[11px] font-mono text-blue-400 hover:text-blue-600 hover:underline transition"
                              title="Xem chi tiết sản phẩm">
                              {p.code}
                            </a>
                          </div>
                          {/* Stock + barcode */}
                          <div className="flex items-center gap-2">
                            {p.stockQuantity != null && (
                              <span className={`text-[11px] font-medium ${Number(p.stockQuantity) > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                Tồn: {Math.floor(Number(p.stockQuantity))}
                              </span>
                            )}
                            {p.barcode && <span className="text-[11px] text-gray-400 font-mono">| {p.barcode}</span>}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-blue-600 flex-shrink-0">
                          {p.sellingPrice ? fmt(Number(p.sellingPrice)) + 'đ' : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Bảng giá — placeholder, sẽ load từ module Bảng Giá sau khi hoàn thiện */}
              <select
                value={priceList}
                onChange={e => setPriceList(e.target.value)}
                title="Bảng giá áp dụng khi thêm sản phẩm"
                className="text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 text-gray-600 min-w-[130px] flex-shrink-0 cursor-pointer">
                <option value="retail">📋 Giá bán lẻ</option>
                {/* TODO: load danh sách bảng giá từ API /price-lists sau khi hoàn thiện module */}
              </select>
            </div>
          </div>

            {/* Product table */}
            {tab.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <svg className="w-14 h-14 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-400">Tìm và thêm sản phẩm ở ô tìm kiếm trên</p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-center font-medium w-10">STT</th>
                      {visibleCols.image    && <th className="px-2 py-2.5 w-10 text-center text-gray-400">Ảnh</th>}
                      <th className="px-2 py-2.5 text-left font-medium">Tên sản phẩm</th>
                      {visibleCols.sku      && <th className="px-3 py-2.5 text-left font-medium w-28">Mã SKU</th>}
                      {visibleCols.unit     && <th className="px-3 py-2.5 text-left font-medium w-20">ĐVT</th>}
                      {visibleCols.stock    && <th className="px-3 py-2.5 text-right font-medium w-20">Tồn kho</th>}
                      <th className="px-3 py-2.5 text-center font-medium w-32">Số lượng</th>
                      <th className="px-3 py-2.5 text-right font-medium w-36">Đơn giá</th>
                      {visibleCols.discount && <th className="px-3 py-2.5 text-center font-medium w-24">Chiết khấu</th>}
                      {visibleCols.tax      && <th className="px-3 py-2.5 text-center font-medium w-20">Thuế</th>}
                      <th className="px-4 py-2.5 text-right font-medium w-32">Thành tiền</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tab.items.map((it, idx) => (
                      <tr key={it.tempId} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400 text-center">{idx + 1}</td>
                        {visibleCols.image && (
                          <td className="px-2 py-3">
                            <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                              {it.imageUrl
                                ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                              }
                            </div>
                          </td>
                        )}
                        <td className="px-2 py-3">
                          {it.isService ? (
                            <input
                              autoFocus
                              value={it.productName}
                              onChange={e => updateItem(it.tempId, { productName: e.target.value })}
                              placeholder="Tên dịch vụ..."
                              className="w-full text-sm font-medium border border-blue-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
                          ) : (
                            <>
                              <a
                                href={`/dashboard/products/${it.productId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="font-medium text-gray-800 hover:text-blue-600 hover:underline leading-snug transition">
                                {it.productName}
                              </a>
                              {(!visibleCols.sku || !visibleCols.unit) && (
                                <div className="text-[11px] text-gray-400 mt-0.5">
                                  {!visibleCols.sku && (
                                    <a href={`/dashboard/products/${it.productId}`} target="_blank" rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="font-mono hover:text-blue-500 transition">
                                      {it.productCode}
                                    </a>
                                  )}
                                  {!visibleCols.sku && !visibleCols.unit && it.unit ? ' / ' : ''}
                                  {!visibleCols.unit && it.unit}
                                </div>
                              )}
                              {it.stockQty != null && it.quantity > it.stockQty && (
                                <div className="text-[11px] text-red-500 mt-0.5">⚠ Vượt tồn kho (còn {it.stockQty})</div>
                              )}
                            </>
                          )}
                        </td>
                        {visibleCols.sku && (
                          <td className="px-3 py-3 text-xs font-mono">
                            {it.isService
                              ? <span className="text-gray-300 italic">Dịch vụ</span>
                              : <a href={`/dashboard/products/${it.productId}`} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-gray-500 hover:text-blue-500 hover:underline transition">
                                  {it.productCode}
                                </a>
                            }
                          </td>
                        )}
                        {visibleCols.unit && (
                          <td className="px-3 py-3 text-xs text-gray-500">{it.unit || '—'}</td>
                        )}
                        {visibleCols.stock && (
                          <td className="px-3 py-3 text-right">
                            <span className={`text-xs font-medium ${it.stockQty != null && it.quantity > (it.stockQty ?? 0) ? 'text-red-500' : 'text-emerald-600'}`}>
                              {it.stockQty != null ? it.stockQty : '—'}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateItem(it.tempId, { quantity: Math.max(1, it.quantity - 1) })}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition">−</button>
                            <input type="text" inputMode="numeric"
                              value={editingQty?.id === it.tempId ? editingQty.val : it.quantity.toLocaleString('vi-VN')}
                              onFocus={() => setEditingQty({ id: it.tempId, val: String(it.quantity) })}
                              onChange={e => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                setEditingQty({ id: it.tempId, val: raw });
                                updateItem(it.tempId, { quantity: parseInt(raw) || 1 });
                              }}
                              onBlur={() => setEditingQty(null)}
                              className="w-14 text-center text-sm border border-gray-200 rounded py-0.5 focus:outline-none focus:border-blue-300" />
                            <button onClick={() => updateItem(it.tempId, { quantity: it.quantity + 1 })}
                              className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition">+</button>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input type="text" inputMode="numeric"
                            value={editingPrice?.id === it.tempId ? editingPrice.val : (it.unitPrice === 0 ? '' : fmt(it.unitPrice))}
                            placeholder="0"
                            onFocus={() => setEditingPrice({ id: it.tempId, val: it.unitPrice === 0 ? '' : String(it.unitPrice) })}
                            onChange={e => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              setEditingPrice({ id: it.tempId, val: raw });
                              updateItem(it.tempId, { unitPrice: parseInt(raw) || 0 });
                            }}
                            onBlur={() => setEditingPrice(null)}
                            className="w-full text-right text-sm border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-blue-300" />
                        </td>
                        {visibleCols.discount && (
                          <td className="px-3 py-2" data-discount-popup>
                            {discountPopup?.id === it.tempId ? (
                              <div data-discount-popup className="space-y-1">
                                <div className="flex rounded-md border border-gray-200 overflow-hidden text-[10px] font-semibold">
                                  <button
                                    data-discount-popup
                                    onClick={() => setDiscountPopup(p => p ? { ...p, mode: 'percent' } : null)}
                                    className={`flex-1 py-1 transition ${discountPopup.mode === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                                    %
                                  </button>
                                  <button
                                    data-discount-popup
                                    onClick={() => setDiscountPopup(p => p ? { ...p, mode: 'amount' } : null)}
                                    className={`flex-1 py-1 border-l border-gray-200 transition ${discountPopup.mode === 'amount' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                                    đ
                                  </button>
                                </div>
                                <input
                                  data-discount-popup
                                  autoFocus
                                  type="text" inputMode="numeric"
                                  value={discountPopup.mode === 'percent'
                                    ? (it.discountPercent === 0 ? '' : String(it.discountPercent))
                                    : (it.discountAmount === 0 ? '' : fmt(it.discountAmount))}
                                  placeholder="0"
                                  onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                                    if (discountPopup.mode === 'percent') {
                                      updateItem(it.tempId, { discountPercent: Math.min(100, parseFloat(raw) || 0), discountAmount: 0 });
                                    } else {
                                      updateItem(it.tempId, { discountAmount: parseInt(raw.replace(/\./g, '')) || 0, discountPercent: 0 });
                                    }
                                  }}
                                  onKeyDown={e => e.key === 'Enter' && setDiscountPopup(null)}
                                  className="w-full text-center text-sm border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-300" />
                              </div>
                            ) : (
                              <button
                                data-discount-popup
                                onClick={() => setDiscountPopup({ id: it.tempId, mode: it.discountAmount > 0 ? 'amount' : 'percent' })}
                                className="w-full text-center text-sm text-gray-600 border border-gray-200 rounded px-2 py-0.5 hover:border-blue-300 hover:bg-blue-50 transition">
                                {it.discountAmount > 0
                                  ? `${fmt(it.discountAmount)}đ`
                                  : it.discountPercent > 0 ? `${it.discountPercent}%` : '0%'}
                              </button>
                            )}
                          </td>
                        )}
                        {visibleCols.tax && (
                          <td className="px-3 py-3">
                            <select
                              value={it.taxPercent}
                              onChange={e => updateItem(it.tempId, { taxPercent: parseFloat(e.target.value) })}
                              className="w-full text-center text-sm border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-300 bg-white cursor-pointer">
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={8}>8%</option>
                              <option value={10}>10%</option>
                            </select>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(it.lineTotal)}đ</td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => removeItem(it.tempId)} className="text-gray-300 hover:text-red-400 transition p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Add service line */}
                <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
                  <button onClick={addServiceLine}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Thêm dịch vụ
                  </button>
                  <span className="text-xs text-gray-400">Tổng: <span className="font-semibold text-gray-700">{fmt(subtotal)}đ</span></span>
                </div>
              </>
            )}
          </div>

        {/* ══ Row 3: Giao hàng + Thanh toán ══ */}
        <div className="flex gap-5 items-start">
          <div className="flex-1 min-w-0">
          {/* ── Giao hàng + Tags + Ghi chú ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* ── Phương thức giao hàng ── */}
            <div className="px-4 pt-3 pb-2.5">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Phương thức giao hàng</div>
              <div className="flex gap-2">
                {([
                  { key: 'delivery', label: 'Giao vận chuyển',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /> },
                  { key: 'pickup',   label: 'Tự lấy tại cửa hàng',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
                  { key: 'later',    label: 'Giao hàng sau',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
                ] as const).map(m => (
                  <button key={m.key}
                    onClick={() => updateTab({ shippingMethod: m.key, shippingFee: m.key === 'pickup' ? 0 : tab.shippingFee })}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition flex-1 justify-center ${
                      tab.shippingMethod === m.key
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                    }`}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">{m.icon}</svg>
                    <span className="leading-tight text-center">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tags + Ghi chú ── */}
            <div className="border-t border-gray-100">
              {/* Tags — chip input kiểu Sapo */}
              {(() => {
                const chips = tab.tags ? tab.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
                function addTag(val: string) {
                  const v = val.trim();
                  if (!v) return;
                  if (!chips.includes(v)) updateTab({ tags: [...chips, v].join(', ') });
                }
                function removeTag(tag: string) {
                  updateTab({ tags: chips.filter(c => c !== tag).join(', ') });
                }
                return (
                  <div className="px-4 py-2.5 border-b border-gray-50">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-semibold text-gray-400 w-16 flex-shrink-0 pt-1.5">Tags</span>
                      <div className="flex-1 flex flex-wrap gap-1.5 items-center min-h-[28px]">
                        {chips.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-100">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)}
                              className="text-blue-400 hover:text-blue-700 leading-none font-bold">×</button>
                          </span>
                        ))}
                        <input
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              addTag(tagInput); setTagInput('');
                            } else if (e.key === 'Backspace' && !tagInput && chips.length > 0) {
                              removeTag(chips[chips.length - 1]);
                            }
                          }}
                          onBlur={() => { if (tagInput.trim()) { addTag(tagInput); setTagInput(''); } }}
                          placeholder={chips.length === 0 ? 'vip, gấp, nội thất... (Enter để thêm)' : ''}
                          className="flex-1 min-w-[100px] text-sm border-0 outline-none bg-transparent placeholder-gray-300 focus:ring-0 py-0.5" />
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Ghi chú — auto-expand */}
              <div className="px-4 py-2.5 flex items-start gap-3">
                <span className="text-xs font-semibold text-gray-400 w-16 flex-shrink-0 pt-1">Ghi chú</span>
                <textarea value={tab.notes}
                  onChange={e => { updateTab({ notes: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                  placeholder="Vd: Hàng tặng kèm gói riêng..."
                  rows={1}
                  className="flex-1 text-sm border-0 outline-none bg-transparent placeholder-gray-300 focus:ring-0 resize-none overflow-hidden"
                  style={{ minHeight: '28px' }} />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}
          </div>

          {/* ── Thanh toán (bên phải giao hàng) ── */}
          <div className="w-80 flex-shrink-0 space-y-4">

          {/* Thanh toán */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Thanh toán</h3>
            </div>

            {/* Summary rows */}
            <div className="divide-y divide-gray-50 text-sm">

              {/* Tổng tiền hàng */}
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-gray-500">Tổng tiền ({tab.items.length} SP)</span>
                <span className="text-gray-700">{fmt(subtotal)}đ</span>
              </div>

              {/* Chiết khấu — click to expand */}
              <div>
                <button
                  className="w-full flex justify-between items-center px-4 py-2.5 hover:bg-gray-50 transition group"
                  onClick={() => setShowDiscountInput(v => !v)}>
                  <span className="text-blue-600 font-medium">Chiết khấu</span>
                  <div className="flex items-center gap-2">
                    {orderDiscount > 0
                      ? <span className="text-green-600 font-medium">−{fmt(orderDiscount)}đ</span>
                      : <span className="text-gray-400 font-normal">0</span>
                    }
                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${showDiscountInput ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {showDiscountInput && (
                  <div className="px-4 pb-3 pt-2 space-y-2 bg-gray-50/70 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                        <button
                          onClick={() => { setDiscountMode('percent'); setEditingDiscountAmt(null); updateTab({ discountAmount: 0 }); }}
                          className={`px-2.5 py-1.5 text-xs font-semibold transition ${discountMode === 'percent' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                          Theo %
                        </button>
                        <button
                          onClick={() => { setDiscountMode('amount'); setEditingDiscountAmt(''); updateTab({ discountPercent: 0 }); }}
                          className={`px-2.5 py-1.5 text-xs font-semibold border-l border-gray-200 transition ${discountMode === 'amount' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                          Theo đ
                        </button>
                      </div>
                      <div className="flex-1 relative">
                        <input type="text" inputMode="numeric"
                          autoFocus
                          value={discountMode === 'percent'
                            ? (tab.discountPercent === 0 ? '' : String(tab.discountPercent))
                            : editingDiscountAmt !== null
                              ? editingDiscountAmt
                              : (tab.discountAmount === 0 ? '' : fmt(tab.discountAmount))}
                          placeholder="0"
                          onFocus={() => {
                            if (discountMode === 'amount')
                              setEditingDiscountAmt(tab.discountAmount === 0 ? '' : String(tab.discountAmount));
                          }}
                          onChange={e => {
                            if (discountMode === 'percent') {
                              const raw = e.target.value.replace(/[^0-9.]/g, '');
                              updateTab({ discountPercent: Math.min(100, parseFloat(raw) || 0), discountAmount: 0 });
                            } else {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              setEditingDiscountAmt(raw);
                              updateTab({ discountAmount: parseInt(raw) || 0, discountPercent: 0 });
                            }
                          }}
                          onBlur={() => setEditingDiscountAmt(null)}
                          onKeyDown={e => e.key === 'Enter' && setShowDiscountInput(false)}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none text-right focus:ring-1 focus:ring-blue-200" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          {discountMode === 'percent' ? '%' : 'đ'}
                        </span>
                      </div>
                    </div>
                    {orderDiscount > 0 && (
                      <p className="text-[11px] text-green-600">
                        Giảm {fmt(orderDiscount)}đ
                        {discountMode === 'percent' && subtotal > 0 ? ` (${tab.discountPercent}% × ${fmt(subtotal)}đ)` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Phí giao hàng — click to expand (chỉ khi Giao vận chuyển) */}
              {tab.shippingMethod === 'delivery' && (
                <div>
                  <button
                    className="w-full flex justify-between items-center px-4 py-2.5 hover:bg-gray-50 transition"
                    onClick={() => setShowShipFeeInput(v => !v)}>
                    <span className="text-blue-600 font-medium">Phí giao hàng</span>
                    <div className="flex items-center gap-2">
                      {tab.shippingFee > 0 ? (
                        tab.shipFeeBearer === 'shop'
                          ? <span className="text-blue-400 text-xs">Shop chịu {fmt(tab.shippingFee)}đ</span>
                          : <span className="text-gray-700">+{fmt(tab.shippingFee)}đ</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${showShipFeeInput ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {showShipFeeInput && (
                    <div className="px-4 pb-3 pt-2 space-y-2 bg-gray-50/70 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        {/* Toggle Khách trả / Shop trả */}
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                          <button
                            onClick={() => updateTab({ shipFeeBearer: 'customer' })}
                            className={`px-2.5 py-1.5 text-xs font-semibold transition ${tab.shipFeeBearer === 'customer' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                            Khách trả
                          </button>
                          <button
                            onClick={() => updateTab({ shipFeeBearer: 'shop' })}
                            className={`px-2.5 py-1.5 text-xs font-semibold border-l border-gray-200 transition ${tab.shipFeeBearer === 'shop' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                            Shop trả
                          </button>
                        </div>
                        {/* Fee input */}
                        <div className="flex-1 relative">
                          <input type="text" inputMode="numeric"
                            autoFocus
                            value={editingShippingFee !== null ? editingShippingFee : (tab.shippingFee === 0 ? '' : fmt(tab.shippingFee))}
                            placeholder="0"
                            onFocus={() => setEditingShippingFee(tab.shippingFee === 0 ? '' : String(tab.shippingFee))}
                            onChange={e => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              setEditingShippingFee(raw);
                              updateTab({ shippingFee: parseInt(raw) || 0 });
                            }}
                            onBlur={() => setEditingShippingFee(null)}
                            onKeyDown={e => e.key === 'Enter' && setShowShipFeeInput(false)}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none text-right focus:ring-1 focus:ring-blue-200 bg-white" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">đ</span>
                        </div>
                      </div>
                      {/* Note */}
                      {tab.shipFeeBearer === 'shop' && tab.shippingFee > 0 && (
                        <p className="text-[11px] text-blue-500">Shop chịu — hạch toán vào chi phí vận chuyển</p>
                      )}
                      {tab.shipFeeBearer === 'customer' && tab.shippingFee > 0 && (
                        <p className="text-[11px] text-gray-400">Cộng {fmt(tab.shippingFee)}đ vào tổng đơn hàng</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Khách phải trả — prominent */}
              <div className="flex justify-between items-center px-4 py-3 bg-blue-50/30">
                <span className="font-bold text-gray-800">Khách phải trả</span>
                <span className="font-bold text-blue-600 text-base">{fmt(totalAmount)}đ</span>
              </div>
            </div>

            {/* Payment input section */}
            <div className="border-t border-gray-200 px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Khách đã trả</span>
                <button onClick={() => { updateTab({ paidAmount: totalAmount }); setEditingPaid(null); }}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium transition">
                  Thu toàn bộ →
                </button>
              </div>

              {/* Payment method */}
              <select value={tab.paymentMethod} onChange={e => updateTab({ paymentMethod: e.target.value as any })}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none bg-white focus:ring-1 focus:ring-blue-200 cursor-pointer">
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                <option value="other">Khác</option>
              </select>

              {/* Bank account placeholder — hiển thị khi chọn chuyển khoản */}
              {tab.paymentMethod === 'bank_transfer' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[11px] text-blue-600 font-medium">Tài khoản nhận tiền</p>
                    <p className="text-[10px] text-blue-400 truncate">Sẽ tự động hiển thị sau khi thiết lập module Tài Khoản NH</p>
                  </div>
                </div>
              )}

              {/* Amount input — full width tránh tràn khung */}
              <input type="text" inputMode="numeric"
                value={editingPaid !== null ? editingPaid : (tab.paidAmount === 0 ? '' : fmt(tab.paidAmount))}
                placeholder="Số tiền khách trả"
                onFocus={() => setEditingPaid(tab.paidAmount === 0 ? '' : String(tab.paidAmount))}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setEditingPaid(raw);
                  updateTab({ paidAmount: parseInt(raw) || 0 });
                }}
                onBlur={() => setEditingPaid(null)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none text-right font-semibold focus:ring-1 focus:ring-blue-200" />

              {/* Denomination chips */}
              <div className="flex flex-wrap gap-1">
                {DENOMS.map(d => (
                  <button key={d}
                    onClick={() => updateTab({ paidAmount: tab.paidAmount + d })}
                    className="py-1 px-2 text-[11px] font-medium bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 rounded-md transition">
                    +{fmtDenom(d)}
                  </button>
                ))}
              </div>

              {/* Debt / Change */}
              {(debtAmount > 0 || changeAmount > 0) && (
                <div className="border-t border-gray-100 pt-2 space-y-1">
                  {debtAmount > 0 && (
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Còn phải trả</span>
                      <span className="text-red-500">{fmt(debtAmount)}đ</span>
                    </div>
                  )}
                  {changeAmount > 0 && (
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-600">Tiền thừa</span>
                      <span className="text-green-600">{fmt(changeAmount)}đ</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit button */}
          <button onClick={handleSubmit} disabled={submitting || tab.items.length === 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition shadow-sm">
            {submitting
              ? (mode === 'edit' ? 'Đang lưu...' : 'Đang tạo...')
              : mode === 'edit'
                ? 'Lưu thay đổi'
                : tab.paidAmount > 0
                  ? `Tạo đơn + Thu ${fmt(tab.paidAmount)}đ`
                  : `Tạo đơn hàng (Nợ ${fmt(totalAmount)}đ)`}
          </button>
          {tab.items.length === 0 && (
            <p className="text-center text-xs text-gray-400 -mt-2">Thêm ít nhất 1 sản phẩm để tạo đơn</p>
          )}
          </div>
        </div>
      </div>

      {/* ══ Confirm modal ══ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-base font-bold text-gray-800 mb-1">Xác nhận tạo đơn hàng</h2>
              <p className="text-xs text-gray-500">Kiểm tra lại thông tin trước khi hoàn tất</p>
            </div>
            <div className="px-6 pb-2 space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Khách hàng</span>
                <span className="font-medium text-gray-800 text-right max-w-[180px] truncate">
                  {tab.customerName ?? 'Khách vãng lai'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Số sản phẩm</span>
                <span className="font-medium">{tab.items.length} sản phẩm</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Tổng tiền hàng</span>
                <span className="font-medium">{fmt(subtotal)}đ</span>
              </div>
              {tab.shippingFee > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Phí giao hàng</span>
                  <span className="font-medium">{fmt(tab.shippingFee)}đ</span>
                </div>
              )}
              {orderDiscount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Chiết khấu</span>
                  <span className="font-medium text-green-600">-{fmt(orderDiscount)}đ</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-700 font-semibold">Tổng cộng</span>
                <span className="font-bold text-blue-600 text-base">{fmt(totalAmount)}đ</span>
              </div>
              {tab.paidAmount > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Khách đã trả</span>
                  <span className="font-semibold text-green-600">{fmt(tab.paidAmount)}đ</span>
                </div>
              )}
              {debtAmount > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Còn phải trả</span>
                  <span className="font-semibold text-red-500">{fmt(debtAmount)}đ</span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                Kiểm tra lại
              </button>
              <button onClick={doActualSubmit}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm">
                Xác nhận tạo đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Quick-add customer modal ══ */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-800">Thêm khách hàng mới</h2>
              <p className="text-xs text-gray-500 mt-0.5">Tạo nhanh — không cần rời khỏi đơn hàng</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Tên khách hàng <span className="text-red-500">*</span>
                </label>
                <input
                  autoFocus
                  value={qaName}
                  onChange={e => setQaName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                  placeholder="Nhập tên khách hàng"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Số điện thoại</label>
                <input
                  value={qaPhone}
                  onChange={e => setQaPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                  placeholder="Nhập số điện thoại"
                  type="tel"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <input
                  value={qaEmail}
                  onChange={e => setQaEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
                  placeholder="Nhập email (không bắt buộc)"
                  type="email"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition" />
              </div>
              {qaError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{qaError}</p>
              )}
            </div>
            <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
              <button onClick={() => { setShowQuickAdd(false); setQaName(''); setQaPhone(''); setQaEmail(''); setQaError(''); }}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                Hủy
              </button>
              <button onClick={handleQuickAdd} disabled={qaSaving || !qaName.trim()}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl transition shadow-sm">
                {qaSaving ? 'Đang lưu...' : 'Tạo & chọn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

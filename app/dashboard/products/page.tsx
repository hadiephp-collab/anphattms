'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/products';
import ImportModal from './ImportModal';
import { localDateStr } from '@/lib/utils';

interface Product {
  id: number; code: string; name: string;
  nameChinese?: string; nameEnglish?: string;
  category?: string; brand?: string; unit?: string;
  sellingPrice?: number; costPrice?: number;
  costPriceCny?: number; customsUsdPrice?: number;
  stockQuantity?: number; warehouseLocation?: string;
  supplierCode?: string; packagingInfo?: string;
  importNotes?: string; hsCode?: string;
  customsName?: string; customsDescription?: string;
  imageUrl?: string; barcode?: string; tags?: string[];
  hasVariants: boolean; isSaleable: boolean; isActive: boolean;
  images?: { id: number; url: string; isMain: boolean }[];
  variants?: { id: number }[];
  priority?: number | null;
}
interface Stats { total: number; withVariants: number; outOfStock: number; lowStock: number; }
interface ColDef { key: string; label: string; required?: boolean; }
interface ColItem { key: string; visible: boolean; displayType?: 'truncate' | 'clamp' | 'wrap'; pinned?: boolean; }

const fmt = (n?: number | null) => n != null ? Number(n).toLocaleString('vi-VN') + 'đ' : '—';
const dash = <span className="text-gray-200">—</span>;

const ALL_COLS: ColDef[] = [
  { key: 'code',               label: 'Mã hàng',           required: true },
  { key: 'name',               label: 'Tên sản phẩm',       required: true },
  { key: 'image',              label: 'Ảnh',                required: true },
  { key: 'nameChinese',        label: 'Tên tiếng Trung' },
  { key: 'nameEnglish',        label: 'Tên tiếng Anh' },
  { key: 'brand',              label: 'Thương hiệu' },
  { key: 'category',           label: 'Danh mục' },
  { key: 'unit',               label: 'ĐVT' },
  { key: 'costPriceCny',       label: 'Giá nhập (¥CNY)' },
  { key: 'costPrice',          label: 'Giá vốn (₫)' },
  { key: 'sellingPrice',       label: 'Giá bán' },
  { key: 'supplierCode',       label: 'Mã hàng NCC' },
  { key: 'packagingInfo',      label: 'Đóng gói' },
  { key: 'stock',              label: 'Tồn kho' },
  { key: 'warehouseLocation',  label: 'Vị trí kho' },
  { key: 'hsCode',             label: 'Mã HS' },
  { key: 'customsName',        label: 'Tên khai HQ' },
  { key: 'customsUsdPrice',    label: 'Giá USD HQ' },
  { key: 'customsDescription', label: 'Mô tả khai HQ' },
  { key: 'importNotes',        label: 'Lưu ý nhập hàng' },
  { key: 'barcode',            label: 'Mã vạch' },
  { key: 'priority',           label: 'Ưu tiên' },
  { key: 'variants',           label: 'Biến thể' },
  { key: 'status',             label: 'Trạng thái' },
];

const DEFAULT_VISIBLE = new Set([
  'image', 'code', 'name', 'nameChinese', 'brand', 'category', 'unit',
  'costPriceCny', 'costPrice', 'stock', 'priority', 'status',
]);

const STORAGE_KEY = 'products_col_order_v8';

// Các cột text — hiện toggle kiểu hiển thị trong Column Manager
const TEXT_DISPLAY_COLS = new Set([
  'name', 'nameChinese', 'nameEnglish',
  'brand', 'category', 'unit', 'warehouseLocation', 'customsName', 'hsCode',
  'packagingInfo', 'customsDescription', 'importNotes',
]);
const NUMERIC_EDIT_FIELDS = new Set(['stockQuantity', 'costPriceCny', 'costPrice', 'sellingPrice', 'customsUsdPrice']);
const STICKY_WIDTHS: Record<string, number> = {
  code: 110, name: 200, image: 64, brand: 130, category: 130, unit: 80,
  status: 110, stock: 100, sellingPrice: 120, costPrice: 110, costPriceCny: 120,
  nameChinese: 140, nameEnglish: 140, variants: 80, supplierCode: 110, priority: 108,
};

const DEFAULT_DISPLAY: Record<string, 'truncate' | 'clamp' | 'wrap'> = {
  name: 'truncate',
  nameChinese: 'wrap',
  nameEnglish: 'wrap',
  brand: 'truncate',
  category: 'truncate',
  unit: 'truncate',
  warehouseLocation: 'truncate',
  customsName: 'truncate',
  hsCode: 'truncate',
  packagingInfo: 'clamp',
  customsDescription: 'clamp',
  importNotes: 'clamp',
};

function defaultColOrder(): ColItem[] {
  return ALL_COLS.map((c) => ({
    key: c.key,
    visible: DEFAULT_VISIBLE.has(c.key) || !!c.required,
    ...(DEFAULT_DISPLAY[c.key] ? { displayType: DEFAULT_DISPLAY[c.key] as ColItem['displayType'] } : {}),
  }));
}

function loadColOrder(): ColItem[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const saved = JSON.parse(s) as ColItem[];
      const savedKeys = new Set(saved.map((c) => c.key));
      const valid = saved.filter((c) => ALL_COLS.some((a) => a.key === c.key));
      ALL_COLS.forEach((c) => {
        if (!savedKeys.has(c.key)) valid.push({ key: c.key, visible: DEFAULT_VISIBLE.has(c.key) });
      });
      return valid;
    }
    // Migrate from old format (Set-based)
    const old = localStorage.getItem('products_cols');
    if (old) {
      const oldVisible = new Set<string>(JSON.parse(old));
      return ALL_COLS.map((c) => ({ key: c.key, visible: oldVisible.has(c.key) || !!c.required }));
    }
  } catch {}
  return defaultColOrder();
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, withVariants: 0, outOfStock: 0, lowStock: 0 });
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState<20 | 50 | 100>(20);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('true');
  const [sortBy, setSortBy] = useState('priority');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollLeft = useRef(0);
  const [colOrder, setColOrder] = useState<ColItem[]>(defaultColOrder());
  const [showColSettings, setShowColSettings] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [expandedCell, setExpandedCell] = useState<{ label: string; text: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: number; field: string; value: string } | null>(null);
  const [filterPriority, setFilterPriority] = useState('');
  const bulkMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setColOrder(loadColOrder()); }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node))
        setBulkMenuOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const visibleCols = colOrder.filter((c) => c.visible);
  const stickyLeft: Record<string, number> = (() => {
    const r: Record<string, number> = {};
    let left = 40;
    for (const col of visibleCols) {
      if (col.pinned) { r[col.key] = left; left += STICKY_WIDTHS[col.key] ?? 130; }
    }
    return r;
  })();

  async function handleExport() {
    setExporting(true);
    try {
      const params: Record<string, string> = { page: '1', limit: '9999', sortBy, sortOrder };
      if (search) params.search = search;
      if (filterCategory) params.category = filterCategory;
      if (filterStatus !== '') params.isActive = filterStatus;
      const res = await productsApi.getAll(params);
      const headers = [
        'Mã', 'Tên sản phẩm', 'Tên tiếng Trung', 'Tên tiếng Anh',
        'Thương hiệu', 'Danh mục', 'ĐVT',
        'Giá nhập (¥)', 'Giá vốn (₫)', 'Giá bán',
        'Mã hàng NCC', 'Đóng gói', 'Tồn kho', 'Vị trí kho',
        'Mã HS', 'Tên khai HQ', 'Giá USD HQ', 'Mô tả khai HQ', 'Lưu ý nhập hàng',
        'Barcode', 'Trạng thái', 'Tags',
      ];
      const rows = res.data.map((p: Product) => [
        p.code, p.name, p.nameChinese || '', p.nameEnglish || '',
        p.brand || '', p.category || '', p.unit || '',
        p.costPriceCny ?? '', p.costPrice ?? '', p.sellingPrice ?? '',
        p.supplierCode || '', p.packagingInfo || '',
        p.stockQuantity ?? 0, p.warehouseLocation || '',
        p.hsCode || '', p.customsName || '', p.customsUsdPrice ?? '', p.customsDescription || '', p.importNotes || '',
        p.barcode || '',
        p.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động',
        (p.tags || []).join('; '),
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `san-pham-${localDateStr()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function handleSaveCols(newOrder: ColItem[]) {
    setColOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    setShowColSettings(false);
  }

  async function saveEdit() {
    if (!editingCell) return;
    const { id, field, value } = editingCell;
    setEditingCell(null);
    const parsed = NUMERIC_EDIT_FIELDS.has(field)
      ? (value.trim() === '' ? null : parseFloat(value.replace(/,/g, '')))
      : (value?.trim() || null);
    try {
      await productsApi.update(id, { [field]: parsed });
      setProducts((prev) => prev.map((p) =>
        p.id === id ? { ...p, [field]: parsed } as Product : p
      ));
    } catch { /* silent */ }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit), sortBy, sortOrder };
      if (search) params.search = search;
      if (filterCategory) params.category = filterCategory;
      if (filterStatus !== '') params.isActive = filterStatus;
      if (filterPriority !== '') params.priority = filterPriority;
      const [res, s, cats] = await Promise.all([
        productsApi.getAll(params),
        productsApi.getStats(),
        productsApi.getCategories(),
      ]);
      setProducts(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
      setStats(s);
      setCategories(cats);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filterCategory, filterStatus, filterPriority, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  function handleSort(field: string) {
    savedScrollLeft.current = tableScrollRef.current?.scrollLeft ?? 0;
    setPage(1);
    if (sortBy === field) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else { setSortBy(field); setSortOrder('DESC'); }
  }

  useEffect(() => {
    if (!loading && savedScrollLeft.current > 0) {
      requestAnimationFrame(() => {
        if (tableScrollRef.current) tableScrollRef.current.scrollLeft = savedScrollLeft.current;
      });
    }
  }, [loading]);

  async function handleDelete(id: number) {
    if (!confirm('Xác nhận xóa sản phẩm này?')) return;
    await productsApi.remove(id);
    load();
  }

  async function handleBulkDelete() {
    if (!confirm(`Xác nhận xóa ${selectedIds.size} sản phẩm đã chọn?`)) return;
    await Promise.all([...selectedIds].map((id) => productsApi.remove(id)));
    setBulkMenuOpen(false);
    load();
  }

  async function handleBulkStatus(isActive: boolean) {
    await Promise.all([...selectedIds].map((id) => productsApi.update(id, { isActive })));
    setBulkMenuOpen(false);
    load();
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === products.length ? new Set() : new Set(products.map((p) => p.id)));
  }

  const thBase = 'text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap';

  function SortTh({ label, field, k, style }: { label: string; field: string; k: string; style?: React.CSSProperties }) {
    const active = sortBy === field;
    return (
      <th key={k} onClick={() => handleSort(field)} style={style}
        className={`${thBase} cursor-pointer select-none hover:text-gray-800 group`}>
        <div className="flex items-center gap-1">
          {label}
          <span className={`flex flex-col leading-none ${active ? 'text-blue-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
            <svg className={`w-2.5 h-2.5 -mb-0.5 ${active && sortOrder === 'ASC' ? 'opacity-100' : 'opacity-40'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0L5 0z" /></svg>
            <svg className={`w-2.5 h-2.5 ${active && sortOrder === 'DESC' ? 'opacity-100' : 'opacity-40'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0H10L5 6z" /></svg>
          </span>
        </div>
      </th>
    );
  }

  function renderHeaderCell(key: string) {
    switch (key) {
      case 'image':   return <th key={key} className={`${thBase} w-12`}>Ảnh</th>;
      case 'code':    return <th key={key} className={thBase}>Mã hàng</th>;
      case 'name':    return <SortTh key={key} k={key} label="Tên sản phẩm" field="name" />;
      case 'nameChinese':    return <th key={key} className={thBase}>Tên T.Trung</th>;
      case 'nameEnglish':    return <th key={key} className={thBase}>Tên T.Anh</th>;
      case 'brand':          return <th key={key} className={thBase}>Thương hiệu</th>;
      case 'category':       return <th key={key} className={thBase}>Danh mục</th>;
      case 'unit':           return <th key={key} className={thBase}>ĐVT</th>;
      case 'costPriceCny':   return <th key={key} className={thBase}>Giá nhập (¥)</th>;
      case 'costPrice':      return <SortTh key={key} k={key} label="Giá vốn" field="costPrice" />;
      case 'sellingPrice':   return <SortTh key={key} k={key} label="Giá bán" field="sellingPrice" />;
      case 'supplierCode':   return <th key={key} className={thBase}>Mã NCC</th>;
      case 'packagingInfo':  return <th key={key} className={thBase}>Đóng gói</th>;
      case 'stock':          return <SortTh key={key} k={key} label="Tồn kho" field="stockQuantity" />;
      case 'warehouseLocation': return <th key={key} className={thBase}>Vị trí kho</th>;
      case 'hsCode':         return <th key={key} className={thBase}>Mã HS</th>;
      case 'customsName':    return <th key={key} className={thBase}>Tên khai HQ</th>;
      case 'customsUsdPrice': return <th key={key} className={thBase}>Giá USD HQ</th>;
      case 'customsDescription': return <th key={key} className={thBase}>Mô tả khai HQ</th>;
      case 'importNotes':    return <th key={key} className={thBase}>Lưu ý nhập</th>;
      case 'barcode':        return <th key={key} className={thBase}>Mã vạch</th>;
      case 'priority':        return <SortTh key={key} k={key} label="Ưu tiên" field="priority" />;
      case 'variants':       return <th key={key} className={thBase}>Biến thể</th>;
      case 'status':         return <th key={key} className={thBase}>Trạng thái</th>;
      default:               return <th key={key} className={thBase} />;
    }
  }

  function getDisplayType(key: string): 'truncate' | 'clamp' | 'wrap' {
    return colOrder.find((c) => c.key === key)?.displayType ?? 'truncate';
  }

  function renderTextCell(
    key: string,
    value: string | null | undefined,
    label: string,
    productId: number,
    textClass = 'text-gray-600',
  ) {
    const dt = getDisplayType(key);

    // Inline edit mode
    if (editingCell?.id === productId && editingCell?.field === key) {
      return (
        <td key={key} className="px-2 py-1.5 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={editingCell.value}
            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
            onBlur={saveEdit}
            className="w-full text-sm border border-blue-400 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
        </td>
      );
    }

    const pencil = (
      <button
        className="opacity-0 group-hover/ec:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all"
        onClick={(e) => { e.stopPropagation(); setEditingCell({ id: productId, field: key, value: value || '' }); }}
        title={`Sửa ${label}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    );

    if (!value) return (
      <td key={key} className="px-4 py-3 group/ec">
        <div className="flex items-center gap-0.5">
          <span className="text-sm text-gray-300 flex-1">—</span>{pencil}
        </div>
      </td>
    );

    if (dt === 'clamp') return (
      <td key={key} className="px-4 py-3 max-w-[200px] group/ec">
        <div className="flex items-start gap-0.5">
          <span
            className={`text-sm ${textClass} block line-clamp-2 whitespace-normal break-words cursor-pointer hover:text-blue-500 transition-colors flex-1`}
            onClick={(e) => { e.stopPropagation(); setExpandedCell({ label, text: value }); }}
          >{value}</span>
          {pencil}
        </div>
      </td>
    );

    if (dt === 'wrap') return (
      <td key={key} className="px-4 py-3 max-w-[200px] group/ec">
        <div className="flex items-start gap-0.5">
          <span className={`text-sm ${textClass} block whitespace-normal break-words flex-1`}>{value}</span>
          {pencil}
        </div>
      </td>
    );

    // truncate
    return (
      <td key={key} className="px-4 py-3 max-w-[180px] group/ec">
        <div className="flex items-center gap-0.5">
          <span className={`text-sm ${textClass} block truncate flex-1`} title={value}>{value}</span>
          {pencil}
        </div>
      </td>
    );
  }

  function renderNumericCell(
    key: string, dbField: string,
    value: number | null | undefined,
    label: string, productId: number,
    displayFn: (v: number) => string,
    cellClass = 'text-gray-600',
  ) {
    if (editingCell?.id === productId && editingCell?.field === dbField) {
      return (
        <td key={key} className="px-2 py-1.5 min-w-[100px]" onClick={(e) => e.stopPropagation()}>
          <input autoFocus type="number" value={editingCell.value}
            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
            onBlur={saveEdit}
            className="w-full text-sm border border-blue-400 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 bg-white text-right" />
        </td>
      );
    }
    const pencil = (
      <button className="opacity-0 group-hover/ec:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all"
        onClick={(e) => { e.stopPropagation(); setEditingCell({ id: productId, field: dbField, value: String(value ?? '') }); }}
        title={`Sửa ${label}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    );
    return (
      <td key={key} className={`px-4 py-3 text-sm ${cellClass} whitespace-nowrap group/ec`}>
        <div className="flex items-center justify-end gap-0.5">
          {pencil}<span>{value != null ? displayFn(value) : dash}</span>
        </div>
      </td>
    );
  }

  async function setPriority(productId: number, value: number) {
    try {
      await productsApi.update(productId, { priority: value });
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, priority: value } as Product : p));
    } catch { /* silent */ }
  }

  function renderBodyCell(key: string, p: Product) {
    const tdBase = 'px-4 py-3 text-sm text-gray-500 whitespace-nowrap';
    switch (key) {
      case 'image': {
        const mainImg = p.images?.find((i) => i.isMain) || p.images?.[0];
        const imgSrc = mainImg?.url || p.imageUrl;
        return (
          <td key={key} className="px-2 py-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-100">
              {imgSrc
                ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                : <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>}
            </div>
          </td>
        );
      }
      case 'code': return (
        <td key={key} className="px-4 py-3">
          <span className="font-mono text-[11px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md tracking-wide">{p.code}</span>
        </td>
      );
      case 'name': return renderTextCell(key, p.name, 'Tên sản phẩm', p.id, 'font-medium text-gray-700');
      case 'nameChinese': return renderTextCell(key, p.nameChinese, 'Tên T.Trung', p.id);
      case 'nameEnglish': return renderTextCell(key, p.nameEnglish, 'Tên T.Anh', p.id, 'text-gray-500 italic');
      case 'brand':    return renderTextCell(key, p.brand, 'Thương hiệu', p.id);
      case 'category': return renderTextCell(key, p.category, 'Danh mục', p.id);
      case 'unit':     return renderTextCell(key, p.unit, 'ĐVT', p.id);
      case 'costPriceCny': return renderNumericCell(key, 'costPriceCny', p.costPriceCny, 'Giá nhập ¥', p.id, (v) => Number(v).toLocaleString('vi-VN'), 'text-amber-600');
      case 'costPrice':    return renderNumericCell(key, 'costPrice', p.costPrice, 'Giá vốn', p.id, (v) => Number(v).toLocaleString('vi-VN') + 'đ', 'text-gray-500');
      case 'sellingPrice': return renderNumericCell(key, 'sellingPrice', p.sellingPrice, 'Giá bán', p.id, (v) => Number(v).toLocaleString('vi-VN'));
      case 'supplierCode': return renderTextCell(key, p.supplierCode, 'Mã NCC', p.id, 'font-mono text-[11px] text-gray-500');
      case 'packagingInfo': return renderTextCell(key, p.packagingInfo, 'Đóng gói', p.id);
      case 'stock': return renderNumericCell(key, 'stockQuantity', p.stockQuantity, 'Tồn kho', p.id, (v) => Number(v).toLocaleString());
      case 'warehouseLocation': return renderTextCell(key, p.warehouseLocation, 'Vị trí kho', p.id);
      case 'hsCode': return renderTextCell(key, p.hsCode, 'Mã HS', p.id, 'text-blue-600 font-mono');
      case 'customsName': return renderTextCell(key, p.customsName, 'Tên khai HQ', p.id);
      case 'customsUsdPrice': return renderNumericCell(key, 'customsUsdPrice', p.customsUsdPrice, 'Giá USD HQ', p.id, (v) => `$${Number(v).toFixed(2)}`, 'text-green-600');
      case 'customsDescription': return renderTextCell(key, p.customsDescription, 'Mô tả khai HQ', p.id, 'text-gray-400');
      case 'importNotes': return renderTextCell(key, p.importNotes, 'Lưu ý nhập hàng', p.id, 'text-gray-400');
      case 'barcode': return renderTextCell(key, p.barcode, 'Mã vạch', p.id, 'font-mono text-[11px] text-gray-500');
      case 'priority': return (
        <td key={key} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {(() => {
              const cp = Math.min(p.priority ?? 0, 2);
              return [1, 2].map((star) => (
                <button key={star}
                  onClick={() => setPriority(p.id, cp === star ? 0 : star)}
                  title={cp >= star ? 'Bỏ ưu tiên' : `Đặt ${star} sao`}
                  className={`w-5 h-5 transition-colors ${cp >= star ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-amber-300'}`}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ));
            })()}
          </div>
        </td>
      );
      case 'variants': return (
        <td key={key} className="px-4 py-3">
          {p.hasVariants
            ? <span className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100 font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                {p.variants?.length || 0}
              </span>
            : dash}
        </td>
      );
      case 'status': return (
        <td key={key} className="px-4 py-3">
          {p.isActive
            ? <span className="text-[11px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">Hoạt động</span>
            : <span className="text-[11px] bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full font-medium">Ngừng</span>}
        </td>
      );
      default: return <td key={key} />;
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight">Sản Phẩm</h1>
          <p className="text-gray-400 text-xs mt-0.5">Quản lý danh mục sản phẩm và thông tin nhập hàng</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Nhập file
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="inline-flex items-center justify-center gap-2 w-[7.5rem] px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
            {exporting
              ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            <span>{exporting ? 'Đang xuất...' : 'Xuất file'}</span>
          </button>
          <button onClick={() => router.push('/dashboard/products/new')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Thêm sản phẩm
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-4 gap-3">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-2 flex-shrink-0">
          {[
            { label: 'Tổng sản phẩm', value: stats.total,
              iconColor: 'text-slate-400', numColor: 'text-slate-700',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
            { label: 'Có biến thể', value: stats.withVariants,
              iconColor: 'text-blue-400', numColor: 'text-blue-600',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" /> },
            { label: 'Hết hàng', value: stats.outOfStock,
              iconColor: 'text-red-400', numColor: 'text-red-600',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" /> },
            { label: 'Sắp hết hàng', value: stats.lowStock,
              iconColor: 'text-amber-400', numColor: 'text-amber-600',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-lg border border-gray-100 shadow-sm flex items-center gap-2.5 px-3 py-2">
              <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0">
                <svg className={`w-3 h-3 ${k.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{k.icon}</svg>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none">{k.label}</p>
                <p className={`text-base font-bold mt-0.5 leading-none ${k.numColor}`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-gray-100">

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="text-sm font-semibold text-blue-700">
                Đã chọn <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-md">{selectedIds.size}</span> sản phẩm
              </span>
              <div className="relative" ref={bulkMenuRef}>
                <button onClick={() => setBulkMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 shadow-sm">
                  Chọn thao tác
                  <svg className={`w-3 h-3 transition-transform ${bulkMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {bulkMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 min-w-[170px]">
                    <button onClick={() => handleBulkStatus(true)} className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Đổi thành Hoạt động
                    </button>
                    <button onClick={() => handleBulkStatus(false)} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      Đổi thành Ngừng
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button onClick={handleBulkDelete} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Xóa đã chọn
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-400 hover:text-blue-600 font-medium">Bỏ chọn</button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
            <button onClick={() => setShowColSettings(true)} title="Điều chỉnh & sắp xếp cột"
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Tên, mã, mã vạch..." value={search}
                onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                className="pl-8 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 bg-gray-50/80 placeholder:text-gray-300" />
            </div>
            <select value={filterCategory} onChange={(e) => { setPage(1); setFilterCategory(e.target.value); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 cursor-pointer">
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => { setPage(1); setFilterStatus(e.target.value); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 cursor-pointer">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đang hoạt động</option>
              <option value="false">Ngừng</option>
            </select>
            <select value={filterPriority} onChange={(e) => { setPage(1); setFilterPriority(e.target.value); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 cursor-pointer">
              <option value="">Tất cả ưu tiên</option>
              <option value="5">★★★★★ 5 sao</option>
              <option value="4">★★★★☆ 4 sao</option>
              <option value="3">★★★☆☆ 3 sao</option>
              <option value="2">★★☆☆☆ 2 sao</option>
              <option value="1">★☆☆☆☆ 1 sao</option>
            </select>
            {(search || filterCategory || filterStatus || filterPriority) && (
              <button onClick={() => { setSearch(''); setFilterCategory(''); setFilterStatus(''); setFilterPriority(''); setPage(1); }}
                className="text-xs text-gray-300 hover:text-red-400 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Xóa lọc
              </button>
            )}
            <span className="ml-auto text-xs text-gray-300">{total} kết quả</span>
          </div>

          {/* Table */}
          <div ref={tableScrollRef} className="flex-1 overflow-auto min-h-0" style={{ isolation: 'isolate' }}>
            <table className="min-w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50/80">
                  <th className="w-10 pl-4 py-3 border-b border-gray-200" style={{ position: 'sticky', left: 0, zIndex: 22, backgroundColor: 'rgb(249 250 251)' }}>
                    <input type="checkbox"
                      checked={products.length > 0 && selectedIds.size === products.length}
                      ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < products.length; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                  </th>
                  {visibleCols.map((col) => {
                    const cell = renderHeaderCell(col.key);
                    const left = stickyLeft[col.key];
                    if (left === undefined) return cell;
                    const orig = (cell as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.style || {};
                    return React.cloneElement(cell as React.ReactElement<React.HTMLAttributes<HTMLElement>>, { style: { ...orig, position: 'sticky', left, zIndex: 21, backgroundColor: 'rgb(249 250 251)', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)', minWidth: STICKY_WIDTHS[col.key] ?? 130, width: STICKY_WIDTHS[col.key] ?? 130 } });
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={1 + visibleCols.length} className="text-center py-14">
                    <div className="inline-flex flex-col items-center gap-2 text-gray-300">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span className="text-xs">Đang tải...</span>
                    </div>
                  </td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={1 + visibleCols.length} className="text-center py-14">
                    <svg className="w-10 h-10 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-gray-300 text-sm">Chưa có sản phẩm nào</p>
                    <button onClick={() => router.push('/dashboard/products/new')}
                      className="mt-2 text-blue-500 text-xs hover:underline font-medium">+ Thêm sản phẩm đầu tiên</button>
                  </td></tr>
                ) : products.map((p) => {
                  const rowBg = selectedIds.has(p.id) ? '#dbeafe' : hoveredRow === p.id ? '#f0f9ff' : '#ffffff';
                  return (
                  <tr key={p.id}
                    onClick={() => router.push(`/dashboard/products/${p.id}`)}
                    onMouseEnter={() => setHoveredRow(p.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    className="transition-colors cursor-pointer">
                    <td className="w-10 pl-4 py-3 border-b border-gray-50" style={{ position: 'sticky', left: 0, zIndex: 9, backgroundColor: rowBg }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                        className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                    </td>
                    {visibleCols.map((col) => {
                      const cell = renderBodyCell(col.key, p);
                      const left = stickyLeft[col.key];
                      const cellEl = cell as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
                      const orig = cellEl.props.style || {};
                      const rowBorder = { borderBottom: '1px solid rgb(249 250 251)' };
                      if (left === undefined) return React.cloneElement(cellEl, { style: { ...orig, ...rowBorder, position: 'relative', zIndex: 0, backgroundColor: rowBg } });
                      const w = STICKY_WIDTHS[col.key] ?? 130;
                      return React.cloneElement(cellEl, { style: { ...orig, position: 'sticky', left, zIndex: 9, backgroundColor: rowBg, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.06)', minWidth: w, width: w, ...rowBorder } });
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Hiển thị</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  {([20, 50, 100] as const).map((n) => (
                    <button key={n} onClick={() => { setLimit(n); setPage(1); }}
                      className={`px-2.5 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${limit === n ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <span>kết quả</span>
              </div>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-400">
                {total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`} trên{' '}
                <span className="font-semibold text-gray-600">{total}</span> sản phẩm
              </span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs">«</button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | 'e')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('e');
                    acc.push(p); return acc;
                  }, [])
                  .map((item, idx) => item === 'e'
                    ? <span key={`e${idx}`} className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">…</span>
                    : <button key={item} onClick={() => setPage(item as number)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page === item ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{item}</button>
                  )}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs">»</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showColSettings && (
        <ColSettingsModal colOrder={colOrder} onSave={handleSaveCols} onClose={() => setShowColSettings(false)} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={() => { load(); }} />
      )}

      {/* Popup xem nội dung đầy đủ */}
      {expandedCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setExpandedCell(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">{expandedCell.label}</h3>
              <button
                onClick={() => setExpandedCell(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{expandedCell.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Column settings modal with drag-and-drop ──────────────────────── */
function ColSettingsModal({
  colOrder, onSave, onClose,
}: { colOrder: ColItem[]; onSave: (c: ColItem[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<ColItem[]>([...colOrder]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function toggle(key: string) {
    const col = ALL_COLS.find((c) => c.key === key);
    if (col?.required) return;
    setDraft((prev) => prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  function setDisplayType(key: string, dt: 'truncate' | 'clamp' | 'wrap') {
    setDraft((prev) => prev.map((c) => c.key === key ? { ...c, displayType: dt } : c));
  }

  function setPin(key: string, pinned: boolean) {
    setDraft((prev) => prev.map((c) => c.key === key ? { ...c, pinned } : c));
  }

  function handleDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.effectAllowed = 'move';
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  }

  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...draft];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setDraft(next);
    setDragIdx(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  const visibleCount = draft.filter((c) => c.visible).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[380px] max-h-[82vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Điều chỉnh cột hiển thị</h3>
            <p className="text-xs text-gray-400 mt-0.5">Kéo ⠿ để sắp xếp · {visibleCount} cột đang bật</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-1">
          {draft.map((col, idx) => {
            const def = ALL_COLS.find((c) => c.key === col.key)!;
            const isDragging = dragIdx === idx;
            const isDragOver = dragOverIdx === idx && dragIdx !== idx;
            return (
              <div
                key={col.key}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={[
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all select-none cursor-grab active:cursor-grabbing',
                  isDragOver ? 'border-blue-400 bg-blue-50 shadow-sm' : col.visible ? 'border-blue-100 bg-blue-50/40' : 'border-gray-100 bg-white',
                  isDragging ? 'opacity-30 scale-95' : '',
                ].join(' ')}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-300 hover:text-gray-400" fill="currentColor" viewBox="0 0 16 16">
                  <circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/>
                  <circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/>
                  <circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/>
                </svg>

                <input type="checkbox"
                  checked={col.visible}
                  onChange={() => toggle(col.key)}
                  disabled={def?.required}
                  className="w-4 h-4 accent-blue-600 rounded flex-shrink-0 cursor-pointer disabled:cursor-default"
                />
                <span className="text-sm text-gray-700 font-medium flex-1 leading-none">{def?.label}</span>
                {/* Pin toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); setPin(col.key, !col.pinned); }}
                  title={col.pinned ? 'Bỏ ghim cột' : 'Ghim cột (cố định khi kéo ngang)'}
                  className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors ${col.pinned ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
                  </svg>
                </button>
                {def?.required && <span className="text-[10px] text-gray-300 flex-shrink-0">bắt buộc</span>}
                {TEXT_DISPLAY_COLS.has(col.key) && (
                  <div className="flex items-center rounded-md border border-gray-200 overflow-hidden flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {(['truncate', 'clamp', 'wrap'] as const).map((dt, i) => {
                      const labels = ['Cắt', '2 dòng', 'Đầy đủ'];
                      const active = (col.displayType ?? DEFAULT_DISPLAY[col.key] ?? 'truncate') === dt;
                      return (
                        <button key={dt}
                          onClick={() => setDisplayType(col.key, dt)}
                          className={[
                            'px-1.5 py-0.5 text-[10px] font-medium transition-colors leading-none',
                            i > 0 ? 'border-l border-gray-200' : '',
                            active ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50',
                          ].join(' ')}
                        >{labels[i]}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setDraft(ALL_COLS.map((c) => ({ key: c.key, visible: DEFAULT_VISIBLE.has(c.key) || !!c.required, ...(DEFAULT_DISPLAY[c.key] ? { displayType: DEFAULT_DISPLAY[c.key] as ColItem['displayType'] } : {}) })))}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium transition">
            Khôi phục mặc định
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Hủy</button>
            <button onClick={() => onSave(draft)}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

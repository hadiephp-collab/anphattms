'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { productsApi } from '@/lib/products';
import ImportModal from './ImportModal';
import { localDateStr } from '@/lib/utils';

interface Product {
  id: number; code: string; name: string; category?: string; brand?: string; unit?: string;
  sellingPrice?: number; costPrice?: number; hasVariants: boolean;
  isSaleable: boolean; isActive: boolean; warehouseLocation?: string;
  barcode?: string; tags?: string[];
  images?: { id: number; url: string; isMain: boolean }[];
  variants?: { id: number }[];
}
interface Stats { total: number; withVariants: number; outOfStock: number; lowStock: number; }

const fmt = (n?: number) => n != null ? Number(n).toLocaleString('vi-VN') + 'đ' : '—';

const ALL_COLS = [
  { key: 'code',         label: 'Mã',            required: true },
  { key: 'name',         label: 'Tên sản phẩm',  required: true },
  { key: 'image',        label: 'Ảnh',            required: true },
  { key: 'category',     label: 'Danh mục' },
  { key: 'brand',        label: 'Thương hiệu' },
  { key: 'unit',         label: 'ĐVT' },
  { key: 'costPrice',    label: 'Giá vốn' },
  { key: 'sellingPrice', label: 'Giá bán' },
  { key: 'variants',     label: 'Biến thể' },
  { key: 'barcode',      label: 'Mã vạch' },
  { key: 'stock',        label: 'Tồn kho' },
  { key: 'status',       label: 'Trạng thái' },
];

const DEFAULT_COLS = new Set(['image', 'code', 'name', 'brand', 'category', 'unit', 'sellingPrice', 'variants', 'stock', 'status']);

const REQUIRED_COLS = new Set(ALL_COLS.filter((c) => c.required).map((c) => c.key));

function loadCols(): Set<string> {
  try {
    const s = localStorage.getItem('products_cols');
    if (s) {
      const saved = new Set<string>(JSON.parse(s));
      REQUIRED_COLS.forEach((k) => saved.add(k));
      return saved;
    }
  } catch {}
  return new Set(DEFAULT_COLS);
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
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_COLS);
  const [showColSettings, setShowColSettings] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCols(loadCols()); }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node))
        setBulkMenuOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const params: Record<string, string> = { page: '1', limit: '9999', sortBy, sortOrder };
      if (search) params.search = search;
      if (filterCategory) params.category = filterCategory;
      if (filterStatus !== '') params.isActive = filterStatus;
      const res = await productsApi.getAll(params);
      const headers = ['Mã', 'Tên sản phẩm', 'Thương hiệu', 'Danh mục', 'ĐVT', 'Giá vốn', 'Giá bán', 'Barcode', 'Có biến thể', 'Tồn kho', 'Trạng thái', 'Vị trí kho', 'Tags'];
      const rows = res.data.map((p: Product) => [
        p.code, p.name, p.brand || '', p.category || '', p.unit || '',
        p.costPrice ?? '', p.sellingPrice ?? '',
        p.barcode || '',
        p.hasVariants ? 'Có' : 'Không', '0',
        p.isActive ? 'Đang bán' : 'Ngừng bán',
        p.warehouseLocation || '',
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

  function saveColSettings(cols: Set<string>) {
    setVisibleCols(cols);
    localStorage.setItem('products_cols', JSON.stringify([...cols]));
    setShowColSettings(false);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit), sortBy, sortOrder };
      if (search) params.search = search;
      if (filterCategory) params.category = filterCategory;
      if (filterStatus !== '') params.isActive = filterStatus;
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
  }, [page, limit, search, filterCategory, filterStatus, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  function handleSort(field: string) {
    setPage(1);
    if (sortBy === field) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else { setSortBy(field); setSortOrder('DESC'); }
  }

  function setSearchReset(v: string) { setPage(1); setSearch(v); }
  function setCategoryReset(v: string) { setPage(1); setFilterCategory(v); }
  function setStatusReset(v: string) { setPage(1); setFilterStatus(v); }

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

  function SortTh({ label, field }: { label: string; field: string }) {
    const active = sortBy === field;
    return (
      <th onClick={() => handleSort(field)}
        className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer select-none hover:text-gray-800 group">
        <div className="flex items-center gap-1">
          {label}
          <span className={`flex flex-col leading-none ${active ? 'text-blue-500' : 'text-gray-300 group-hover:text-gray-400'}`}>
            <svg className={`w-2.5 h-2.5 -mb-0.5 ${active && sortOrder === 'ASC' ? 'opacity-100' : 'opacity-40'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0L5 0z"/></svg>
            <svg className={`w-2.5 h-2.5 ${active && sortOrder === 'DESC' ? 'opacity-100' : 'opacity-40'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0H10L5 6z"/></svg>
          </span>
        </div>
      </th>
    );
  }

  const visibleCount = ALL_COLS.filter((c) => visibleCols.has(c.key)).length;
  const colSpan = 1 + visibleCount;

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight">Sản Phẩm</h1>
          <p className="text-gray-400 text-xs mt-0.5">Quản lý danh mục sản phẩm, biến thể và giá</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Nhập file
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="inline-flex items-center justify-center gap-2 w-[7.5rem] px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400">
            {exporting
              ? <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              : <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>}
            <span>{exporting ? 'Đang xuất...' : 'Xuất file'}</span>
          </button>
          <button onClick={() => router.push('/dashboard/products/new')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Thêm sản phẩm
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Tổng sản phẩm', value: stats.total, from: 'from-slate-600', to: 'to-slate-800',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
            { label: 'Có biến thể', value: stats.withVariants, from: 'from-blue-500', to: 'to-blue-700',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" /> },
            { label: 'Hết hàng', value: stats.outOfStock, from: 'from-red-500', to: 'to-red-700',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" /> },
            { label: 'Sắp hết hàng', value: stats.lowStock, from: 'from-amber-400', to: 'to-orange-500',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> },
          ].map((k) => (
            <div key={k.label} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${k.from} ${k.to} shadow-sm flex items-center gap-3 px-4 py-4`}>
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">{k.icon}</svg>
              </div>
              <div className="z-10">
                <p className="text-[11px] text-white/60 font-medium leading-none">{k.label}</p>
                <p className="text-2xl font-bold text-white mt-1 leading-none">{k.value}</p>
              </div>
              <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10" />
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="text-sm font-semibold text-blue-700">
                Đã chọn <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-md">{selectedIds.size}</span> sản phẩm
              </span>

              {/* Dropdown */}
              <div className="relative" ref={bulkMenuRef}>
                <button onClick={() => setBulkMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition shadow-sm">
                  Chọn thao tác
                  <svg className={`w-3 h-3 transition-transform ${bulkMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {bulkMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 min-w-[170px]">
                    <button onClick={() => handleBulkStatus(true)}
                      className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Đổi thành Đang bán
                    </button>
                    <button onClick={() => handleBulkStatus(false)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2.5 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Đổi thành Ngừng bán
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button onClick={handleBulkDelete}
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Xóa đã chọn
                    </button>
                  </div>
                )}
              </div>

              <button onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-blue-400 hover:text-blue-600 transition font-medium">Bỏ chọn</button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50">
            {/* Gear: column settings — LEFT side */}
            <button onClick={() => setShowColSettings(true)} title="Điều chỉnh cột hiển thị"
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
                onChange={(e) => setSearchReset(e.target.value)}
                className="pl-8 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 bg-gray-50/80 placeholder:text-gray-300" />
            </div>

            <select value={filterCategory} onChange={(e) => setCategoryReset(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 cursor-pointer">
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={filterStatus} onChange={(e) => setStatusReset(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/80 cursor-pointer">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đang bán</option>
              <option value="false">Ngừng bán</option>
            </select>

            {(search || filterCategory || filterStatus) && (
              <button onClick={() => { setSearch(''); setFilterCategory(''); setFilterStatus(''); setPage(1); }}
                className="text-xs text-gray-300 hover:text-red-400 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Xóa lọc
              </button>
            )}

            <span className="ml-auto text-xs text-gray-300">{total} kết quả</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="w-10 pl-4 py-3 border-b border-gray-200">
                    <input type="checkbox"
                      checked={products.length > 0 && selectedIds.size === products.length}
                      ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < products.length; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                  </th>
                  {visibleCols.has('image') && <th className="w-12 border-b border-gray-200" />}
                  {visibleCols.has('code') && (
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Mã</th>
                  )}
                  {visibleCols.has('name') && <SortTh label="Tên sản phẩm" field="name" />}
                  {visibleCols.has('brand') && (
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Thương hiệu</th>
                  )}
                  {visibleCols.has('category') && (
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Danh mục</th>
                  )}
                  {visibleCols.has('unit') && (
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">ĐVT</th>
                  )}
                  {visibleCols.has('costPrice') && (
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Giá vốn</th>
                  )}
                  {visibleCols.has('sellingPrice') && <SortTh label="Giá bán" field="sellingPrice" />}
                  {visibleCols.has('barcode') && (
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Mã vạch</th>
                  )}
                  {visibleCols.has('variants') && (
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Biến thể</th>
                  )}
                  {visibleCols.has('stock') && <SortTh label="Tồn kho" field="stock" />}
                  {visibleCols.has('status') && (
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Trạng thái</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={colSpan} className="text-center py-14">
                    <div className="inline-flex flex-col items-center gap-2 text-gray-300">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span className="text-xs">Đang tải...</span>
                    </div>
                  </td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={colSpan} className="text-center py-14">
                    <svg className="w-10 h-10 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-gray-300 text-sm">Chưa có sản phẩm nào</p>
                    <button onClick={() => router.push('/dashboard/products/new')}
                      className="mt-2 text-blue-500 text-xs hover:underline font-medium">+ Thêm sản phẩm đầu tiên</button>
                  </td></tr>
                ) : products.map((p) => {
                  const mainImg = p.images?.find((i) => i.isMain) || p.images?.[0];
                  return (
                    <tr key={p.id}
                      onClick={() => router.push(`/dashboard/products/${p.id}`)}
                      className={`border-b border-gray-50 last:border-0 transition-colors cursor-pointer ${selectedIds.has(p.id) ? 'bg-blue-50/40' : 'hover:bg-blue-50/30'}`}>
                      <td className="w-10 pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                      </td>
                      {visibleCols.has('image') && (
                        <td className="px-2 py-3">
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-100">
                            {mainImg
                              ? <img src={mainImg.url} alt="" className="w-full h-full object-cover" />
                              : <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>}
                          </div>
                        </td>
                      )}
                      {visibleCols.has('code') && (
                        <td className="px-4 py-3">
                          <span className="font-mono text-[11px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md tracking-wide">
                            {p.code}
                          </span>
                        </td>
                      )}
                      {visibleCols.has('name') && (
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-800 text-sm">{p.name}</span>
                          {p.warehouseLocation && (
                            <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {p.warehouseLocation}
                            </div>
                          )}
                        </td>
                      )}
                      {visibleCols.has('brand') && (
                        <td className="px-4 py-3 text-sm text-gray-500">{p.brand || <span className="text-gray-200">—</span>}</td>
                      )}
                      {visibleCols.has('category') && <td className="px-4 py-3 text-sm text-gray-500">{p.category || <span className="text-gray-200">—</span>}</td>}
                      {visibleCols.has('unit') && <td className="px-4 py-3 text-sm text-gray-500">{p.unit || <span className="text-gray-200">—</span>}</td>}
                      {visibleCols.has('costPrice') && <td className="px-4 py-3 text-sm text-gray-500">{fmt(p.costPrice)}</td>}
                      {visibleCols.has('sellingPrice') && <td className="px-4 py-3 text-sm font-medium text-gray-700">{fmt(p.sellingPrice)}</td>}
                      {visibleCols.has('barcode') && (
                        <td className="px-4 py-3">
                          {p.barcode
                            ? <span className="font-mono text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{p.barcode}</span>
                            : <span className="text-gray-200">—</span>}
                        </td>
                      )}
                      {visibleCols.has('variants') && (
                        <td className="px-4 py-3">
                          {p.hasVariants
                            ? <span className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100 font-medium">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                {p.variants?.length || 0} biến thể
                              </span>
                            : <span className="text-gray-200 text-xs">—</span>}
                        </td>
                      )}
                      {visibleCols.has('stock') && <td className="px-4 py-3 text-sm text-gray-400">0</td>}
                      {visibleCols.has('status') && (
                        <td className="px-4 py-3">
                          {p.isActive
                            ? <span className="text-[11px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">Đang bán</span>
                            : <span className="text-[11px] bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full font-medium">Ngừng bán</span>}
                        </td>
                      )}
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
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-xs">«</button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-xs">‹</button>
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
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-xs">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition text-xs">»</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Column settings modal */}
      {showColSettings && (
        <ColSettingsModal
          visibleCols={visibleCols}
          onSave={saveColSettings}
          onClose={() => setShowColSettings(false)}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { load(); }}
        />
      )}
    </div>
  );
}

/* ─── Column settings modal ─────────────────────────────────────────── */
function ColSettingsModal({
  visibleCols, onSave, onClose,
}: { visibleCols: Set<string>; onSave: (c: Set<string>) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(new Set(visibleCols));

  function toggle(key: string) {
    const col = ALL_COLS.find((c) => c.key === key);
    if (col?.required) return;
    setDraft((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[480px] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Điều chỉnh cột hiển thị</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 gap-2">
          {ALL_COLS.map((col) => (
            <label key={col.key}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition select-none
                ${draft.has(col.key) ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}
                ${col.required ? 'opacity-60 cursor-default' : ''}`}>
              <input type="checkbox"
                checked={draft.has(col.key)}
                onChange={() => toggle(col.key)}
                disabled={col.required}
                className="w-4 h-4 accent-blue-600 rounded" />
              <span className="text-sm text-gray-700 font-medium flex-1">{col.label}</span>
              {col.required && <span className="text-[10px] text-gray-300">Bắt buộc</span>}
            </label>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={() => setDraft(new Set(DEFAULT_COLS))}
            className="text-xs text-gray-400 hover:text-gray-600 transition font-medium">
            Khôi phục mặc định
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Hủy</button>
            <button onClick={() => onSave(draft)}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

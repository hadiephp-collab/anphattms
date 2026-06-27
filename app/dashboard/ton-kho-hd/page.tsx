'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { vatInventoryApi } from '@/lib/vat-inventory';

const fmtSL = (n: number) => Number(n || 0).toLocaleString('vi-VN');
const fmtVND = (n: number) => {
  const abs = Math.abs(Number(n || 0));
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ đ';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1).replace(/\.0$/, '') + 'tr đ';
  return sign + abs.toLocaleString('vi-VN') + ' đ';
};
const fmtVNDFull = (n: number) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

const removeAccents = (s: string) =>
  String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

interface ProductRow {
  productId: number;
  maSP: string;
  tenSanPham: string;
  dvt: string;
  tongNhap: number;
  tongXuat: number;
  tonKho: number;
  giaBinhQuan: number;
  giaTriTon: number;
  tenHoaDon: string;
  coTenChinhThuc: boolean;
}

interface Stats {
  tongLoaiSP: number;
  tongNhap: number;
  tongXuat: number;
  tongTon: number;
  tongGiaTri: number;
  chuaCoTenHD: number;
  tonAm: number;
}

type SortCol = 'maSP' | 'tenSanPham' | 'tongNhap' | 'tongXuat' | 'tonKho' | 'giaBinhQuan' | 'giaTriTon';
type TrangThai = '' | 'con' | 'het' | 'am' | 'chuaten';

// pageSize is now dynamic state

export default function TonKhoHDPage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter / sort state
  const [query, setQuery] = useState('');
  const [scopeMa, setScopeMa] = useState(true);
  const [scopeTen, setScopeTen] = useState(true);
  const [scopeHD, setScopeHD] = useState(true);
  const [trangThai, setTrangThai] = useState<TrangThai>('');
  const [sortCol, setSortCol] = useState<SortCol>('maSP');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vatInventoryApi.getInventory();
      setRows(data.rows || []);
      setStats(data.stats || null);
      setLoadedAt(new Date().toISOString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = query.trim();
    const qN = removeAccents(q);

    let result = rows.filter(r => {
      const ton = Number(r.tonKho);
      if (trangThai === 'con'     && ton <= 0) return false;
      if (trangThai === 'het'     && ton !== 0) return false;
      if (trangThai === 'am'      && ton >= 0) return false;
      if (trangThai === 'chuaten' && r.tenHoaDon) return false;
      if (q) {
        const ma  = scopeMa  && removeAccents(r.maSP).includes(qN);
        const ten = scopeTen && removeAccents(r.tenSanPham).includes(qN);
        const hd  = scopeHD  && removeAccents(r.tenHoaDon).includes(qN);
        if (!ma && !ten && !hd) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      if (sortCol === 'maSP' || sortCol === 'tenSanPham') {
        va = removeAccents(a[sortCol]);
        vb = removeAccents(b[sortCol]);
      } else {
        va = Number(a[sortCol]) || 0;
        vb = Number(b[sortCol]) || 0;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, query, scopeMa, scopeTen, scopeHD, trangThai, sortCol, sortAsc]);

  const pages = Math.ceil(filtered.length / pageSize) || 1;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const filteredGT = filtered.reduce((s, r) => s + Number(r.giaTriTon), 0);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(v => !v);
    else { setSortCol(col); setSortAsc(col === 'maSP' || col === 'tenSanPham'); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col
      ? <span className="ml-1 text-blue-600">{sortAsc ? '↑' : '↓'}</span>
      : <span className="ml-1 text-gray-300">↕</span>;

  const exportCSV = () => {
    if (!filtered.length) return;
    const BOM = '﻿';
    const headers = ['Mã SP', 'Tên sản phẩm', 'Tên HĐ ★', 'ĐVT', 'Tổng nhập', 'Tổng xuất', 'Tồn kho HĐ', 'Giá bình quân', 'Giá trị tồn', 'Trạng thái'];
    const csvRows = filtered.map(r => {
      const ton = Number(r.tonKho);
      const tt = ton < 0 ? 'Tồn âm' : ton === 0 ? 'Hết hàng' : 'Còn hàng';
      return [r.maSP, r.tenSanPham, r.tenHoaDon, r.dvt, r.tongNhap, r.tongXuat, r.tonKho, r.giaBinhQuan, r.giaTriTon, tt]
        .map(c => { const s = String(c ?? ''); return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s; })
        .join(',');
    });
    const csv = BOM + headers.join(',') + '\n' + csvRows.join('\n');
    const a = document.createElement('a');
    const d = new Date();
    const ys = d.getFullYear() + '' + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `TonKhoHD_${ys}.csv`;
    a.click();
  };

  const hlText = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 rounded px-px">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const clearFilter = () => {
    setQuery(''); setScopeMa(true); setScopeTen(true); setScopeHD(true);
    setTrangThai(''); setSortCol('maSP'); setSortAsc(true); setPage(1);
  };

  const hasFilter = query || trangThai || !scopeMa || !scopeTen || !scopeHD;

  const loadedTime = loadedAt
    ? new Date(loadedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="p-6 max-w-full mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tồn Kho Hóa Đơn (VAT)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tính từ Nhập HĐ VAT (confirmed) + Xuất HĐ VAT (active) · Giá bình quân gia quyền · Có tên hàng hóa HĐ
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
          <button
            onClick={exportCSV}
            disabled={!filtered.length}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          <strong>Màn này hiển thị tồn kho theo luồng kế toán (VAT)</strong> — tính từ Nhập HĐ VAT (đã ghi nhận) và Xuất HĐ VAT (đang hiệu lực), dùng giá bình quân gia quyền. Cột <strong>Tên HĐ ★</strong> là tên xuất hiện trên hóa đơn VAT khi xuất hàng.
        </span>
      </div>

      {/* Status bar — 7 chỉ số */}
      {stats && (
        <div className="grid grid-cols-4 md:grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden text-sm">
          {[
            { label: 'Tổng loại SP',       value: stats.tongLoaiSP.toLocaleString('vi-VN'), color: 'text-blue-700' },
            { label: 'Tổng nhập lũy kế',   value: fmtSL(stats.tongNhap),                   color: 'text-emerald-700' },
            { label: 'Tổng xuất lũy kế',   value: fmtSL(stats.tongXuat),                   color: 'text-red-700' },
            { label: 'Tồn kho (SL)',        value: fmtSL(stats.tongTon),                    color: 'text-blue-800 font-bold' },
            { label: 'Tổng giá trị tồn',   value: fmtVND(stats.tongGiaTri),                color: 'text-blue-800 font-bold' },
            { label: 'Chưa có tên HĐ ★',  value: String(stats.chuaCoTenHD),               color: stats.chuaCoTenHD > 0 ? 'text-amber-600' : 'text-gray-400' },
            { label: 'Tồn âm (cần KT)',    value: String(stats.tonAm),                     color: stats.tonAm > 0 ? 'text-red-600 font-bold' : 'text-gray-400' },
          ].map(item => (
            <div key={item.label} className="bg-white px-3 py-2.5">
              <div className="text-xs text-gray-500 mb-1 truncate">{item.label}</div>
              <div className={`text-sm font-semibold ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter block */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search input */}
          <div className="relative flex-1 min-w-48 max-w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="Tìm mã SP, tên SP, tên hóa đơn ★..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Scope chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Tìm theo:</span>
            {[
              { key: 'ma', label: 'Mã SP', val: scopeMa, set: setScopeMa },
              { key: 'ten', label: 'Tên SP', val: scopeTen, set: setScopeTen },
              { key: 'hd', label: 'Tên HĐ ★', val: scopeHD, set: setScopeHD },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => { s.set(v => !v); setPage(1); }}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${
                  s.val ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={trangThai}
            onChange={e => { setTrangThai(e.target.value as TrangThai); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="con">✅ Còn hàng</option>
            <option value="het">⬜ Hết hàng</option>
            <option value="am">🔴 Tồn âm</option>
            <option value="chuaten">⚠ Chưa có tên HĐ</option>
          </select>

          {/* Page size */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-gray-400">Hiển thị:</span>
            {[20, 50, 100].map(n => (
              <button
                key={n}
                onClick={() => { setPageSize(n); setPage(1); }}
                className={`px-2.5 py-1 text-xs rounded border transition ${pageSize === n ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}
              >
                {n}
              </button>
            ))}
          </div>

          {hasFilter && (
            <button onClick={clearFilter} className="flex items-center gap-1 px-2.5 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Xoá lọc
            </button>
          )}
        </div>
      </div>

      {/* Result strip */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 flex items-center justify-between text-sm">
        <span>
          {query ? (
            <>Kết quả tìm "<strong className="text-blue-700">{query}</strong>" · </>
          ) : trangThai ? (
            <><strong className="text-orange-700">{filtered.length}/{rows.length}</strong> sản phẩm · </>
          ) : (
            <><strong className="text-orange-700">{rows.length.toLocaleString('vi-VN')} loại sản phẩm</strong> · </>
          )}
          Giá trị tồn: <strong className="text-blue-700">{fmtVND(filteredGT)}</strong>
        </span>
        {loadedTime && <span className="text-gray-400 text-xs">Cập nhật hôm nay {loadedTime}</span>}
      </div>

      {/* Table */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">{error}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 w-24" onClick={() => handleSort('maSP')}>
                    Mã SP<SortIcon col="maSP" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tenSanPham')}>
                    Tên sản phẩm<SortIcon col="tenSanPham" />
                  </th>
                  <th className="px-4 py-3 text-left w-40">Tên HĐ ★</th>
                  <th className="px-4 py-3 text-center w-14">ĐVT</th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 w-24" onClick={() => handleSort('tongNhap')}>
                    Tổng nhập<SortIcon col="tongNhap" />
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 w-24" onClick={() => handleSort('tongXuat')}>
                    Tổng xuất<SortIcon col="tongXuat" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 w-28" onClick={() => handleSort('tonKho')}>
                    Tồn kho HĐ<SortIcon col="tonKho" />
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 w-32" onClick={() => handleSort('giaBinhQuan')}>
                    Giá bình quân<SortIcon col="giaBinhQuan" />
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100 w-32" onClick={() => handleSort('giaTriTon')}>
                    Giá trị tồn<SortIcon col="giaTriTon" />
                  </th>
                  <th className="px-4 py-3 text-center w-24">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-6 h-6 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Đang tải dữ liệu...
                      </div>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                      {rows.length === 0 ? 'Chưa có dữ liệu — tạo Nhập/Xuất HĐ VAT trước' : 'Không tìm thấy sản phẩm nào'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map(r => {
                    const ton = Number(r.tonKho);
                    const isAm = ton < 0;
                    const isHet = ton === 0;
                    const chuaTen = !r.tenHoaDon;
                    const rowBg = isAm ? 'bg-red-50' : chuaTen && !isHet ? 'bg-yellow-50' : '';
                    const pct = r.tongNhap > 0 ? Math.min(100, Math.round(ton / r.tongNhap * 100)) : 0;
                    const q = query.trim();

                    return (
                      <tr key={r.productId} className={`hover:bg-gray-50 transition ${rowBg}`}>
                        {/* Mã SP */}
                        <td className={`px-4 py-3 font-medium ${isAm ? 'text-red-700' : 'text-blue-700'}`}>
                          {hlText(r.maSP, q)}
                        </td>

                        {/* Tên SP */}
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{hlText(r.tenSanPham, q)}</div>
                          {isAm && <div className="text-xs text-red-600 mt-0.5">⚠ Tồn âm — xuất &gt; nhập</div>}
                        </td>

                        {/* Tên HĐ ★ */}
                        <td className="px-4 py-3">
                          {chuaTen ? (
                            <Link
                              href={`/dashboard/products/${r.productId}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-yellow-50 border border-yellow-300 text-yellow-800 hover:bg-yellow-100 transition"
                              title="Nhấn để vào trang sản phẩm và thêm tên HĐ"
                            >
                              ⚠ Chưa có tên ★
                            </Link>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${isAm ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-300 text-green-800'}`}>
                              ★ {hlText(r.tenHoaDon, q)}
                            </span>
                          )}
                        </td>

                        {/* ĐVT */}
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">{r.dvt}</td>

                        {/* Tổng nhập */}
                        <td className="px-4 py-3 text-right text-gray-500">{fmtSL(r.tongNhap)}</td>

                        {/* Tổng xuất */}
                        <td className="px-4 py-3 text-right text-gray-500">{fmtSL(r.tongXuat)}</td>

                        {/* Tồn kho + mini bar */}
                        <td className="px-4 py-3">
                          {isAm ? (
                            <>
                              <span className="font-semibold text-red-700">{fmtSL(ton)}</span>
                              <div className="mt-1 h-1 rounded bg-gray-100 overflow-hidden">
                                <div className="h-1 bg-red-500 rounded" style={{ width: '100%' }} />
                              </div>
                            </>
                          ) : isHet ? (
                            <span className="text-gray-400">0</span>
                          ) : (
                            <>
                              <span className="font-semibold text-emerald-700">{fmtSL(ton)}</span>
                              <div className="mt-1 h-1 rounded bg-gray-100 overflow-hidden">
                                <div className="h-1 bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
                              </div>
                            </>
                          )}
                        </td>

                        {/* Giá bình quân */}
                        <td className="px-4 py-3 text-right font-medium text-blue-700">
                          {r.giaBinhQuan > 0 ? fmtVNDFull(r.giaBinhQuan) : <span className="text-gray-400">—</span>}
                        </td>

                        {/* Giá trị tồn */}
                        <td className={`px-4 py-3 text-right font-semibold ${r.giaTriTon < 0 ? 'text-red-700' : r.giaTriTon > 0 ? 'text-blue-800' : 'text-gray-400'}`}>
                          {fmtVND(r.giaTriTon)}
                        </td>

                        {/* Badge */}
                        <td className="px-4 py-3 text-center">
                          {isAm ? (
                            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">Tồn âm</span>
                          ) : isHet ? (
                            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">Hết hàng</span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium">Còn hàng</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > pageSize && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>
                Hiển thị <strong>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</strong> / {filtered.length.toLocaleString('vi-VN')} sản phẩm
                &nbsp;·&nbsp; Tổng giá trị: <strong className="text-blue-700">{fmtVND(filteredGT)}</strong>
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 transition">‹</button>
                {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                  const p = pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pages - 2 ? pages - 4 + i : page - 2 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center border rounded text-xs transition ${p === page ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 hover:bg-gray-50'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                  className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 transition">›</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

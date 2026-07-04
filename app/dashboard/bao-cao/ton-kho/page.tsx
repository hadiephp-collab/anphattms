'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { reportsApi, InventoryReport, InventoryItem, InventorySapHetItem } from '@/lib/reports';
import { getBranchIds } from '@/lib/auth';

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtNum = (n: number) =>
  new Intl.NumberFormat('vi-VN').format(n);
const pct = (part: number, total: number) =>
  total === 0 ? 0 : Math.round((part / total) * 100);

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]) {
  const bom = '﻿';
  const csv = bom + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTop(data: InventoryReport) {
  const header = ['Mã SP', 'Tên SP', 'Danh Mục', 'Số Lượng', 'Giá Vốn', 'Giá Trị Tồn'];
  const rows = data.topGiaTri.map((r) => [r.code, r.name, r.category, String(r.soLuong), String(r.giaVon), String(r.giaTriTon)]);
  const d = data.calculatedAt;
  downloadCSV(`TonKho_Top20_${d}.csv`, [header, ...rows]);
}

function exportHetHang(data: InventoryReport) {
  const header = ['Mã SP', 'Tên SP', 'Danh Mục', 'Tồn Hiện'];
  const rows = data.hetHang.map((r) => [r.code, r.name, r.category, String(r.soLuong)]);
  downloadCSV(`TonKho_HetHang_${data.calculatedAt}.csv`, [header, ...rows]);
}

function exportSapHet(data: InventoryReport) {
  const header = ['Mã SP', 'Tên SP', 'Tồn Hiện', 'Tồn Tối Thiểu', 'Cần Thêm'];
  const rows = (data.sapHet as InventorySapHetItem[]).map((r) => [
    r.code, r.name, String(r.soLuong), String(r.lowStockThreshold ?? ''), String(r.canThiem ?? ''),
  ]);
  downloadCSV(`TonKho_SapHet_${data.calculatedAt}.csv`, [header, ...rows]);
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const w = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${w}%` }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BaoCaoTonKhoPage() {
  const [mode, setMode] = useState<'system' | 'branch'>('system');
  const [branchId, setBranchId] = useState<number | undefined>();
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [data, setData] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userBranchIds, setUserBranchIds] = useState<number[]>([]);

  const hetHangRef = useRef<HTMLDivElement>(null);
  const sapHetRef  = useRef<HTMLDivElement>(null);

  // Xác định quyền chi nhánh khi mount
  useEffect(() => {
    const ids = getBranchIds();
    setUserBranchIds(ids);
    if (ids.length > 0) {
      setMode('branch');
      setBranchId(ids[0]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await reportsApi.getInventoryReport({ mode, branchId, category: category || undefined, lowStockOnly });
      setData(result);
      // Nếu backend tự điều chỉnh (user bị giới hạn), đồng bộ lại state
      if (result.mode !== mode) setMode(result.mode);
      if (result.branchId && result.branchId !== branchId) setBranchId(result.branchId);
    } catch (e: any) {
      setError(e.message ?? 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [mode, branchId, category, lowStockOnly]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = userBranchIds.length === 0;
  const maxGiaTri = data?.topGiaTri[0]?.giaTriTon ?? 1;
  const maxDmGiaTri = data ? Math.max(...data.theoDanhMuc.map((d) => d.giaTriTon), 1) : 1;

  // ── Tabs ────────────────────────────────────────────────────────────────────

  function handleTabChange(newMode: 'system' | 'branch') {
    setMode(newMode);
    setCategory('');
    if (newMode === 'branch' && !branchId && data?.availableBranches?.length) {
      setBranchId(data.availableBranches[0].id);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo Cáo Tồn Kho</h1>
          <p className="text-sm text-gray-500 mt-1">
            Snapshot tồn kho tại thời điểm hiện tại
            {data && (
              <span className="ml-2 text-gray-400">
                · Tính lúc {data.calculatedAt}
                <button onClick={load} className="ml-2 text-blue-500 hover:text-blue-700 text-xs">↺ Làm mới</button>
              </span>
            )}
          </p>
        </div>

        {/* Export dropdown */}
        {data && (
          <div className="flex gap-2">
            <div className="relative group">
              <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-1">
                ↓ Xuất CSV ▾
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 hidden group-hover:block min-w-40">
                <button onClick={() => exportTop(data)} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                  Top 20 SP giá trị
                </button>
                {data.hetHang.length > 0 && (
                  <button onClick={() => exportHetHang(data)} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                    Hết hàng ({data.hetHang.length} SP)
                  </button>
                )}
                {data.sapHet.length > 0 && (
                  <button onClick={() => exportSapHet(data)} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                    Sắp hết ({data.sapHet.length} SP)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {isAdmin && (
            <button
              onClick={() => handleTabChange('system')}
              className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === 'system'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Toàn Hệ Thống
            </button>
          )}
          <button
            onClick={() => handleTabChange('branch')}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === 'branch'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Theo Chi Nhánh
          </button>
        </nav>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Branch selector — chỉ hiện ở tab chi nhánh */}
        {mode === 'branch' && data && data.availableBranches.length > 1 && (
          <select
            value={branchId ?? ''}
            onChange={(e) => setBranchId(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
          >
            {data.availableBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        {mode === 'branch' && data && data.availableBranches.length === 1 && (
          <span className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg font-medium">
            Chi nhánh: {data.branchName}
          </span>
        )}
        {mode === 'system' && (
          <span className="text-sm text-gray-400">Dữ liệu tồn kho hiển thị theo tổng toàn hệ thống.</span>
        )}

        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
        >
          <option value="">Tất cả danh mục</option>
          {data?.allCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Low stock toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded"
          />
          Chỉ hàng cần chú ý
        </label>

        {(category || lowStockOnly) && (
          <button
            onClick={() => { setCategory(''); setLowStockOnly(false); }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Xóa filter
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="text-red-600 font-medium hover:underline">Thử lại</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-500">Đang tải dữ liệu tồn kho...</span>
        </div>
      )}

      {/* No data */}
      {!loading && !error && data && data.kpi.tongSKU === 0 && (
        <div className="p-8 bg-gray-50 border border-gray-200 rounded-xl text-center text-gray-500">
          {mode === 'branch'
            ? 'Chi nhánh này chưa có dữ liệu tồn kho. Tồn kho sẽ được ghi nhận khi có giao dịch nhập/xuất.'
            : 'Chưa có sản phẩm nào trong hệ thống.'}
        </div>
      )}

      {/* Main content */}
      {!loading && !error && data && data.kpi.tongSKU > 0 && (
        <>
          {/* KPI bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm text-gray-500">Tổng SKU</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{fmtNum(data.kpi.tongSKU)}</div>
              <div className="text-xs text-gray-400 mt-1">sản phẩm đang theo dõi</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm text-gray-500">Giá Trị Tồn Kho</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{fmt(data.kpi.tongGiaTri)}</div>
              <div className="text-xs text-gray-400 mt-1">theo giá vốn bình quân</div>
            </div>
            <div
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-red-300 transition-colors"
              onClick={() => data.kpi.hetHangCount > 0 && hetHangRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="text-sm text-gray-500">Hết Hàng</div>
              <div className={`text-2xl font-bold mt-1 ${data.kpi.hetHangCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {data.kpi.hetHangCount}
              </div>
              <div className="text-xs text-gray-400 mt-1">sản phẩm tồn ≤ 0</div>
            </div>
            <div
              className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-amber-300 transition-colors"
              onClick={() => data.kpi.sapHetCount > 0 && sapHetRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="text-sm text-gray-500">Sắp Hết Hàng</div>
              <div className={`text-2xl font-bold mt-1 ${data.kpi.sapHetCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {data.kpi.sapHetCount}
              </div>
              <div className="text-xs text-gray-400 mt-1">dưới ngưỡng tồn tối thiểu</div>
            </div>
          </div>

          {/* Grid 2 cột */}
          {!lowStockOnly && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Top 20 SP giá trị cao */}
              <div className="bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Top 20 SP Giá Trị Tồn Cao</h2>
                  <button
                    onClick={() => exportTop(data)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    ↓ Xuất CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="px-4 py-2 text-left w-8">#</th>
                        <th className="px-4 py-2 text-left">Sản phẩm</th>
                        <th className="px-4 py-2 text-right">Tồn</th>
                        <th className="px-4 py-2 text-right">Giá Trị Tồn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topGiaTri.map((item, i) => (
                        <tr key={item.code} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900 truncate max-w-40">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono text-gray-400">{item.code}</span>
                              <span className="text-xs text-gray-400">{item.category}</span>
                            </div>
                            <ProgressBar value={item.giaTriTon} max={maxGiaTri} color="bg-blue-400" />
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700 whitespace-nowrap">
                            {fmtNum(item.soLuong)}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                            {fmt(item.giaTriTon)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Giá trị theo danh mục */}
              <div className="bg-white border border-gray-200 rounded-xl">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Giá Trị Theo Danh Mục</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="px-4 py-2 text-left">Danh Mục</th>
                        <th className="px-4 py-2 text-right">SKU</th>
                        <th className="px-4 py-2 text-right">Giá Trị Tồn</th>
                        <th className="px-4 py-2 text-right">Tỷ trọng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.theoDanhMuc.map((dm) => (
                        <tr key={dm.category} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className={`font-medium ${dm.category === 'Chưa phân loại' ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                              {dm.category}
                            </div>
                            <ProgressBar value={dm.giaTriTon} max={maxDmGiaTri} color="bg-purple-400" />
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">{fmtNum(dm.soSKU)}</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                            {fmt(dm.giaTriTon)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {pct(dm.giaTriTon, data.kpi.tongGiaTri)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* All OK badge */}
          {!lowStockOnly && data.kpi.hetHangCount === 0 && data.kpi.sapHetCount === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              ✅ Tất cả sản phẩm đang có đủ hàng theo ngưỡng đã cài đặt.
            </div>
          )}

          {/* Section Hết Hàng */}
          {data.hetHang.length > 0 && (
            <div ref={hetHangRef} className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-red-200">
                <h2 className="font-semibold text-red-800">
                  🚨 Sản Phẩm Hết Hàng ({data.hetHang.length} SP)
                </h2>
                <button
                  onClick={() => exportHetHang(data)}
                  className="text-xs text-red-600 hover:underline"
                >
                  ↓ Xuất CSV
                </button>
              </div>
              <HetHangTable items={data.hetHang} />
            </div>
          )}

          {/* Section Sắp Hết */}
          {data.sapHet.length > 0 && (
            <div ref={sapHetRef} className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200">
                <h2 className="font-semibold text-amber-800">
                  ⚠️ Sản Phẩm Sắp Hết ({data.sapHet.length} SP)
                </h2>
                <button
                  onClick={() => exportSapHet(data)}
                  className="text-xs text-amber-700 hover:underline"
                >
                  ↓ Xuất CSV
                </button>
              </div>
              <SapHetTable items={data.sapHet as InventorySapHetItem[]} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-tables ────────────────────────────────────────────────────────────────

function HetHangTable({ items }: { items: InventoryItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? items : items.slice(0, 30);
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-red-700 text-xs">
            <th className="px-4 py-2 text-left">Mã SP</th>
            <th className="px-4 py-2 text-left">Tên SP</th>
            <th className="px-4 py-2 text-left">Danh Mục</th>
            <th className="px-4 py-2 text-right">Tồn Hiện</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((item) => (
            <tr key={item.code} className="border-t border-red-100 hover:bg-red-100/50">
              <td className="px-4 py-2 font-mono text-xs text-red-700">{item.code}</td>
              <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-2 text-gray-500">{item.category}</td>
              <td className="px-4 py-2 text-right font-bold text-red-700">{fmtNum(item.soLuong)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!showAll && items.length > 30 && (
        <div className="px-4 py-3 text-center">
          <button onClick={() => setShowAll(true)} className="text-sm text-red-600 hover:underline">
            Xem thêm {items.length - 30} SP
          </button>
        </div>
      )}
    </div>
  );
}

function SapHetTable({ items }: { items: InventorySapHetItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? items : items.slice(0, 30);
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-amber-700 text-xs">
            <th className="px-4 py-2 text-left">Mã SP</th>
            <th className="px-4 py-2 text-left">Tên SP</th>
            <th className="px-4 py-2 text-right">Tồn Hiện</th>
            <th className="px-4 py-2 text-right">Tối Thiểu</th>
            <th className="px-4 py-2 text-right">Cần Thêm</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((item) => (
            <tr key={item.code} className="border-t border-amber-100 hover:bg-amber-100/50">
              <td className="px-4 py-2 font-mono text-xs text-amber-700">{item.code}</td>
              <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-2 text-right text-amber-700 font-medium">{fmtNum(item.soLuong)}</td>
              <td className="px-4 py-2 text-right text-gray-500">{fmtNum(item.lowStockThreshold ?? 0)}</td>
              <td className="px-4 py-2 text-right font-bold text-amber-800">
                +{fmtNum(item.canThiem ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!showAll && items.length > 30 && (
        <div className="px-4 py-3 text-center">
          <button onClick={() => setShowAll(true)} className="text-sm text-amber-600 hover:underline">
            Xem thêm {items.length - 30} SP
          </button>
        </div>
      )}
    </div>
  );
}

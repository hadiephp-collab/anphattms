'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { congNoApi } from '@/lib/cong-no-kh';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

interface Stats { totalDebt: number; customerCount: number; overdueAmount: number; collectedThisMonth: number; aging: { d0_30: number; d31_60: number; d61_90: number; d91plus: number } }
interface DebtRow { partnerId: number; partnerCode: string; partnerName: string; partnerPhone: string; partnerType: string; totalDebt: number; orderCount: number; oldestDebtDate: string; ageDays: number }

const agingColor = (d: number) => d <= 30 ? 'text-green-600 bg-green-50' : d <= 60 ? 'text-yellow-600 bg-yellow-50' : d <= 90 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';

export default function PhaiThuPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [data, setData] = useState<DebtRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('totalDebt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);

  useEffect(() => { congNoApi.getPhaiThuStats().then(setStats).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit), sortBy, sortOrder };
      if (search) params.search = search;
      const res = await congNoApi.getPhaiThu(params);
      setData(res.data); setTotal(res.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, limit, search, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === 'DESC' ? 'ASC' : 'DESC');
    else { setSortBy(col); setSortOrder('DESC'); }
    setPage(1);
  };
  const S = ({ col }: { col: string }) => sortBy !== col ? <span className="ml-1 opacity-30">↕</span> : <span className="ml-1">{sortOrder === 'DESC' ? '↓' : '↑'}</span>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Phải Thu — Khách Hàng</h2>
          <p className="text-sm text-gray-500">KH đang nợ mình. Phiếu thu có FIFO tự động phân bổ vào đơn cũ nhất.</p>
        </div>
        <Link href="/dashboard/thu-chi/phieu-thu" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + Tạo phiếu thu
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Tổng phải thu', value: stats?.totalDebt ?? 0, sub: `${stats?.customerCount ?? '–'} KH`, color: 'from-red-500 to-red-600' },
          { label: 'Quá hạn >30 ngày', value: stats?.overdueAmount ?? 0, sub: 'Cần ưu tiên', color: 'from-orange-500 to-orange-600' },
          { label: 'Thu tháng này', value: stats?.collectedThisMonth ?? 0, sub: 'Phiếu thu CN', color: 'from-blue-500 to-blue-600' },
          { label: 'Mới (0–30 ngày)', value: stats?.aging.d0_30 ?? 0, sub: 'Chưa đến hạn', color: 'from-purple-500 to-purple-600' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-4 bg-gradient-to-br ${k.color} text-white`}>
            <p className="text-xs font-medium opacity-80">{k.label}</p>
            <p className="text-lg font-bold mt-1">{VND(k.value)}</p>
            <p className="text-xs opacity-70 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Debt aging */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Phân tích tuổi nợ</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '0–30 ngày', v: stats.aging.d0_30, c: 'bg-green-50 border-green-200 text-green-700' },
              { label: '31–60 ngày', v: stats.aging.d31_60, c: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
              { label: '61–90 ngày', v: stats.aging.d61_90, c: 'bg-orange-50 border-orange-200 text-orange-700' },
              { label: '>90 ngày', v: stats.aging.d91plus, c: 'bg-red-50 border-red-200 text-red-700' },
            ].map(b => (
              <div key={b.label} className={`rounded-lg border p-3 ${b.c}`}>
                <p className="text-xs font-medium">{b.label}</p>
                <p className="text-base font-bold mt-1">{VND(b.v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b flex gap-2">
          <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tìm KH (tên, mã, SĐT)..." value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
          <button onClick={() => { setSearch(searchInput); setPage(1); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Tìm</button>
          {search && <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-3 py-2 border border-gray-300 text-sm rounded-lg">Xoá</button>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">Khách hàng</th>
              <th className="px-4 py-3 text-right cursor-pointer" onClick={() => handleSort('totalDebt')}>Dư nợ <S col="totalDebt" /></th>
              <th className="px-4 py-3 text-right cursor-pointer" onClick={() => handleSort('orderCount')}>Số đơn <S col="orderCount" /></th>
              <th className="px-4 py-3 text-center cursor-pointer" onClick={() => handleSort('oldestDebtDate')}>Nợ cũ nhất <S col="oldestDebtDate" /></th>
              <th className="px-4 py-3 text-center">Tuổi nợ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center py-12 text-gray-400">Đang tải...</td></tr>
              : data.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-400">Không có công nợ phải thu</td></tr>
              : data.map(row => (
                <tr key={row.partnerId} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.partnerName}</p>
                    <p className="text-xs text-gray-400">{row.partnerCode} · {row.partnerPhone}
                      {row.partnerType === 'both' && <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-600 rounded text-[10px]">KH + NCC</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{VND(row.totalDebt)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.orderCount} đơn</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{new Date(row.oldestDebtDate).toLocaleDateString('vi-VN')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${agingColor(row.ageDays)}`}>{row.ageDays} ngày</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/cong-no/phai-thu/${row.partnerId}`} className="text-blue-600 hover:text-blue-700 text-xs font-medium">Xem →</Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {total > limit && (
          <div className="p-4 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} / {total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">←</button>
              <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

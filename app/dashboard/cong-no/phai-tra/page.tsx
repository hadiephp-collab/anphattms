'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { congNoApi } from '@/lib/cong-no-kh';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

interface Stats { totalDebt: number; partnerCount: number; nccCount: number; vcCount: number; nccDebt: number; vcDebt: number }
interface PhaiTraRow { partnerId: number; partnerCode: string; partnerName: string; partnerPhone: string; partnerType: string; supplierDebt: number; poCount: number }

export default function PhaiTraPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [data, setData] = useState<PhaiTraRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'supplier' | 'freight'>('all');
  const [sortBy, setSortBy] = useState('supplierDebt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [loading, setLoading] = useState(true);

  useEffect(() => { congNoApi.getPhaiTraStats().then(setStats).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit), sortBy, sortOrder };
      if (search) params.search = search;
      if (typeFilter !== 'all') params.type = typeFilter;
      const res = await congNoApi.getPhaiTra(params);
      setData(res.data); setTotal(res.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, limit, search, typeFilter, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === 'DESC' ? 'ASC' : 'DESC');
    else { setSortBy(col); setSortOrder('DESC'); }
    setPage(1);
  };
  const S = ({ col }: { col: string }) => sortBy !== col ? <span className="ml-1 opacity-30">↕</span> : <span className="ml-1">{sortOrder === 'DESC' ? '↓' : '↑'}</span>;

  const typeLabel = (t: string) => t === 'supplier' ? 'NCC' : t === 'freight' ? 'VC' : t === 'both' ? 'KH + NCC' : t;
  const typeColor = (t: string) => t === 'supplier' ? 'bg-orange-100 text-orange-700' : t === 'freight' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Phải Trả — NCC & Vận Chuyển</h2>
          <p className="text-sm text-gray-500">Mình đang nợ NCC và đơn vị vận chuyển. Thanh toán trong đơn hàng nhập.</p>
        </div>
        <Link href="/dashboard/don-hang-nhap" className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700">
          Đơn hàng nhập →
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Tổng phải trả', value: stats?.totalDebt ?? 0, sub: `${stats?.partnerCount ?? '–'} đối tác`, color: 'from-orange-500 to-orange-600' },
          { label: 'Nợ NCC', value: stats?.nccDebt ?? 0, sub: `${stats?.nccCount ?? '–'} nhà cung cấp`, color: 'from-red-500 to-red-600' },
          { label: 'Nợ VC', value: stats?.vcDebt ?? 0, sub: `${stats?.vcCount ?? '–'} đơn vị VC`, color: 'from-blue-500 to-blue-600' },
          { label: 'Tổng NCC & VC có nợ', value: 0, sub: `${stats?.nccCount ?? 0} NCC · ${stats?.vcCount ?? 0} VC`, color: 'from-purple-500 to-purple-600', isCount: true },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-4 bg-gradient-to-br ${k.color} text-white`}>
            <p className="text-xs font-medium opacity-80">{k.label}</p>
            <p className="text-sm font-bold mt-0.5">{k.isCount ? ((stats?.nccCount ?? 0) + (stats?.vcCount ?? 0)) : VND(k.value)}</p>
            <p className="text-xs opacity-70 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* NCC vs VC breakdown */}
      {stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Phân tích theo loại</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nhà Cung Cấp (NCC)', value: stats.nccDebt, count: stats.nccCount, c: 'bg-orange-50 border-orange-200 text-orange-700' },
              { label: 'Đơn Vị Vận Chuyển (VC)', value: stats.vcDebt, count: stats.vcCount, c: 'bg-blue-50 border-blue-200 text-blue-700' },
            ].map(b => (
              <div key={b.label} className={`rounded-lg border p-4 ${b.c}`}>
                <p className="text-xs font-medium">{b.label}</p>
                <p className="text-sm font-bold mt-0.5">{VND(b.value)}</p>
                <p className="text-xs opacity-70 mt-1">{b.count} đối tác có nợ</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b flex gap-2">
          <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tìm NCC / VC (tên, mã, SĐT)..." value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
          <button onClick={() => { setSearch(searchInput); setPage(1); }} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Tìm</button>
          {search && <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-3 py-2 border border-gray-300 text-sm rounded-lg">Xoá</button>}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden text-sm">
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'supplier', label: 'NCC' },
              { key: 'freight', label: 'VC' },
            ].map(f => (
              <button key={f.key} onClick={() => { setTypeFilter(f.key as typeof typeFilter); setPage(1); }}
                className={`px-3 py-2 ${typeFilter === f.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">Đối tác</th>
              <th className="px-4 py-3 text-left">Loại</th>
              <th className="px-4 py-3 text-right cursor-pointer" onClick={() => handleSort('supplierDebt')}>Dư nợ <S col="supplierDebt" /></th>
              <th className="px-4 py-3 text-right cursor-pointer" onClick={() => handleSort('poCount')}>Số đơn <S col="poCount" /></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-12 text-gray-400">Đang tải...</td></tr>
              : data.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-gray-400">Không có công nợ phải trả</td></tr>
              : data.map(row => (
                <tr key={row.partnerId} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.partnerName}</p>
                    <p className="text-xs text-gray-400">{row.partnerCode} · {row.partnerPhone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeColor(row.partnerType)}`}>{typeLabel(row.partnerType)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-600">{VND(row.supplierDebt)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.poCount ?? 0} đơn</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/cong-no/phai-tra/${row.partnerId}`} className="text-blue-600 hover:text-blue-700 text-xs font-medium">Xem →</Link>
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

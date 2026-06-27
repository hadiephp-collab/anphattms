'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { congNoApi } from '@/lib/cong-no-kh';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

interface DebtOrder {
  id: number; code: string; date: string; totalAmount: string;
  paidAmount: string; debtAmount: string; debtPaidAmount: string;
  remaining: number; ageDays: number; paymentStatus: string; status: string;
}
interface Allocation {
  da_id: number; da_transactionId: number; da_orderId: number;
  da_amount: string; da_allocatedAt: string; tx_code: string; tx_date: string;
}
interface Detail { orders: DebtOrder[]; allocations: Allocation[]; }

const agingBadge = (d: number) =>
  d <= 30 ? 'bg-green-100 text-green-700' : d <= 60 ? 'bg-yellow-100 text-yellow-700' : d <= 90 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';

export default function PhaiThuDetailPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'allocations'>('orders');

  useEffect(() => {
    congNoApi.getPhaiThuDetail(Number(partnerId))
      .then(setDetail)
      .catch(() => router.push('/dashboard/cong-no/phai-thu'))
      .finally(() => setLoading(false));
  }, [partnerId, router]);

  if (loading) return <div className="p-6 text-center text-gray-400 py-20">Đang tải...</div>;
  if (!detail) return null;

  const totalDebt = detail.orders.reduce((s, o) => s + o.remaining, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chi tiết công nợ phải thu</h1>
          <Link href="/dashboard/cong-no/phai-thu" className="text-sm text-blue-600 hover:underline">
            ← Quay lại danh sách
          </Link>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">Tổng dư nợ hiện tại</p>
          <p className="text-3xl font-bold mt-1">{VND(totalDebt)}</p>
          <p className="text-sm opacity-70 mt-1">{detail.orders.length} đơn còn nợ</p>
        </div>
        <Link href={`/dashboard/thu-chi/phieu-thu/tao?partnerId=${partnerId}`}
          className="px-4 py-2 bg-white text-red-600 font-semibold text-sm rounded-lg hover:bg-red-50">
          + Tạo phiếu thu
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'orders', label: `Đơn còn nợ (${detail.orders.length})` },
            { key: 'allocations', label: `Lịch sử thu (${detail.allocations.length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-4 py-3 text-left">Mã đơn</th>
                <th className="px-4 py-3 text-left">Ngày</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3 text-right">Đã thu</th>
                <th className="px-4 py-3 text-right">Còn nợ</th>
                <th className="px-4 py-3 text-center">Tuổi nợ</th>
              </tr>
            </thead>
            <tbody>
              {detail.orders.length === 0
                ? <tr><td colSpan={6} className="text-center py-10 text-gray-400">Không có đơn nợ</td></tr>
                : detail.orders.map(o => (
                  <tr key={o.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders/${o.id}`} className="text-blue-600 hover:underline font-medium">{o.code}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.date).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{VND(Number(o.totalAmount))}</td>
                    <td className="px-4 py-3 text-right text-green-600">{VND(Number(o.paidAmount) + Number(o.debtPaidAmount))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{VND(o.remaining)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${agingBadge(o.ageDays)}`}>{o.ageDays} ngày</span>
                    </td>
                  </tr>
                ))}
            </tbody>
            {detail.orders.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold text-sm">
                  <td colSpan={4} className="px-4 py-3 text-gray-600">Tổng</td>
                  <td className="px-4 py-3 text-right text-red-600">{VND(totalDebt)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {activeTab === 'allocations' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-4 py-3 text-left">Phiếu thu</th>
                <th className="px-4 py-3 text-left">Ngày</th>
                <th className="px-4 py-3 text-left">Phân bổ vào đơn</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {detail.allocations.length === 0
                ? <tr><td colSpan={4} className="text-center py-10 text-gray-400">Chưa có phân bổ FIFO — tạo phiếu thu với &ldquo;Cập nhật công nợ&rdquo;</td></tr>
                : detail.allocations.map(a => (
                  <tr key={a.da_id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-600">{a.tx_code}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(a.da_allocatedAt).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-3 text-gray-600">Đơn #{a.da_orderId}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{VND(Number(a.da_amount))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { congNoApi } from '@/lib/cong-no-kh';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

interface PoRow {
  id: number; code: string; expectedDate: string; receivedDate: string;
  totalAmountVnd: string; paidAmount: string; debtAmountVnd: string;
  paymentStatus: string; status: string;
}
interface PaymentRow {
  id: number; paymentDate: string; amount: number; pttt: string; note: string;
}
interface Detail {
  partnerName: string; partnerCode: string; partnerType: string; supplierDebt: number;
  purchaseOrders: PoRow[];
  payments: PaymentRow[];
}

const statusLabel: Record<string, string> = { draft: 'Nháp', ordered: 'Đặt hàng', received: 'Đã nhận', cancelled: 'Đã hủy' };
const statusColor: Record<string, string> = { draft: 'bg-gray-100 text-gray-600', ordered: 'bg-blue-100 text-blue-700', received: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600' };
const payStatusColor: Record<string, string> = { unpaid: 'bg-red-100 text-red-700', partial: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700' };
const payStatusLabel: Record<string, string> = { unpaid: 'Chưa TT', partial: 'Một phần', paid: 'Đã TT' };

export default function PhaiTraDetailPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'payments'>('orders');

  useEffect(() => {
    congNoApi.getPhaiTraDetail(Number(partnerId))
      .then(setDetail)
      .catch(() => router.push('/dashboard/cong-no/phai-tra'))
      .finally(() => setLoading(false));
  }, [partnerId, router]);

  if (loading) return <div className="p-6 text-center text-gray-400 py-20">Đang tải...</div>;
  if (!detail) return null;

  const typeLabel = (t: string) => t === 'supplier' ? 'NCC' : t === 'freight' ? 'VC' : t === 'both' ? 'KH + NCC' : t;
  const typeColor = (t: string) => t === 'supplier' ? 'from-orange-500 to-orange-600' : t === 'freight' ? 'from-blue-500 to-blue-600' : 'from-purple-500 to-purple-600';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chi tiết công nợ phải trả</h1>
          <Link href="/dashboard/cong-no/phai-tra" className="text-sm text-blue-600 hover:underline">
            ← Quay lại danh sách
          </Link>
        </div>
      </div>

      {/* Header card */}
      <div className={`bg-gradient-to-r ${typeColor(detail.partnerType)} text-white rounded-xl p-5 flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{typeLabel(detail.partnerType)}</span>
            <span className="text-sm opacity-80">{detail.partnerCode}</span>
          </div>
          <p className="text-xl font-bold">{detail.partnerName}</p>
          <p className="text-sm opacity-80 mt-2">Tổng công nợ: <span className="font-bold text-lg">{VND(detail.supplierDebt)}</span></p>
        </div>
        <Link href={`/dashboard/don-hang-nhap`}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg font-medium">
          Đơn nhập →
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'orders', label: `Đơn chưa TT đủ (${detail.purchaseOrders.length})` },
            { key: 'payments', label: `Lịch sử thanh toán (${detail.payments.length})` },
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
                <th className="px-4 py-3 text-left">Ngày nhận</th>
                <th className="px-4 py-3 text-right">Tổng tiền (VNĐ)</th>
                <th className="px-4 py-3 text-right">Đã TT</th>
                <th className="px-4 py-3 text-right">Còn nợ</th>
                <th className="px-4 py-3 text-center">TT</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {detail.purchaseOrders.length === 0
                ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">Không có đơn còn nợ</td></tr>
                : detail.purchaseOrders.map(o => {
                  const debt = Number(o.debtAmountVnd);
                  const paid = Number(o.paidAmount);
                  const total = Number(o.totalAmountVnd);
                  return (
                    <tr key={o.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/don-hang-nhap/${o.id}`} className="text-blue-600 hover:underline font-medium">{o.code}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {o.receivedDate ? new Date(o.receivedDate).toLocaleDateString('vi-VN') : '–'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{VND(total)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{VND(paid)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-600">{VND(debt)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${payStatusColor[o.paymentStatus] || 'bg-gray-100 text-gray-600'}`}>
                          {payStatusLabel[o.paymentStatus] || o.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel[o.status] || o.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {detail.purchaseOrders.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold text-sm">
                  <td colSpan={4} className="px-4 py-3 text-gray-600">Tổng còn nợ</td>
                  <td className="px-4 py-3 text-right text-orange-600">{VND(detail.supplierDebt)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {activeTab === 'payments' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-4 py-3 text-left">Ngày</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3 text-left">PTTT</th>
                <th className="px-4 py-3 text-left">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {detail.payments.length === 0
                ? <tr><td colSpan={4} className="text-center py-10 text-gray-400">Chưa có thanh toán nào</td></tr>
                : detail.payments.map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.paymentDate).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{VND(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">{p.pttt}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.note || '–'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

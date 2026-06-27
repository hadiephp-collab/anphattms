'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { congNoApi } from '@/lib/cong-no-kh';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

interface Overview {
  phaiThu: number;
  phaiTra: number;
  net: number;
  phaiThuCustomers: number;
  phaiTraPartners: number;
  collectedThisMonth: number;
  phaiThuAging: { d0_30: number; d31_60: number; d61_90: number; d91plus: number };
}

export default function CongNoOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    congNoApi.getOverview().then(setData).catch(() => {});
  }, []);

  const net = data?.net ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Công Nợ</h1>
        <p className="text-sm text-gray-500 mt-1">Tổng quan công nợ phải thu và phải trả</p>
      </div>

      {/* KPI 3 card chính */}
      <div className="grid grid-cols-3 gap-4">
        <Link href="/dashboard/cong-no/phai-thu" className="block rounded-xl p-5 bg-gradient-to-br from-red-500 to-red-600 text-white hover:opacity-90 transition-opacity">
          <p className="text-sm font-medium opacity-80">Phải Thu (KH nợ mình)</p>
          <p className="text-2xl font-bold mt-2">{data ? VND(data.phaiThu) : '...'}</p>
          <p className="text-xs opacity-70 mt-1">{data?.phaiThuCustomers ?? '–'} khách hàng</p>
          <p className="text-xs opacity-60 mt-2">Xem chi tiết →</p>
        </Link>

        <Link href="/dashboard/cong-no/phai-tra" className="block rounded-xl p-5 bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:opacity-90 transition-opacity">
          <p className="text-sm font-medium opacity-80">Phải Trả (mình nợ NCC & VC)</p>
          <p className="text-2xl font-bold mt-2">{data ? VND(data.phaiTra) : '...'}</p>
          <p className="text-xs opacity-70 mt-1">{data?.phaiTraPartners ?? '–'} đối tác</p>
          <p className="text-xs opacity-60 mt-2">Xem chi tiết →</p>
        </Link>

        <div className={`rounded-xl p-5 text-white ${net >= 0 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-purple-600 to-purple-700'}`}>
          <p className="text-sm font-medium opacity-80">Vị thế ròng</p>
          <p className="text-2xl font-bold mt-2">{data ? VND(Math.abs(net)) : '...'}</p>
          <p className="text-xs opacity-70 mt-1">
            {net >= 0 ? 'Khách hàng đang nợ mình nhiều hơn' : 'Mình đang nợ NCC nhiều hơn'}
          </p>
        </div>
      </div>

      {/* Phân tích tuổi nợ phải thu */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Tuổi nợ phải thu (KH)</h3>
            <Link href="/dashboard/cong-no/phai-thu" className="text-xs text-blue-600 hover:underline">Xem danh sách →</Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '0 – 30 ngày', value: data.phaiThuAging.d0_30, color: 'bg-green-50 border-green-200 text-green-700' },
              { label: '31 – 60 ngày', value: data.phaiThuAging.d31_60, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
              { label: '61 – 90 ngày', value: data.phaiThuAging.d61_90, color: 'bg-orange-50 border-orange-200 text-orange-700' },
              { label: 'Trên 90 ngày', value: data.phaiThuAging.d91plus, color: 'bg-red-50 border-red-200 text-red-700' },
            ].map(b => (
              <div key={b.label} className={`rounded-lg border p-3 ${b.color}`}>
                <p className="text-xs font-medium">{b.label}</p>
                <p className="text-base font-bold mt-1">{VND(b.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Thu tiền từ khách hàng</h3>
          <p className="text-xs text-gray-500 mb-3">Tạo phiếu thu với "Cập nhật công nợ" để hệ thống tự phân bổ FIFO vào các đơn cũ nhất.</p>
          <Link href="/dashboard/thu-chi/phieu-thu" className="inline-block px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
            + Tạo phiếu thu
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Thanh toán cho NCC / VC</h3>
          <p className="text-xs text-gray-500 mb-3">Ghi nhận thanh toán trong đơn hàng nhập để cập nhật công nợ NCC tự động.</p>
          <Link href="/dashboard/don-hang-nhap" className="inline-block px-3 py-1.5 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700">
            Đơn hàng nhập →
          </Link>
        </div>
      </div>
    </div>
  );
}

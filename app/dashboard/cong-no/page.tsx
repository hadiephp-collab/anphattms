'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { congNoApi } from '@/lib/cong-no-kh';

const VND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

interface Overview {
  phaiTra: number;
  phaiTraPartners: number;
}

export default function CongNoOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    congNoApi.getOverview().then(setData).catch(() => {});
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Công Nợ</h1>
        <p className="text-sm text-gray-500 mt-1">Theo dõi công nợ phải trả nhà cung cấp & vận chuyển</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <Link href="/dashboard/cong-no/phai-tra"
          className="block rounded-xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white hover:opacity-90 transition-opacity">
          <p className="text-sm font-medium opacity-80">Phải Trả (mình nợ NCC & VC)</p>
          <p className="text-xl font-bold mt-1">{data ? VND(data.phaiTra) : '...'}</p>
          <p className="text-xs opacity-70 mt-1">{data?.phaiTraPartners ?? '–'} đối tác</p>
          <p className="text-xs opacity-60 mt-2">Xem chi tiết →</p>
        </Link>
      </div>

      {/* Quick link */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Thanh toán cho NCC / VC</h3>
        <p className="text-xs text-gray-500 mb-3">Ghi nhận thanh toán trong đơn hàng nhập để cập nhật công nợ NCC tự động.</p>
        <Link href="/dashboard/don-hang-nhap"
          className="inline-block px-3 py-1.5 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700">
          Đơn hàng nhập →
        </Link>
      </div>
    </div>
  );
}

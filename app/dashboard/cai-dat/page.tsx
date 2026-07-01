'use client';

import Link from 'next/link';

interface SettingCard {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  soon?: boolean;
}

interface SettingGroup {
  title: string;
  cards: SettingCard[];
}

const groups: SettingGroup[] = [
  {
    title: 'Thiết Lập Hệ Thống',
    cards: [
      {
        href: '/dashboard/cai-dat/chung',
        label: 'Thông Tin Công Ty',
        description: 'Tên, địa chỉ, MST, email, website và cài đặt chung',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        href: '/dashboard/cai-dat/chung?tab=pttt',
        label: 'Phương Thức Thanh Toán',
        description: 'Quản lý các hình thức thanh toán: tiền mặt, chuyển khoản, MoMo...',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/cai-dat/vai-tro',
        label: 'Vai Trò & Quyền',
        description: 'Quản lý vai trò nhân viên và nhóm quyền trong hệ thống',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/branches',
        label: 'Chi Nhánh',
        description: 'Thêm và quản lý thông tin các chi nhánh, điểm bán',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/cai-dat/tai-khoan-nh',
        label: 'Tài Khoản Ngân Hàng',
        description: 'Quản lý tài khoản ngân hàng dùng cho chuyển khoản và sổ quỹ',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Kế Toán & Tài Chính',
    cards: [
      {
        href: '/dashboard/cai-dat/chot-so',
        label: 'Chốt Sổ & Khóa Kỳ',
        description: 'Khóa kỳ kế toán, snapshot số liệu cuối kỳ, mở lại khi cần',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/ho-tro-ke-toan-thue',
        label: 'Hỗ Trợ Kế Toán Thuế',
        description: 'Đối soát VAT, xuất chứng từ Excel, tổng hợp thuế TNDN',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Danh Mục',
    cards: [
      {
        href: '/dashboard/products/bang-gia',
        label: 'Bảng Giá',
        description: 'Thiết lập ma trận giá 5 nhóm và bảng giá đặt tên cho từng đối tác',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/van-chuyen/phuong-thuc',
        label: 'Đơn Vị Vận Chuyển',
        description: 'Quản lý các đơn vị vận chuyển: GHTK, GHN, Viettel Post...',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 17h1m4 0h1M3 9h18M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/products/don-vi-tinh',
        label: 'Đơn Vị Tính',
        description: 'Quản lý đơn vị đo lường: cái, hộp, kg, thùng...',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        ),
        soon: true,
      },
    ],
  },
  {
    title: 'Nhật Ký & Hỗ Trợ',
    cards: [
      {
        href: '/dashboard/nhat-ky',
        label: 'Nhật Ký Hệ Thống',
        description: 'Xem lịch sử hoạt động: tạo, sửa, xóa, thay đổi trạng thái',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        href: '/dashboard/huong-dan',
        label: 'Hướng Dẫn Sử Dụng',
        description: 'Tài liệu hướng dẫn sử dụng các tính năng trong hệ thống',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        soon: true,
      },
    ],
  },
];

export default function CaiDatPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Cài Đặt</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý cấu hình hệ thống, danh mục và phân quyền</p>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {group.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`group flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all ${
                    card.soon ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    {card.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{card.label}</span>
                      {card.soon && (
                        <span className="text-[9px] bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 font-medium">WIP</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{card.description}</p>
                  </div>
                  {!card.soon && (
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

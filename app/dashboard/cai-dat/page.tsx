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
    title: 'Cửa Hàng',
    cards: [
      {
        href: '/dashboard/cai-dat/chung',
        label: 'Thông Tin Công Ty',
        description: 'Tên, địa chỉ, MST, email, website và cài đặt VAT mặc định',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        href: '/dashboard/cai-dat/chung?tab=pttt',
        label: 'Phương Thức Thanh Toán',
        description: 'Tiền mặt, chuyển khoản, MoMo và các hình thức khác',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/branches',
        label: 'Chi Nhánh',
        description: 'Thêm và quản lý thông tin các chi nhánh, điểm bán',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/cai-dat/tai-khoan-nh',
        label: 'Tài Khoản Ngân Hàng',
        description: 'Quản lý tài khoản NH dùng cho chuyển khoản và sổ quỹ',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Nhân Sự & Phân Quyền',
    cards: [
      {
        href: '/dashboard/cai-dat/vai-tro',
        label: 'Vai Trò & Quyền',
        description: 'Quản lý vai trò nhân viên và nhóm quyền trong hệ thống',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/employees',
        label: 'Nhân Viên & Tài Khoản',
        description: 'Danh sách nhân viên, tài khoản đăng nhập và phân quyền chi nhánh',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
        description: 'Ma trận giá 5 nhóm và bảng giá đặt tên cho từng đối tác',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/thu-chi/loai-phieu',
        label: 'Loại Phiếu Thu / Chi',
        description: 'Quản lý danh mục loại phiếu thu và phiếu chi',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        ),
      },
      {
        href: '/dashboard/products/don-vi-tinh',
        label: 'Đơn Vị Tính',
        description: 'Quản lý đơn vị đo lường: cái, hộp, kg, thùng...',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Vận Hành',
    cards: [
      {
        href: '/dashboard/cai-dat/mau-in',
        label: 'Mẫu In',
        description: 'Thiết kế mẫu in hóa đơn, phiếu giao hàng, phiếu thu chi',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/cai-dat/backup',
        label: 'Backup & Restore',
        description: 'Sao lưu dữ liệu định kỳ, xem lịch sử và hướng dẫn khôi phục',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7M9 21v-6a2 2 0 012-2h2a2 2 0 012 2v6" />
          </svg>
        ),
      },
      {
        href: '/dashboard/cai-dat/nhap-xuat-du-lieu',
        label: 'Nhập / Xuất Dữ Liệu',
        description: 'Import sản phẩm, khách hàng từ Excel; export backup dữ liệu',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        ),
      },
      {
        href: '/dashboard/cai-dat/telegram',
        label: 'Telegram Bot',
        description: 'Nhận thông báo đơn hàng, tồn kho thấp và báo cáo ngày qua Telegram',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        ),
      },
    ],
  },
];

export default function CaiDatPage() {
  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Cài Đặt</h1>
        <p className="text-sm text-gray-400 mt-0.5">Quản lý cấu hình hệ thống, danh mục và phân quyền</p>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {group.title}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {group.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`group flex items-start gap-3 p-3.5 bg-white rounded-xl border border-gray-100 transition-all ${
                    card.soon
                      ? 'opacity-40 pointer-events-none cursor-default'
                      : 'hover:border-blue-200 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    card.soon ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-500 group-hover:bg-blue-100'
                  }`}>
                    {card.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 leading-tight">{card.label}</span>
                      {card.soon && (
                        <span className="text-[9px] bg-gray-100 text-gray-400 rounded px-1.5 py-0.5 font-medium">Sắp có</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{card.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

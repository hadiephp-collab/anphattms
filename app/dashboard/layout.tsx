'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, getUser, clearAuth } from '@/lib/auth';

interface NavChild { href: string; label: string; exact?: boolean; soon?: boolean; }
interface NavItem {
  href: string; label: string; exact: boolean; soon?: boolean;
  icon: React.ReactNode;
  children?: NavChild[];
}
interface NavSection { title: string; items: NavItem[]; }

const navSections: NavSection[] = [
  {
    title: 'Kinh Doanh',
    items: [
      {
        href: '/dashboard', label: 'Tổng Quan', exact: true,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
      },
      {
        href: '/dashboard/orders', label: 'Đơn Hàng', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
        children: [
          { href: '/dashboard/orders', label: 'Danh sách đơn', exact: true },
          { href: '/dashboard/returns', label: 'Trả hàng KH' },
          { href: '/dashboard/yeu-cau-gia', label: 'Yêu Cầu Giá' },
        ],
      },
      {
        href: '/dashboard/don-hang-nhap', label: 'Nhập Hàng', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
        children: [
          { href: '/dashboard/don-hang-nhap/trong-nuoc', label: 'Nhập Trong Nước' },
          { href: '/dashboard/don-hang-nhap/nhap-khau', label: 'Nhập Khẩu' },
          { href: '/dashboard/don-hang-nhap/tra-hang-ncc', label: 'Trả Hàng NCC', soon: true },
        ],
      },
    ],
  },
  {
    title: 'Danh Mục',
    items: [
      {
        href: '/dashboard/products', label: 'Sản Phẩm', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
        children: [
          { href: '/dashboard/products', label: 'Danh sách', exact: true },
          { href: '/dashboard/products/categories', label: 'Loại sản phẩm' },
          { href: '/dashboard/products/bang-gia', label: 'Bảng Giá' },
        ],
      },
      {
        href: '/dashboard/inventory', label: 'Tồn Kho', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
        children: [
          { href: '/dashboard/inventory', label: 'Quản lý kho', exact: true },
          { href: '/dashboard/inventory/stock-counts', label: 'Kiểm hàng' },
        ],
      },
      {
        href: '/dashboard/partners', label: 'Đối Tác', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        children: [
          { href: '/dashboard/partners', label: 'Tổng Quan', exact: true },
          { href: '/dashboard/partners/khach-hang', label: 'Khách Hàng' },
          { href: '/dashboard/partners/nha-cung-cap', label: 'Nhà Cung Cấp' },
          { href: '/dashboard/partners/don-vi-van-chuyen', label: 'Đơn Vị VC' },
        ],
      },
    ],
  },
  {
    title: 'Tài Chính',
    items: [
      {
        href: '/dashboard/thu-chi', label: 'Sổ Quỹ', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        children: [
          { href: '/dashboard/thu-chi', label: 'Tổng Quan', exact: true },
          { href: '/dashboard/thu-chi/phieu-thu', label: 'Phiếu Thu' },
          { href: '/dashboard/thu-chi/phieu-chi', label: 'Phiếu Chi' },
          { href: '/dashboard/thu-chi/so-quy', label: 'Sổ Quỹ' },
        ],
      },
      {
        href: '/dashboard/cong-no', label: 'Công Nợ', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        children: [
          { href: '/dashboard/cong-no', label: 'Tổng Quan', exact: true },
          { href: '/dashboard/cong-no/phai-thu', label: 'Phải Thu (KH)' },
          { href: '/dashboard/cong-no/phai-tra', label: 'Phải Trả (NCC & VC)' },
        ],
      },
      {
        href: '/dashboard/van-chuyen', label: 'Vận Chuyển', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 17h1m4 0h1M3 9h18M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20v-5h4l-4-5h-6v10" /></svg>,
        children: [
          { href: '/dashboard/van-chuyen/phuong-thuc', label: 'Phương thức VC' },
          { href: '/dashboard/van-chuyen/van-don', label: 'Vận đơn tracking' },
        ],
      },
      {
        href: '/dashboard/xuat-hd-vat', label: 'Kế Toán', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
        children: [
          { href: '/dashboard/xuat-hd-vat',  label: 'Xuất HĐ VAT', exact: false },
          { href: '/dashboard/nhap-hd-vat',  label: 'Nhập HĐ VAT', exact: false },
          { href: '/dashboard/cai-dat/chot-so', label: 'Chốt Sổ & Khóa Kỳ', exact: false },
          { href: '/dashboard/ho-tro-ke-toan-thue', label: 'Hỗ Trợ Kế Toán Thuế', exact: false },
          { href: '/dashboard/ton-kho-hd',    label: 'Tồn Kho HĐ (VAT)', exact: false },
          { href: '/dashboard/bao-cao-vat',   label: 'Báo Cáo Thuế VAT', exact: false },
          { href: '/dashboard/ke-toan/von-breakeven', label: 'Vốn & BreakEven', soon: true },
        ],
      },
    ],
  },
  {
    title: 'Quản Lý',
    items: [
      {
        href: '/dashboard/bao-hanh', label: 'Bảo Hành', exact: false, soon: true,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
      },
      {
        href: '/dashboard/tai-san', label: 'Tài Sản & CCDC', exact: false, soon: true,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
      },
      {
        href: '/dashboard/bao-cao', label: 'Báo Cáo', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
        children: [
          { href: '/dashboard/bao-cao', label: 'Tổng Hợp', exact: true },
          { href: '/dashboard/bao-cao/ban-hang', label: 'Bán Hàng', soon: true },
          { href: '/dashboard/bao-cao/loi-nhuan', label: 'Lợi Nhuận & Thuế', soon: true },
          { href: '/dashboard/bao-cao/crm', label: 'CRM', soon: true },
          { href: '/dashboard/bao-cao/ton-kho', label: 'Tồn Kho', soon: true },
        ],
      },
    ],
  },
  {
    title: 'Hệ Thống',
    items: [
      {
        href: '/dashboard/nhat-ky', label: 'Nhật Ký', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      },
      {
        href: '/dashboard/cai-dat', label: 'Cài Đặt', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeWidth={1.8} /></svg>,
      },
      {
        href: '/dashboard/huong-dan', label: 'Hướng Dẫn', exact: false, soon: true,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      },
    ],
  },
];

interface User { username: string; role: string; fullName?: string; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    setUser(getUser());
  }, [router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() { clearAuth(); router.push('/login'); }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  if (!user) return null;

  const initials = (user.fullName || user.username).charAt(0).toUpperCase();
  const roleLabel: Record<string, string> = { admin: 'Quản trị viên', manager: 'Quản lý', staff: 'Nhân viên' };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1a1d2e] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-blue-500/30">A</div>
            <div>
              <div className="font-bold text-white text-sm leading-tight">An Phát TMS</div>
              <div className="text-[10px] text-white/30 mt-0.5">v1.0</div>
            </div>
          </div>
        </div>

        {/* Nav — không có label nhóm, ẩn thanh cuộn */}
        <nav className="flex-1 px-3 overflow-y-scroll pb-4 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          {navSections.map((section, sIdx) => (
            <div key={section.title} className={sIdx > 0 ? 'mt-1 pt-1 border-t border-white/5' : ''}>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const expanded = item.children && (
                    pathname.startsWith(item.href) ||
                    item.children.some(c => pathname.startsWith(c.href))
                  );
                  return (
                    <div key={item.href}>
                      <Link href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          active
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
                            : item.soon
                            ? 'text-white/40 hover:text-white/60 hover:bg-white/5'
                            : 'text-white/80 hover:text-white hover:bg-white/8'
                        }`}>
                        <span className={active ? 'text-blue-400' : item.soon ? 'text-white/30' : 'text-white/60'}>{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.soon && (
                          <span className="text-[9px] bg-white/10 text-white/30 rounded px-1 py-0.5 font-medium flex-shrink-0">WIP</span>
                        )}
                      </Link>
                      {expanded && item.children && (
                        <div className="ml-7 mt-0.5 mb-1 space-y-0.5 border-l border-white/10 pl-3">
                          {item.children.map((child) => {
                            const childActive = child.exact ? pathname === child.href : pathname.startsWith(child.href);
                            return (
                              <Link key={child.href} href={child.href}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  childActive
                                    ? 'text-blue-400 bg-blue-500/10'
                                    : child.soon
                                    ? 'text-white/35 hover:text-white/55 hover:bg-white/5'
                                    : 'text-white/70 hover:text-white hover:bg-white/8'
                                }`}>
                                <span className="flex-1 truncate">{child.label}</span>
                                {child.soon && (
                                  <span className="text-[8px] bg-white/8 text-white/25 rounded px-1 flex-shrink-0">WIP</span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Right side: topbar + main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-12 bg-white border-b border-gray-100 flex-shrink-0 flex items-center justify-end px-5 shadow-sm">
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(prev => !prev)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {initials}
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-800 leading-tight">{user.fullName || user.username}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{roleLabel[user.role] || user.role}</div>
              </div>
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors rounded-xl">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto outline-none" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

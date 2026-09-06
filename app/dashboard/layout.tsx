'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, getUser, clearAuth } from '@/lib/auth';
import { capitalApi } from '@/lib/capital';

interface NavChild { href: string; label: string; exact?: boolean; soon?: boolean; hidden?: boolean; }
interface NavItem {
  href: string; label: string; exact: boolean; soon?: boolean; hidden?: boolean;
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
        href: '/dashboard/don-hang-nhap/nhap-khau', label: 'Nhập Hàng', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
      },
    ],
  },
  {
    title: 'Danh Mục',
    items: [
      {
        href: '/dashboard/products', label: 'Sản Phẩm', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>,
      },
      {
        href: '/dashboard/partners/nha-cung-cap', label: 'Nhà Cung Cấp', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
      },
      {
        href: '/dashboard/partners/don-vi-van-chuyen', label: 'Đơn Vị VC', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
      },
    ],
  },
  {
    title: 'Tài Chính',
    items: [
      {
        href: '/dashboard/thu-chi/phieu-chi', label: 'Phiếu Chi', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      },
      {
        href: '/dashboard/thu-chi/phieu-thu', label: 'Phiếu Thu', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>,
      },
      {
        href: '/dashboard/thu-chi/so-quy', label: 'Sổ Quỹ', exact: false,
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
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
    ],
  },
];

interface User { username: string; role: string; fullName?: string; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [capitalNguyHiem, setCapitalNguyHiem] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    setUser(getUser());
    capitalApi.getDashboard().then(d => {
      setCapitalNguyHiem(d.healthState === 'NGUY_HIEM');
    }).catch(() => {});
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
        <nav className="flex-1 px-3 overflow-y-scroll pb-2 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          {navSections.map((section, sIdx) => (
            <div key={section.title} className={sIdx > 0 ? 'mt-1 pt-1 border-t border-white/5' : ''}>
              <div className="space-y-0.5">
                {section.items.filter(item => !item.hidden).map((item) => {
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
                        {capitalNguyHiem && item.label === 'Kế Toán' && (
                          <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 animate-pulse" title="Tài Sản Ròng ở mức Nguy Hiểm" />
                        )}
                        {item.soon && (
                          <span className="text-[9px] bg-white/10 text-white/30 rounded px-1 py-0.5 font-medium flex-shrink-0">WIP</span>
                        )}
                      </Link>
                      {expanded && item.children && (
                        <div className="ml-7 mt-0.5 mb-1 space-y-0.5 border-l border-white/10 pl-3">
                          {item.children.filter(c => !c.hidden).map((child) => {
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

        {/* User info — cuối sidebar */}
        <div className="px-3 pb-3 flex-shrink-0 border-t border-white/8 pt-2" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(prev => !prev)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/8 transition-colors text-left">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white/90 leading-tight truncate">{user.fullName || user.username}</div>
              <div className="text-[10px] text-white/40 leading-tight">{roleLabel[user.role] || user.role}</div>
            </div>
            <svg className={`w-3 h-3 text-white/30 transition-transform flex-shrink-0 ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div className="mt-1 bg-white/10 rounded-xl py-1">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-white/8 transition-colors rounded-xl">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Right side: main only (no topbar) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-auto outline-none" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}

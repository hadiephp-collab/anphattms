'use client';
import React, { useState } from 'react';

// ─── Tab registry ────────────────────────────────────────────────────────────

const TABS = [
  // Bán hàng
  { key: 'tong-quan',            label: 'Tổng Quan',            color: '#2563eb', group: 'Bán Hàng' },
  { key: 'don-hang',             label: 'Đơn Hàng Bán',         color: '#16a34a', group: 'Bán Hàng' },
  { key: 'tra-hang',             label: 'Trả Hàng KH',          color: '#b45309', group: 'Bán Hàng' },
  { key: 'doi-tac',              label: 'Đối Tác',              color: '#7c3aed', group: 'Bán Hàng' },
  { key: 'san-pham',             label: 'Sản Phẩm',             color: '#0891b2', group: 'Bán Hàng' },
  { key: 'ton-kho',              label: 'Tồn Kho',              color: '#d97706', group: 'Bán Hàng' },
  { key: 'bao-hanh',             label: 'Bảo Hành',             color: '#0891b2', group: 'Bán Hàng' },
  { key: 'yeu-cau-gia',          label: 'Yêu Cầu Giá',          color: '#b45309', group: 'Bán Hàng' },
  { key: 'bang-gia',             label: 'Bảng Giá',             color: '#7c3aed', group: 'Bán Hàng' },
  // Nhập hàng
  { key: 'don-nhap',             label: 'Đơn Hàng Nhập',        color: '#0e7490', group: 'Nhập Hàng' },
  { key: 'tra-hang-ncc',         label: 'Trả Hàng NCC',         color: '#92400e', group: 'Nhập Hàng' },
  // Vận hành
  { key: 'van-chuyen',           label: 'Vận Chuyển',           color: '#5b21b6', group: 'Vận Hành' },
  { key: 'nhan-vien',            label: 'Nhân Viên',            color: '#be185d', group: 'Vận Hành' },
  { key: 'chi-nhanh',            label: 'Chi Nhánh',            color: '#166534', group: 'Vận Hành' },
  { key: 'tai-san',              label: 'Tài Sản & CCDC',       color: '#92400e', group: 'Vận Hành' },
  // Kế toán
  { key: 'thu-chi',              label: 'Thu Chi',              color: '#dc2626', group: 'Kế Toán' },
  { key: 'cong-no',              label: 'Công Nợ',              color: '#0f766e', group: 'Kế Toán' },
  { key: 'vat-xuat',             label: 'Xuất HĐ VAT',          color: '#1d4ed8', group: 'Kế Toán' },
  { key: 'vat-nhap',             label: 'Nhập HĐ VAT',          color: '#15803d', group: 'Kế Toán' },
  { key: 'chot-so',              label: 'Chốt Sổ & Khóa Kỳ',   color: '#374151', group: 'Kế Toán' },
  { key: 'ho-tro-ke-toan-thue',  label: 'Hỗ Trợ KT Thuế',      color: '#6d28d9', group: 'Kế Toán' },
  { key: 'von-breakeven',        label: 'Vốn & BreakEven',      color: '#059669', group: 'Kế Toán' },
  // Báo cáo & Hệ thống
  { key: 'bao-cao',              label: 'Báo Cáo',              color: '#9333ea', group: 'Hệ Thống' },
  { key: 'nhat-ky',              label: 'Nhật Ký Hệ Thống',     color: '#475569', group: 'Hệ Thống' },
  { key: 'don-vi-tinh',          label: 'Đơn Vị Tính',          color: '#0369a1', group: 'Hệ Thống' },
  { key: 'tai-khoan-nh',         label: 'Tài Khoản Ngân Hàng',  color: '#0c4a6e', group: 'Hệ Thống' },
  { key: 'vai-tro',              label: 'Vai Trò & Quyền',      color: '#be185d', group: 'Hệ Thống' },
  { key: 'cai-dat',              label: 'Cài Đặt',              color: '#475569', group: 'Hệ Thống' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ─── Content map (sẽ điền dần khi port từ GAS) ───────────────────────────────

const CONTENT_MAP: Partial<Record<TabKey, () => React.JSX.Element>> = {
  // TODO: thêm content khi đọc JS_HuongDan_Core.html.txt
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-600">
        Hướng dẫn <span className="font-semibold">{label}</span>
      </p>
      <p className="text-xs text-gray-400 mt-1">đang được cập nhật...</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HuongDanPage() {
  const [activeKey, setActiveKey] = useState<TabKey>('tong-quan');

  const activeTab = TABS.find(t => t.key === activeKey)!;
  const ActiveContent = CONTENT_MAP[activeKey];

  // Group tabs for sidebar rendering
  const groups = TABS.reduce<{ group: string; tabs: typeof TABS[number][] }[]>((acc, tab) => {
    const existing = acc.find(g => g.group === tab.group);
    if (existing) existing.tabs.push(tab);
    else acc.push({ group: tab.group, tabs: [tab] });
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Hướng Dẫn Sử Dụng</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tài liệu nghiệp vụ nội bộ — tra cứu nhanh từng module ngay trong ứng dụng
        </p>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar tabs */}
        <aside className="w-52 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
          <div className="p-2 space-y-4">
            {groups.map(({ group, tabs }) => (
              <div key={group}>
                <p className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {tabs.map(tab => {
                    const isActive = tab.key === activeKey;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveKey(tab.key)}
                        style={isActive ? { backgroundColor: tab.color } : {}}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors duration-100 ${
                          isActive
                            ? 'text-white font-medium shadow-sm'
                            : 'text-gray-700 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        {tab.label}
                        {!CONTENT_MAP[tab.key] && !isActive && (
                          <span className="ml-1.5 text-[10px] text-gray-400">·</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-3xl mx-auto px-8 py-6">
            {/* Tab title bar */}
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activeTab.color }}
              />
              <h2 className="text-base font-bold text-gray-800">{activeTab.label}</h2>
              {!ActiveContent && (
                <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  Đang cập nhật
                </span>
              )}
            </div>

            {/* Content or placeholder */}
            {ActiveContent ? <ActiveContent /> : <Placeholder label={activeTab.label} />}
          </div>
        </main>
      </div>
    </div>
  );
}

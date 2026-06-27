'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { employeesApi } from '@/lib/employees';
import { branchesApi, Branch } from '@/lib/branches';

interface Employee {
  id: number; code: string; fullName: string; phone?: string; email?: string;
  department?: string; position?: string; hireDate?: string;
  baseSalary: number; isActive: boolean; userId?: number;
  user?: { id: number; username: string; role: string; isActive: boolean; branchIds: number[] } | null;
}
interface Stats { total: number; active: number; inactive: number; hasAccount: number; }

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị', manager: 'Quản lý', sales: 'Kinh doanh',
  warehouse: 'Thủ kho', accountant: 'Kế toán', viewer: 'Xem', staff: 'Nhân viên',
};
const ROLE_STYLE: Record<string, string> = {
  admin: 'bg-red-50 text-red-600 border border-red-100',
  manager: 'bg-purple-50 text-purple-600 border border-purple-100',
  sales: 'bg-blue-50 text-blue-600 border border-blue-100',
  warehouse: 'bg-amber-50 text-amber-600 border border-amber-100',
  accountant: 'bg-teal-50 text-teal-600 border border-teal-100',
  viewer: 'bg-gray-50 text-gray-500 border border-gray-200',
  staff: 'bg-sky-50 text-sky-600 border border-sky-100',
};

const ALL_COLS = [
  { key: 'fullName',   label: 'Nhân viên',        required: true },
  { key: 'department', label: 'Phòng ban / Chức vụ' },
  { key: 'phone',      label: 'Liên hệ' },
  { key: 'baseSalary', label: 'Lương CB' },
  { key: 'account',    label: 'Tài khoản' },
  { key: 'hireDate',   label: 'Ngày vào làm' },
  { key: 'status',     label: 'Trạng thái',        required: true },
];
const DEFAULT_COLS = new Set(['fullName', 'department', 'phone', 'baseSalary', 'account', 'status']);
const REQUIRED_COLS = new Set(ALL_COLS.filter(c => c.required).map(c => c.key));

function loadCols(): Set<string> {
  try {
    const s = localStorage.getItem('employees_cols');
    if (s) { const saved = new Set<string>(JSON.parse(s)); REQUIRED_COLS.forEach(k => saved.add(k)); return saved; }
  } catch {}
  return new Set(DEFAULT_COLS);
}

function fmt(n: number) { return n.toLocaleString('vi-VN'); }
function fmtDate(s?: string) { if (!s) return '—'; return new Date(s).toLocaleDateString('vi-VN'); }

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterActive, setFilterActive]   = useState('');
  const [filterDept, setFilterDept]       = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [departments, setDepartments]     = useState<string[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [limit, setLimit]     = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_COLS);
  const [showColSettings, setShowColSettings] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [branchModalEmp, setBranchModalEmp] = useState<Employee | null>(null);
  const [branchModalChecked, setBranchModalChecked] = useState<Set<number>>(new Set());
  const [branchModalSaving, setBranchModalSaving] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const allForExport = useRef<Employee[]>([]);
  const exportLock   = useRef(false);
  const [exportFlash, setExportFlash] = useState(false);
  const colRef      = useRef<HTMLDivElement>(null);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setVisibleCols(loadCols()); }, []);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (colRef.current && !colRef.current.contains(e.target as Node)) setShowColSettings(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const load = useCallback(async (s = search, p = page, l = limit, fa = filterActive, fd = filterDept, fac = filterAccount) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: String(l) };
      if (s)   params.search     = s;
      if (fa)  params.isActive   = fa;
      if (fd)  params.department = fd;
      if (fac) params.hasAccount = fac;
      const [res, st, deps] = await Promise.all([
        employeesApi.getAll(params),
        employeesApi.getStats(),
        employeesApi.getDepartments(),
      ]);
      setEmployees(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setStats(st);
      setDepartments(deps);
      setSelectedIds(new Set());
      // cache toàn bộ cho export (không phụ thuộc trang hiện tại)
      employeesApi.getAll({ ...params, page: '1', limit: '9999' }).then(all => { allForExport.current = all.items; }).catch(() => {});
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, page, limit, filterActive, filterDept, filterAccount]);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    branchesApi.getAll(true).then(setAllBranches).catch(() => {});
  }, []);

  function handleSearch(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load(v, 1, limit, filterActive, filterDept, filterAccount); }, 350);
  }
  function handleFilter(fa: string, fd: string, fac: string) {
    setFilterActive(fa); setFilterDept(fd); setFilterAccount(fac);
    setPage(1); load(search, 1, limit, fa, fd, fac);
  }
  function handlePage(p: number) { setPage(p); load(search, p, limit, filterActive, filterDept, filterAccount); }
  function handleLimit(l: number) { setLimit(l); setPage(1); load(search, 1, l, filterActive, filterDept, filterAccount); }

  useEffect(() => {
    function h(e: MouseEvent) {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) setShowBulkMenu(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelectedIds(employees.length > 0 && selectedIds.size === employees.length ? new Set() : new Set(employees.map(e => e.id)));
  }

  async function handleBulkStatus(isActive: boolean) {
    await Promise.all([...selectedIds].map(id => employeesApi.update(id, { isActive })));
    setShowBulkMenu(false);
    load(search, page, limit, filterActive, filterDept, filterAccount);
  }

  async function handleBulkDelete() {
    if (!confirm(`Xóa vĩnh viễn ${selectedIds.size} nhân viên đã chọn? Hành động này không thể hoàn tác.`)) return;
    await Promise.all([...selectedIds].map(id => employeesApi.remove(id)));
    setShowBulkMenu(false);
    load(search, page, limit, filterActive, filterDept, filterAccount);
  }

  function saveColSettings(cols: Set<string>) {
    setVisibleCols(cols);
    localStorage.setItem('employees_cols', JSON.stringify([...cols]));
    setShowColSettings(false);
  }

  function handleExport() {
    if (exportLock.current) return;
    exportLock.current = true;
    setExportFlash(true);
    setTimeout(() => { exportLock.current = false; setExportFlash(false); }, 2000);

    const data = allForExport.current.length ? allForExport.current : employees;
    const headers = ['Mã NV', 'Họ tên', 'Phòng ban', 'Chức vụ', 'SĐT', 'Email', 'Ngày vào làm', 'Lương CB', 'Tài khoản', 'Vai trò', 'Trạng thái'];
    const rows = data.map((e: Employee) => [
      e.code, e.fullName, e.department || '', e.position || '',
      e.phone || '', e.email || '',
      e.hireDate ? new Date(e.hireDate).toLocaleDateString('vi-VN') : '',
      e.baseSalary || 0,
      e.user?.username || '', e.user ? ROLE_LABEL[e.user.role] || e.user.role : '',
      e.isActive ? 'Đang làm' : 'Đã nghỉ',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nhan-vien-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  function openBranchModal(e: React.MouseEvent, emp: Employee) {
    e.stopPropagation();
    if (!emp.user) return;
    setBranchModalEmp(emp);
    setBranchModalChecked(new Set(emp.user?.branchIds ?? []));
  }

  async function saveBranchModal() {
    if (!branchModalEmp?.user) return;
    setBranchModalSaving(true);
    try {
      await employeesApi.updateUserBranches(branchModalEmp.user.id, [...branchModalChecked]);
      setBranchModalEmp(null);
      load(search, page, limit, filterActive, filterDept, filterAccount);
    } catch { /* ignore */ }
    setBranchModalSaving(false);
  }

  const kpiCards = [
    { label: 'Tổng nhân viên',  value: stats?.total ?? 0,      gradient: 'from-slate-600 to-slate-800',   shadow: 'shadow-slate-200',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
    { label: 'Đang làm việc',   value: stats?.active ?? 0,     gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-200',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { label: 'Đã có tài khoản', value: stats?.hasAccount ?? 0, gradient: 'from-blue-500 to-blue-700',      shadow: 'shadow-blue-200',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /> },
    { label: 'Đã nghỉ việc',    value: stats?.inactive ?? 0,   gradient: 'from-red-500 to-red-700',        shadow: 'shadow-red-200',
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-7 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight">Nhân Viên</h1>
          <p className="text-gray-400 text-xs mt-0.5">Quản lý hồ sơ và tài khoản nhân viên</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exportFlash}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:cursor-default ${
              exportFlash
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
            }`}>
            {exportFlash
              ? <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
              : <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>}
            {exportFlash ? 'Đang tải...' : 'Xuất file'}
          </button>
          <Link href="/dashboard/employees/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Thêm nhân viên
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-3">
          {kpiCards.map(k => (
            <div key={k.label} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${k.gradient} shadow-sm ${k.shadow} flex items-center gap-3 px-4 py-4`}>
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">{k.icon}</svg>
              </div>
              <div className="z-10">
                <p className="text-[11px] text-white/60 font-medium leading-none">{k.label}</p>
                <p className="text-2xl font-bold text-white mt-1 leading-none">{fmt(k.value)}</p>
              </div>
              <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10" />
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Gear — LEFT */}
            <div className="relative flex-shrink-0" ref={colRef}>
              <button onClick={() => setShowColSettings(v => !v)}
                className={`p-2 rounded-lg border transition-colors ${showColSettings ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              {showColSettings && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-52">
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Hiển thị cột</p>
                  {ALL_COLS.map(c => (
                    <label key={c.key} className={`flex items-center gap-2 px-1 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 ${c.required ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input type="checkbox" checked={visibleCols.has(c.key)} disabled={c.required}
                        onChange={e => {
                          const n = new Set(visibleCols);
                          e.target.checked ? n.add(c.key) : n.delete(c.key);
                          saveColSettings(n);
                        }}
                        className="w-3.5 h-3.5 rounded text-blue-500" />
                      <span className="text-sm text-gray-700">{c.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Tìm tên, mã, SĐT..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            </div>

            <select value={filterActive} onChange={e => handleFilter(e.target.value, filterDept, filterAccount)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đang làm</option>
              <option value="false">Đã nghỉ</option>
            </select>

            <select value={filterDept} onChange={e => handleFilter(filterActive, e.target.value, filterAccount)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Tất cả phòng ban</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select value={filterAccount} onChange={e => handleFilter(filterActive, filterDept, e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Tất cả TK</option>
              <option value="true">Đã có TK</option>
              <option value="false">Chưa có TK</option>
            </select>

            {(search || filterActive || filterDept || filterAccount) && (
              <button onClick={() => { setSearch(''); setFilterActive(''); setFilterDept(''); setFilterAccount(''); setPage(1); load('', 1, limit, '', '', ''); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors">
                Xoá lọc
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="text-sm font-semibold text-blue-700">
                Đã chọn <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-md">{selectedIds.size}</span> nhân viên
              </span>
              <div className="relative" ref={bulkMenuRef}>
                <button onClick={() => setShowBulkMenu(v => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition shadow-sm">
                  Chọn thao tác
                  <svg className={`w-3 h-3 transition-transform ${showBulkMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showBulkMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 min-w-[180px]">
                    <button onClick={() => handleBulkStatus(true)}
                      className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      Đổi thành Đang làm
                    </button>
                    <button onClick={() => handleBulkStatus(false)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2.5 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                      Đổi thành Đã nghỉ
                    </button>
                    <div className="my-1 border-t border-gray-100" />
                    <button onClick={handleBulkDelete}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      Xóa đã chọn
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-blue-400 hover:text-blue-600 transition font-medium">
                Bỏ chọn
              </button>
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 pl-4 py-3">
                  <input type="checkbox"
                    checked={employees.length > 0 && selectedIds.size === employees.length}
                    ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < employees.length; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                </th>
                {visibleCols.has('fullName')   && <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Nhân viên</th>}
                {visibleCols.has('department') && <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Phòng ban / Chức vụ</th>}
                {visibleCols.has('phone')      && <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Liên hệ</th>}
                {visibleCols.has('baseSalary') && <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Lương CB</th>}
                {visibleCols.has('hireDate')   && <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Ngày vào làm</th>}
                {visibleCols.has('account')    && <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Tài khoản</th>}
                {visibleCols.has('status')     && <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider">Trạng thái</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Đang tải...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Không có nhân viên nào</td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id} onClick={() => router.push(`/dashboard/employees/${emp.id}`)}
                  className={`cursor-pointer transition-colors ${selectedIds.has(emp.id) ? 'bg-blue-50/40' : 'hover:bg-blue-50/30'}`}>
                  <td className="w-10 pl-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer" />
                  </td>
                  {visibleCols.has('fullName') && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {emp.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{emp.fullName}</div>
                          <div className="text-xs text-gray-400">{emp.code}</div>
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleCols.has('department') && (
                    <td className="px-4 py-3">
                      {emp.department && <div className="font-medium text-gray-700">{emp.department}</div>}
                      {emp.position   && <div className="text-xs text-gray-400">{emp.position}</div>}
                      {!emp.department && !emp.position && <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {visibleCols.has('phone') && (
                    <td className="px-4 py-3">
                      {emp.phone && <div className="text-gray-700">{emp.phone}</div>}
                      {emp.email && <div className="text-xs text-gray-400">{emp.email}</div>}
                      {!emp.phone && !emp.email && <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {visibleCols.has('baseSalary') && (
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {emp.baseSalary > 0 ? fmt(emp.baseSalary) + 'đ' : '—'}
                    </td>
                  )}
                  {visibleCols.has('hireDate') && (
                    <td className="px-4 py-3 text-gray-600 text-sm">{fmtDate(emp.hireDate)}</td>
                  )}
                  {visibleCols.has('account') && (
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {emp.user ? (
                        <div className="flex items-start gap-2">
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLE[emp.user.role] || ROLE_STYLE.staff}`}>
                              {ROLE_LABEL[emp.user.role] || emp.user.role}
                            </span>
                            <div className="text-xs text-gray-400 mt-0.5">{emp.user.username}</div>
                            {!emp.user.isActive && <div className="text-xs text-red-400">Đã khoá</div>}
                          </div>
                          <button onClick={e => openBranchModal(e, emp)}
                            title="Phân quyền chi nhánh"
                            className="flex-shrink-0 w-6 h-6 rounded-md border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center transition-colors mt-0.5">
                            <svg className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">Chưa có TK</span>
                      )}
                    </td>
                  )}
                  {visibleCols.has('status') && (
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        emp.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-400 border border-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        {emp.isActive ? 'Đang làm' : 'Đã nghỉ'}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                {[20, 50, 100].map(n => (
                  <button key={n} onClick={() => handleLimit(n)}
                    className={`px-2 py-1 rounded-md font-medium transition ${limit === n ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {n}
                  </button>
                ))}
                <span>kết quả</span>
              </div>
              <span className="text-gray-200">·</span>
              <span>
                {total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`}
                {' '}trên tổng <span className="font-semibold text-gray-600">{total}</span> nhân viên
              </span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => handlePage(1)} disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium">«</button>
                <button onClick={() => handlePage(page - 1)} disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(p); return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis'
                      ? <span key={`e${idx}`} className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">…</span>
                      : <button key={item} onClick={() => handlePage(item as number)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page === item ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                          {item}
                        </button>
                  )}
                <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs">›</button>
                <button onClick={() => handlePage(totalPages)} disabled={page >= totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-medium">»</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branch assignment modal */}
      {branchModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Phân Quyền Chi Nhánh</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {branchModalEmp.fullName} · {branchModalEmp.user?.username}
              </p>
            </div>
            <div className="px-6 py-4 max-h-72 overflow-y-auto">
              {allBranches.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Chưa có chi nhánh nào</p>
              ) : (
                <div className="space-y-2">
                  {allBranches.map(b => (
                    <label key={b.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        branchModalChecked.has(b.id)
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}>
                      <input type="checkbox"
                        checked={branchModalChecked.has(b.id)}
                        onChange={() => {
                          setBranchModalChecked(prev => {
                            const n = new Set(prev);
                            n.has(b.id) ? n.delete(b.id) : n.add(b.id);
                            return n;
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{b.name}</span>
                          {b.isDefault && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">Mặc định</span>
                          )}
                        </div>
                        {b.address && <div className="text-xs text-gray-400 truncate">{b.address}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-400">
                {branchModalChecked.size === 0
                  ? 'Chưa chọn chi nhánh nào (truy cập toàn hệ thống)'
                  : `${branchModalChecked.size} chi nhánh được chọn`}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setBranchModalEmp(null)} disabled={branchModalSaving}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Huỷ
                </button>
                <button onClick={saveBranchModal} disabled={branchModalSaving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {branchModalSaving && (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                  )}
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

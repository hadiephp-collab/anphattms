'use client';

// PartnersListPage v3 — đồng bộ UI với module sản phẩm
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { partnersApi } from '@/lib/partners';

// ── Labels / styles ────────────────────────────────────────────────────────
const RANK_LABEL: Record<string,string> = { new:'Mới', normal:'Thường', loyal:'Thân thiết', vip:'VIP' };
const RANK_STYLE: Record<string,string> = {
  new:    'text-gray-400 bg-gray-50 border border-gray-200',
  normal: 'text-sky-600 bg-sky-50 border border-sky-100',
  loyal:  'text-emerald-600 bg-emerald-50 border border-emerald-100',
  vip:    'text-amber-500 bg-amber-50 border border-amber-200',
};
const TYPE_STYLE: Record<string,string> = {
  customer:'text-blue-600 bg-blue-50', supplier:'text-violet-600 bg-violet-50',
  both:'text-teal-600 bg-teal-50', freight:'text-orange-600 bg-orange-50',
};
const TYPE_LABEL: Record<string,string> = {
  customer:'Khách hàng', supplier:'Nhà cung cấp', both:'KH + NCC', freight:'Đơn vị VC',
};
const PAGE_CONFIG = {
  customer:{ title:'Khách Hàng',       subtitle:'Quản lý danh sách khách hàng',   btnLabel:'Thêm khách hàng', csvName:'khach-hang.csv' },
  supplier:{ title:'Nhà Cung Cấp',     subtitle:'Quản lý danh sách nhà cung cấp', btnLabel:'Thêm nhà cung cấp', csvName:'nha-cung-cap.csv' },
  freight: { title:'Đơn Vị Vận Chuyển',subtitle:'Quản lý công ty vận chuyển',     btnLabel:'Thêm đơn vị VC',   csvName:'don-vi-vc.csv' },
};
const OVERVIEW_CONFIG = { title:'Đối Tác', subtitle:'Quản lý khách hàng và nhà cung cấp', btnLabel:'Thêm đối tác', csvName:'doi-tac.csv' };

// ── Number formatter — dấu chấm nghìn, không có "đ" ──────────────────────
// TypeORM decimal columns trả về string ("2638230.00") → dùng Number() để format đúng
const fmtNum = (v: number|string) => Number(v).toLocaleString('vi-VN');
const fmtMoney = (v?: number|string|null) => Number(v ?? 0) > 0 ? fmtNum(Number(v ?? 0)) : '—';

// ── Column definitions ─────────────────────────────────────────────────────
interface ColDef  { key: string; label: string; required?: boolean; }
interface ColItem { key: string; visible: boolean; displayType?: 'truncate'|'clamp'|'wrap'; pinned?: boolean; }

const ALL_COLS: ColDef[] = [
  { key:'code',              label:'Mã',               required:true },
  { key:'name',              label:'Tên đối tác',      required:true },
  { key:'type',              label:'Loại' },
  { key:'customerType',      label:'Hình thức' },
  { key:'phone',             label:'Điện thoại' },
  { key:'contactPhone2',     label:'ĐT 2' },
  { key:'email',             label:'Email' },
  { key:'province',          label:'Tỉnh/TP' },
  { key:'rank',              label:'Hạng' },
  { key:'group',             label:'Nhóm' },
  { key:'source',            label:'Nguồn' },
  { key:'rating',            label:'Đánh giá' },
  { key:'currency',          label:'Tiền tệ' },
  { key:'totalDebt',         label:'Công nợ KH' },
  { key:'supplierDebt',      label:'Công nợ NCC' },
  { key:'creditLimit',       label:'Hạn mức CN' },
  { key:'paymentTerm',       label:'Kỳ TT (ngày)' },
  { key:'totalOrders',       label:'Tổng đơn' },
  { key:'totalRevenue',      label:'Doanh thu' },
  { key:'totalPurchase',     label:'Tổng mua hàng' },
  { key:'contactPerson',     label:'Người liên hệ' },
  { key:'address',           label:'Địa chỉ' },
  { key:'bankAccount',       label:'Số TK' },
  { key:'bankName',          label:'Ngân hàng' },
  { key:'bankAccountHolder', label:'Chủ TK' },
  { key:'bankBranch',        label:'Chi nhánh NH' },
  { key:'assignedStaff',     label:'NV phụ trách' },
  { key:'notes',             label:'Ghi chú' },
  { key:'status',            label:'Trạng thái' },
];

const DEFAULT_VISIBLE: Record<string,Set<string>> = {
  all:      new Set(['code','name','type','phone','province','rank','totalDebt','status']),
  customer: new Set(['code','name','phone','province','rank','creditLimit','totalDebt','totalOrders','status']),
  supplier: new Set(['code','name','phone','province','supplierDebt','totalPurchase','currency','rating','paymentTerm','status']),
  freight:  new Set(['code','name','phone','province','supplierDebt','status']),
};

const TEXT_DISPLAY_COLS = new Set(['name','address','notes','group','bankBranch','email','contactPerson','bankName','bankAccountHolder']);

const DEFAULT_COL_WIDTHS: Record<string,number> = {
  code:88, name:200, type:110, customerType:100,
  phone:120, contactPhone2:120, email:170,
  province:110, rank:90, group:120, source:90,
  rating:90, currency:85,
  totalDebt:125, supplierDebt:125, creditLimit:120, paymentTerm:90,
  totalOrders:85, totalRevenue:130, totalPurchase:140,
  contactPerson:130, address:200,
  bankAccount:140, bankName:140, bankAccountHolder:160, bankBranch:160,
  assignedStaff:130, notes:200, status:100,
};

const STORAGE_KEY_PREFIX    = 'partners_col_order_v3_';
const COL_WIDTHS_KEY_PREFIX = 'partners_col_widths_v3_';
const NUM_EDIT_FIELDS       = new Set(['creditLimit','paymentTerm','rating']);

// ── Data types ─────────────────────────────────────────────────────────────
interface Partner {
  id:number; code:string; name:string; type:string; customerType:string;
  phone?:string; contactPhone2?:string; email?:string; province?:string;
  rank:string; group?:string; source?:string; rating?:number; currency?:string;
  creditLimit:number; totalDebt:number; supplierDebt?:number;
  paymentTerm?:number; totalOrders:number; totalRevenue:number; totalPurchase?:number;
  contactPerson?:string; address?:string;
  bankAccount?:string; bankName?:string; bankAccountHolder?:string; bankBranch?:string;
  assignedStaff?:{ id:number; name:string };
  notes?:string; isActive:boolean;
}
interface Stats {
  total:number; customers:number; suppliers:number; freight:number; vip:number;
  customersWithDebt:number; totalCustomerDebt:number;
  suppliersWithDebt:number; totalSupplierDebt:number;
  freightWithDebt:number; totalFreightDebt:number;
  domesticSuppliers:number; foreignSuppliers:number;
}

// ── Storage helpers ────────────────────────────────────────────────────────
function getStorageKey(ctx:string){ return STORAGE_KEY_PREFIX+ctx; }
function getWidthsKey(ctx:string) { return COL_WIDTHS_KEY_PREFIX+ctx; }

function defaultColOrder(ctx:string): ColItem[] {
  const vis = DEFAULT_VISIBLE[ctx] ?? DEFAULT_VISIBLE.all;
  return ALL_COLS.map((c) => ({
    key:c.key, visible:!!c.required || vis.has(c.key),
    ...(TEXT_DISPLAY_COLS.has(c.key) ? { displayType:'truncate' as const } : {}),
  }));
}

function loadColOrder(ctx:string): ColItem[] {
  try {
    const s = localStorage.getItem(getStorageKey(ctx));
    if (s) {
      const saved: ColItem[] = JSON.parse(s);
      const savedKeys = new Set(saved.map((c) => c.key));
      const valid = saved.filter((c) => ALL_COLS.some((a) => a.key===c.key));
      ALL_COLS.forEach((c) => { if (!savedKeys.has(c.key)) valid.push({ key:c.key, visible:false }); });
      return valid;
    }
  } catch {}
  return defaultColOrder(ctx);
}

// ── Province multi-select ──────────────────────────────────────────────────
function ProvinceSelect({ value, onChange, provinces }: { value:string[]; onChange:(v:string[])=>void; provinces:string[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => provinces.filter((p) => p.toLowerCase().includes(q.toLowerCase())), [provinces, q]);
  useEffect(() => {
    function h(e:MouseEvent){ if (ref.current && !ref.current.contains(e.target as Node)){ setOpen(false); setQ(''); } }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  function toggle(p:string){ onChange(value.includes(p) ? value.filter((v)=>v!==p) : [...value, p]); }
  const lbl = value.length===0 ? 'Tỉnh / TP' : value.length===1 ? value[0] : `${value.length} tỉnh/TP`;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen((o)=>!o); setTimeout(()=>inputRef.current?.focus(),50); }}
        className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition min-w-[120px] cursor-pointer ${value.length>0?'border-blue-400 text-blue-600 bg-blue-50/60':'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}>
        <svg className="w-3 h-3 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span className="truncate flex-1 text-left text-sm">{lbl}</span>
        {value.length>0
          ? <span onClick={(e)=>{e.stopPropagation();onChange([]);}} className="text-blue-400 hover:text-blue-600"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></span>
          : <svg className={`w-3 h-3 flex-shrink-0 text-gray-400 transition-transform ${open?'rotate-180':''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        }
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-100 rounded-xl shadow-xl w-56 py-2">
          <div className="px-2 pb-1.5">
            <input ref={inputRef} type="text" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Tìm tỉnh/TP..."
              className="w-full pl-3 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"/>
          </div>
          {value.length>0 && (
            <div className="px-2 pb-1.5 flex flex-wrap gap-1">
              {value.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[11px] px-2 py-0.5 rounded-full font-medium">
                  {p}<button onClick={()=>toggle(p)}><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></button>
                </span>
              ))}
            </div>
          )}
          <div className="h-px bg-gray-50 mx-2 mb-1"/>
          <div className="overflow-y-auto" style={{maxHeight:200}}>
            {filtered.length===0
              ? <p className="px-3 py-3 text-xs text-gray-300 text-center">Không tìm thấy</p>
              : filtered.map((p) => {
                  const chk = value.includes(p);
                  return (
                    <label key={p} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${chk?'bg-blue-50/60':'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={chk} onChange={()=>toggle(p)} className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600"/>
                      <span className={`text-sm ${chk?'text-blue-700 font-medium':'text-gray-700'}`}>{p}</span>
                    </label>
                  );
                })
            }
          </div>
          {value.length>0 && (
            <div className="px-2 pt-1.5 border-t border-gray-50 mt-1">
              <button onClick={()=>onChange([])} className="w-full text-xs text-gray-400 hover:text-red-400 py-1">Xóa tất cả ({value.length})</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Column Settings Modal — centered modal, luôn hiện pin & display type ──
function ColSettingsModal({ colOrder, onSave, onClose, defaultOrder }: {
  colOrder:ColItem[]; onSave:(o:ColItem[])=>void; onClose:()=>void; defaultOrder:ColItem[];
}) {
  const [draft, setDraft] = useState<ColItem[]>([...colOrder]);
  const [dragIdx,     setDragIdx]     = useState<number|null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number|null>(null);

  function toggle(key:string){
    const def = ALL_COLS.find((c)=>c.key===key);
    if (def?.required) return;
    setDraft((p) => p.map((c) => c.key===key ? {...c, visible:!c.visible} : c));
  }
  function setPin(key:string, pinned:boolean){ setDraft((p) => p.map((c) => c.key===key ? {...c,pinned} : c)); }
  function setDT(key:string, dt:'truncate'|'clamp'|'wrap'){ setDraft((p) => p.map((c) => c.key===key ? {...c,displayType:dt} : c)); }

  function handleDragStart(e:React.DragEvent, idx:number){ e.dataTransfer.effectAllowed='move'; setDragIdx(idx); }
  function handleDragOver(e:React.DragEvent, idx:number){ e.preventDefault(); if (dragOverIdx!==idx) setDragOverIdx(idx); }
  function handleDrop(e:React.DragEvent, idx:number){
    e.preventDefault();
    if (dragIdx===null || dragIdx===idx){ setDragIdx(null); setDragOverIdx(null); return; }
    const arr=[...draft]; const [m]=arr.splice(dragIdx,1); arr.splice(idx,0,m);
    setDraft(arr); setDragIdx(null); setDragOverIdx(null);
  }
  function handleDragEnd(){ setDragIdx(null); setDragOverIdx(null); }

  const visCount = draft.filter((c)=>c.visible).length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-xl w-[400px] max-h-[85vh] flex flex-col overflow-hidden" onClick={(e)=>e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Điều chỉnh cột hiển thị</h3>
            <p className="text-xs text-gray-400 mt-0.5">Kéo ⠿ để sắp xếp · {visCount} cột đang bật</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        {/* List */}
        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-1">
          {draft.map((col, idx) => {
            const def = ALL_COLS.find((c)=>c.key===col.key); if (!def) return null;
            const isDragging  = dragIdx===idx;
            const isDragOver  = dragOverIdx===idx && dragIdx!==idx;
            const isText      = TEXT_DISPLAY_COLS.has(col.key);
            return (
              <div key={col.key} draggable
                onDragStart={(e)=>handleDragStart(e,idx)} onDragOver={(e)=>handleDragOver(e,idx)}
                onDrop={(e)=>handleDrop(e,idx)} onDragEnd={handleDragEnd}
                className={[
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all select-none cursor-grab active:cursor-grabbing',
                  isDragOver  ? 'border-blue-400 bg-blue-50 shadow-sm' : col.visible ? 'border-blue-100 bg-blue-50/40' : 'border-gray-100 bg-white',
                  isDragging  ? 'opacity-30 scale-95' : '',
                ].join(' ')}>
                {/* Drag handle — 6 dots */}
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" fill="currentColor" viewBox="0 0 16 16">
                  <circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/>
                  <circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/>
                  <circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/>
                </svg>
                <input type="checkbox" checked={col.visible} disabled={!!def.required} onChange={()=>toggle(col.key)}
                  className="w-4 h-4 accent-blue-600 rounded flex-shrink-0 cursor-pointer disabled:cursor-default"/>
                <span className="text-sm text-gray-700 font-medium flex-1 leading-none">{def.label}</span>
                {def.required && <span className="text-[10px] text-gray-300 flex-shrink-0">bắt buộc</span>}
                {/* Pin button — luôn hiện */}
                <button onClick={(e)=>{ e.stopPropagation(); setPin(col.key, !col.pinned); }}
                  title={col.pinned ? 'Bỏ ghim cột' : 'Ghim cột (cố định khi kéo ngang)'}
                  className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors ${col.pinned?'text-blue-500 bg-blue-50':'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/>
                  </svg>
                </button>
                {/* Display type — chỉ text cols, luôn hiện */}
                {isText && (
                  <div className="flex items-center rounded-md border border-gray-200 overflow-hidden flex-shrink-0" onClick={(e)=>e.stopPropagation()}>
                    {(['truncate','clamp','wrap'] as const).map((dt, i) => {
                      const labels = ['Cắt','2 dòng','Đầy đủ'];
                      const active = (col.displayType ?? 'truncate') === dt;
                      return (
                        <button key={dt} onClick={()=>setDT(col.key, dt)}
                          className={['px-1.5 py-0.5 text-[10px] font-medium transition-colors leading-none', i>0?'border-l border-gray-200':'', active?'bg-blue-600 text-white':'bg-white text-gray-400 hover:bg-gray-50'].join(' ')}>
                          {labels[i]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button onClick={()=>setDraft([...defaultOrder])} className="text-xs text-gray-400 hover:text-gray-600 font-medium transition">Khôi phục mặc định</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Hủy</button>
            <button onClick={()=>onSave(draft)} className="px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PartnersListPage({ fixedTypeGroup }: { fixedTypeGroup?:'customer'|'supplier'|'freight' }) {
  const router = useRouter();
  const ctx = fixedTypeGroup ?? 'all';
  const cfg = fixedTypeGroup ? PAGE_CONFIG[fixedTypeGroup] : OVERVIEW_CONFIG;

  const [partners,       setPartners]       = useState<Partner[]>([]);
  const [stats,          setStats]          = useState<Stats>({ total:0,customers:0,suppliers:0,freight:0,vip:0,customersWithDebt:0,totalCustomerDebt:0,suppliersWithDebt:0,totalSupplierDebt:0,freightWithDebt:0,totalFreightDebt:0,domesticSuppliers:0,foreignSuppliers:0 });
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);
  const [limit,          setLimit]          = useState<20|50|100>(20);
  const [loading,        setLoading]        = useState(true);
  const [selectedIds,    setSelectedIds]    = useState<Set<number>>(new Set());
  const [showBulkMenu,   setShowBulkMenu]   = useState(false);
  const [showRankPick,   setShowRankPick]   = useState(false);
  const [search,         setSearch]         = useState('');
  const [filterType,     setFilterType]     = useState('');
  const [filterRank,     setFilterRank]     = useState('');
  const [filterProvince, setFilterProvince] = useState<string[]>([]);
  const [filterGroup,    setFilterGroup]    = useState('');
  const [provinces,      setProvinces]      = useState<string[]>([]);
  const [groups,         setGroups]         = useState<string[]>([]);
  const [sortBy,         setSortBy]         = useState('createdAt');
  const [sortOrder,      setSortOrder]      = useState<'ASC'|'DESC'>('DESC');
  const [hoveredId,      setHoveredId]      = useState<number|null>(null);
  const [highlightId,    setHighlightId]    = useState<number|null>(null);
  const [editingCell,    setEditingCell]    = useState<{id:number;field:string;value:string}|null>(null);
  const [expandedCell,   setExpandedCell]   = useState<{label:string;text:string}|null>(null);
  const [showColModal,   setShowColModal]   = useState(false);
  const [selectionMode,  setSelectionMode]  = useState(false);
  const showCheckboxes = selectionMode || selectedIds.size > 0;
  const [colOrder,       setColOrder]       = useState<ColItem[]>(() => defaultColOrder(ctx));
  const [colWidths,      setColWidths]      = useState<Record<string,number>>(() => {
    try { const s = localStorage.getItem(getWidthsKey(ctx)); if (s) return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(s) }; } catch {}
    return { ...DEFAULT_COL_WIDTHS };
  });

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollLeft = useRef(0);
  const bulkRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setColOrder(loadColOrder(ctx)); }, [ctx]);

  useEffect(() => {
    function h(e:MouseEvent){ if (bulkRef.current && !bulkRef.current.contains(e.target as Node)){ setShowBulkMenu(false); setShowRankPick(false); } }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Columns ─────────────────────────────────────────────────────────
  const visibleCols = colOrder.filter((c)=>c.visible);

  const stickyLeft = useMemo<Record<string,number>>(() => {
    const r:Record<string,number> = {}; let left = showCheckboxes ? 40 : 0;
    for (const col of visibleCols) {
      if (col.pinned){ r[col.key]=left; left += colWidths[col.key]??DEFAULT_COL_WIDTHS[col.key]??120; }
    }
    return r;
  }, [visibleCols, colWidths, showCheckboxes]);

  function onResizeMouseDown(e:React.MouseEvent, colKey:string) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startW = colWidths[colKey]??DEFAULT_COL_WIDTHS[colKey]??120;
    document.body.style.cursor='col-resize'; document.body.style.userSelect='none';
    function onMove(ev:MouseEvent){ const w=Math.max(60,startW+ev.clientX-startX); setColWidths((p)=>{ const n={...p,[colKey]:w}; try{localStorage.setItem(getWidthsKey(ctx),JSON.stringify(n));}catch{} return n; }); }
    function onUp(){ document.body.style.cursor=''; document.body.style.userSelect=''; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); }
    document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
  }

  function handleSaveCols(newOrder:ColItem[]) {
    setColOrder(newOrder); try{localStorage.setItem(getStorageKey(ctx),JSON.stringify(newOrder));}catch{}
    setShowColModal(false);
  }

  function getDisplayType(key:string): 'truncate'|'clamp'|'wrap' {
    return colOrder.find((c)=>c.key===key)?.displayType ?? 'truncate';
  }

  // ── Data loading ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string,string> = { sortBy, sortOrder, page:String(page), limit:String(limit) };
      if (search) params.search = search;
      if (fixedTypeGroup) params.typeGroup=fixedTypeGroup; else if (filterType) params.type=filterType;
      if (filterRank) params.rank=filterRank;
      if (filterProvince.length>0) params.province=filterProvince.join(',');
      if (filterGroup) params.group=filterGroup;
      const [res, s] = await Promise.all([partnersApi.getAll(params), partnersApi.getStats()]);
      setPartners(res.data); setTotal(res.total); setTotalPages(res.totalPages||1); setStats(s); setSelectedIds(new Set());
      if (res.data?.length>0){
        const g=[...new Set<string>(res.data.map((p:Partner)=>p.group).filter(Boolean) as string[])].sort();
        setGroups((prev)=>[...new Set([...prev,...g])].sort());
      }
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterType, filterRank, filterProvince.join(','), filterGroup, sortBy, sortOrder, page, limit, fixedTypeGroup]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { partnersApi.getProvinces().then(setProvinces).catch(()=>{}); }, []);

  // Restore scroll position after reload
  useEffect(() => {
    if (!loading && savedScrollLeft.current>0) {
      requestAnimationFrame(() => { if (tableScrollRef.current) tableScrollRef.current.scrollLeft=savedScrollLeft.current; });
    }
  }, [loading]);

  // ── Sort / select ─────────────────────────────────────────────────────
  function handleSort(field:string){
    savedScrollLeft.current=tableScrollRef.current?.scrollLeft??0;
    setPage(1);
    if (sortBy===field) setSortOrder((o)=>o==='ASC'?'DESC':'ASC'); else { setSortBy(field); setSortOrder('DESC'); }
  }
  function toggleSelect(id:number){ setSelectionMode(true); setSelectedIds((p)=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function toggleSelectAll(){ setSelectionMode(true); setSelectedIds(selectedIds.size===partners.length ? new Set() : new Set(partners.map((p)=>p.id))); }
  function exitSelectionMode(){ setSelectionMode(false); setSelectedIds(new Set()); }

  // ── Bulk ──────────────────────────────────────────────────────────────
  async function handleBulkDelete(){
    if (!confirm(`Xác nhận xóa ${selectedIds.size} đối tác đã chọn?`)) return;
    await Promise.all([...selectedIds].map((id)=>partnersApi.remove(id)));
    setShowBulkMenu(false); load();
  }
  async function handleBulkRank(rank:string){
    await Promise.all([...selectedIds].map((id)=>partnersApi.update(id,{rank})));
    setShowBulkMenu(false); setShowRankPick(false); load();
  }

  // ── Inline edit ───────────────────────────────────────────────────────
  async function saveEdit(){
    if (!editingCell) return;
    const { id, field, value } = editingCell; setEditingCell(null);
    const parsed: unknown = NUM_EDIT_FIELDS.has(field) ? (value.trim()===''?null:Number(value)) : (value?.trim()||null);
    try { await partnersApi.update(id,{[field]:parsed}); setPartners((p)=>p.map((r)=>r.id===id?{...r,[field]:parsed} as Partner:r)); } catch {}
  }

  // ── CSV export ────────────────────────────────────────────────────────
  function exportCSV(ids?:Set<number>){
    const rows = ids ? partners.filter((p)=>ids.has(p.id)) : partners;
    const headers = ['Mã','Tên','Loại','SĐT','Email','Tỉnh/TP','Hạng','Nhóm','Đánh giá','Tiền tệ','Công nợ KH','Công nợ NCC','Hạn mức CN','Tổng đơn','Doanh thu','Ngân hàng','Số TK','Chủ TK','Ghi chú','Trạng thái'];
    const data = rows.map((p)=>[p.code,p.name,TYPE_LABEL[p.type]||p.type,p.phone||'',p.email||'',p.province||'',RANK_LABEL[p.rank]||p.rank,p.group||'',p.rating??'',p.currency||'VND',p.totalDebt??0,p.supplierDebt??0,p.creditLimit??0,p.totalOrders??0,p.totalRevenue??0,p.bankName||'',p.bankAccount||'',p.bankAccountHolder||'',p.notes||'',p.isActive?'Hoạt động':'Ngừng']);
    const csv=[headers,...data].map((r)=>r.map((c)=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=cfg.csvName; a.click(); URL.revokeObjectURL(url);
    setShowBulkMenu(false);
  }

  // ── Pencil button ─────────────────────────────────────────────────────
  function PencilBtn({ id, field, val }:{ id:number; field:string; val:string }) {
    return (
      <button className="opacity-0 group-hover/ec:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all"
        onClick={(e)=>{ e.stopPropagation(); setEditingCell({id,field,value:val}); }}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
      </button>
    );
  }

  // ── Cell content helpers — trả về JSX nội dung (KHÔNG bao gồm <td>) ─
  function textContent(key:string, val:string|null|undefined, id:number, cls='text-gray-600', multiline=false) {
    const label = ALL_COLS.find((c)=>c.key===key)?.label??key;
    if (editingCell?.id===id && editingCell?.field===key) {
      if (multiline) return <textarea autoFocus rows={2} value={editingCell.value} onChange={(e)=>setEditingCell({...editingCell,value:e.target.value})} onKeyDown={(e)=>{if(e.key==='Escape')setEditingCell(null);}} onBlur={saveEdit} className="w-full text-sm border border-blue-400 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-none" onClick={(e)=>e.stopPropagation()}/>;
      return <input autoFocus value={editingCell.value} onChange={(e)=>setEditingCell({...editingCell,value:e.target.value})} onKeyDown={(e)=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditingCell(null);}} onBlur={saveEdit} className="w-full text-sm border border-blue-400 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 bg-white" onClick={(e)=>e.stopPropagation()}/>;
    }
    const dt=getDisplayType(key);
    const pb=<PencilBtn id={id} field={key} val={val||''}/>;
    if (!val) return <div className="flex items-center gap-0.5 group/ec"><span className="text-sm text-gray-300 flex-1">—</span>{pb}</div>;
    if (dt==='clamp') return <div className="flex items-start gap-0.5 group/ec"><span className={`text-sm ${cls} line-clamp-2 whitespace-normal break-words cursor-pointer hover:text-blue-500 flex-1`} onClick={(e)=>{e.stopPropagation();setExpandedCell({label,text:val});}}>{val}</span>{pb}</div>;
    if (dt==='wrap')  return <div className="flex items-start gap-0.5 group/ec"><span className={`text-sm ${cls} whitespace-normal break-words flex-1`}>{val}</span>{pb}</div>;
    return <div className="flex items-center gap-0.5 group/ec"><span className={`text-sm ${cls} truncate flex-1`} title={val}>{val}</span>{pb}</div>;
  }

  function numContent(field:string, val:number|null|undefined, id:number, display:(v:number)=>string, cls='text-gray-700') {
    if (editingCell?.id===id && editingCell?.field===field) return <input autoFocus type="number" value={editingCell.value} onChange={(e)=>setEditingCell({...editingCell,value:e.target.value})} onKeyDown={(e)=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditingCell(null);}} onBlur={saveEdit} className="w-full text-sm border border-blue-400 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 bg-white" onClick={(e)=>e.stopPropagation()}/>;
    return <div className="flex items-center gap-0.5 group/ec"><span className={`text-sm ${cls} flex-1`}>{val!=null?display(val):<span className="text-gray-300">—</span>}</span><PencilBtn id={id} field={field} val={val!=null?String(val):''}/></div>;
  }

  // ── renderCell — tạo <td> với đầy đủ style sticky + width ───────────
  function renderCell(key:string, p:Partner) {
    const w = colWidths[key]??DEFAULT_COL_WIDTHS[key]??120;
    const isSticky = key in stickyLeft;
    const rowBg = hoveredId===p.id?'#eff6ff':highlightId===p.id?'#fefce8':'white';
    const style:React.CSSProperties = {
      minWidth:w, maxWidth:w,
      ...(isSticky?{position:'sticky',left:stickyLeft[key],zIndex:10,backgroundColor:rowBg}:{}),
    };
    const tdCls=`px-4 py-1.5 text-sm text-gray-600 ${isSticky?'shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]':''}`;

    switch (key) {
      case 'code': return <td key={key} style={style} className={tdCls}><span className="font-mono text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-1 rounded-md">{p.code}</span></td>;

      case 'name': return <td key={key} style={style} className={tdCls}>
        {editingCell?.id===p.id&&editingCell?.field==='name'
          ? <input autoFocus value={editingCell.value} onChange={(e)=>setEditingCell({...editingCell,value:e.target.value})} onKeyDown={(e)=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditingCell(null);}} onBlur={saveEdit} className="w-full text-sm border border-blue-400 rounded-md px-2 py-1 outline-none" onClick={(e)=>e.stopPropagation()}/>
          : (()=>{ const dt=getDisplayType('name'); return <div className="flex items-center gap-0.5 group/ec"><span className={`text-sm font-semibold text-gray-900 flex-1 ${dt==='truncate'?'truncate':dt==='clamp'?'line-clamp-2 break-words whitespace-normal':'whitespace-normal break-words'}`} title={dt==='truncate'?p.name:undefined}>{p.name}</span><PencilBtn id={p.id} field="name" val={p.name}/></div>; })()
        }
      </td>;

      case 'type': return <td key={key} style={style} className={tdCls}><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLE[p.type]||'text-gray-500 bg-gray-50'}`}>{TYPE_LABEL[p.type]||p.type}</span></td>;
      case 'customerType': return <td key={key} style={style} className={tdCls}><span className="text-sm text-gray-500">{p.customerType==='business'?'Doanh nghiệp':'Cá nhân'}</span></td>;

      case 'phone': return <td key={key} style={style} className={tdCls} onClick={(e)=>e.stopPropagation()}>
        {editingCell?.id===p.id&&editingCell?.field==='phone'
          ? <input autoFocus type="tel" value={editingCell.value} onChange={(e)=>setEditingCell({...editingCell,value:e.target.value})} onKeyDown={(e)=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditingCell(null);}} onBlur={saveEdit} className="w-full text-sm border border-blue-400 rounded-md px-2 py-1 outline-none"/>
          : <div className="flex items-center gap-0.5 group/ec">{p.phone?<a href={`tel:${p.phone}`} onClick={(e)=>e.stopPropagation()} className="text-sm text-blue-600 hover:underline flex-1 truncate">{p.phone}</a>:<span className="text-gray-300 text-sm flex-1">—</span>}<PencilBtn id={p.id} field="phone" val={p.phone||''}/></div>
        }
      </td>;

      case 'contactPhone2': return <td key={key} style={style} className={tdCls} onClick={(e)=>e.stopPropagation()}>
        {editingCell?.id===p.id&&editingCell?.field==='contactPhone2'
          ? <input autoFocus type="tel" value={editingCell.value} onChange={(e)=>setEditingCell({...editingCell,value:e.target.value})} onKeyDown={(e)=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditingCell(null);}} onBlur={saveEdit} className="w-full text-sm border border-blue-400 rounded-md px-2 py-1 outline-none"/>
          : <div className="flex items-center gap-0.5 group/ec">{p.contactPhone2?<span className="text-sm text-gray-600 flex-1">{p.contactPhone2}</span>:<span className="text-gray-300 text-sm flex-1">—</span>}<PencilBtn id={p.id} field="contactPhone2" val={p.contactPhone2||''}/></div>
        }
      </td>;

      case 'email':    return <td key={key} style={style} className={tdCls}>{textContent('email',p.email,p.id)}</td>;
      case 'province': return <td key={key} style={style} className={tdCls}>{textContent('province',p.province,p.id)}</td>;
      case 'rank':     return <td key={key} style={style} className={tdCls}><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RANK_STYLE[p.rank]||''}`}>{RANK_LABEL[p.rank]||p.rank}</span></td>;
      case 'group':    return <td key={key} style={style} className={tdCls}>{textContent('group',p.group,p.id)}</td>;
      case 'source':   return <td key={key} style={style} className={tdCls}><span className="text-sm text-gray-500">{p.source||<span className="text-gray-300">—</span>}</span></td>;

      case 'rating': return <td key={key} style={style} className={tdCls}>
        {p.rating!=null&&p.rating>0
          ? <div className="flex items-center gap-0.5">{[1,2,3,4,5].map((s)=><span key={s} className={`text-sm leading-none ${s<=p.rating!?'text-amber-400':'text-gray-200'}`}>★</span>)}</div>
          : <span className="text-gray-300 text-sm">—</span>}
      </td>;

      case 'currency': return <td key={key} style={style} className={tdCls}>
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded font-semibold ${(p.currency||'VND')!=='VND'?'bg-violet-50 text-violet-600':'text-gray-400'}`}>{p.currency||'VND'}</span>
      </td>;

      // Số tiền: Number() để xử lý TypeORM decimal string, toLocaleString('vi-VN') cho dấu chấm
      case 'totalDebt':    return <td key={key} style={style} className={tdCls}>{numContent('totalDebt',Number(p.totalDebt)||null,p.id,(v)=>fmtMoney(v),Number(p.totalDebt)>0?'text-red-600 font-semibold':'text-gray-400')}</td>;
      case 'supplierDebt': return <td key={key} style={style} className={tdCls}>{numContent('supplierDebt',Number(p.supplierDebt??0)||null,p.id,(v)=>fmtMoney(v),Number(p.supplierDebt??0)>0?'text-orange-600 font-semibold':'text-gray-400')}</td>;
      case 'creditLimit':  return <td key={key} style={style} className={tdCls}>{numContent('creditLimit',Number(p.creditLimit)||null,p.id,(v)=>fmtNum(v))}</td>;
      case 'paymentTerm':  return <td key={key} style={style} className={tdCls}>{numContent('paymentTerm',Number(p.paymentTerm)||null,p.id,(v)=>`${v} ngày`)}</td>;
      case 'totalOrders':  return <td key={key} style={style} className={tdCls}><span className="text-sm text-gray-700 font-medium">{Number(p.totalOrders)??0}</span></td>;
      case 'totalRevenue': return <td key={key} style={style} className={tdCls}><span className={`text-sm font-semibold ${Number(p.totalRevenue)>0?'text-emerald-600':'text-gray-400'}`}>{Number(p.totalRevenue)>0?fmtNum(p.totalRevenue):'—'}</span></td>;
      case 'totalPurchase': return <td key={key} style={style} className={tdCls}><span className={`text-sm font-semibold ${Number(p.totalPurchase??0)>0?'text-violet-600':'text-gray-400'}`}>{Number(p.totalPurchase??0)>0?fmtNum(p.totalPurchase??0):'—'}</span></td>;

      case 'contactPerson':    return <td key={key} style={style} className={tdCls}>{textContent('contactPerson',p.contactPerson,p.id)}</td>;
      case 'address':          return <td key={key} style={style} className={tdCls}>{textContent('address',p.address,p.id,'text-gray-600',true)}</td>;
      case 'bankAccount':      return <td key={key} style={style} className={tdCls}>{textContent('bankAccount',p.bankAccount,p.id,'text-gray-500 font-mono')}</td>;
      case 'bankName':         return <td key={key} style={style} className={tdCls}>{textContent('bankName',p.bankName,p.id)}</td>;
      case 'bankAccountHolder':return <td key={key} style={style} className={tdCls}>{textContent('bankAccountHolder',p.bankAccountHolder,p.id)}</td>;
      case 'bankBranch':       return <td key={key} style={style} className={tdCls}>{textContent('bankBranch',p.bankBranch,p.id,'text-gray-600',true)}</td>;

      case 'assignedStaff': return <td key={key} style={style} className={tdCls}>
        {p.assignedStaff
          ? <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{p.assignedStaff.name.charAt(0)}</span><span className="text-sm text-gray-700 truncate">{p.assignedStaff.name}</span></div>
          : <span className="text-gray-300 text-sm">—</span>}
      </td>;

      case 'notes':  return <td key={key} style={style} className={tdCls}>{textContent('notes',p.notes,p.id,'text-gray-500',true)}</td>;
      case 'status': return <td key={key} style={style} className={tdCls}><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive?'bg-emerald-50 text-emerald-600':'bg-gray-100 text-gray-400'}`}>{p.isActive?'Hoạt động':'Ngừng'}</span></td>;
      default:       return <td key={key} style={style} className={tdCls}><span className="text-gray-300 text-sm">—</span></td>;
    }
  }

  // ── KPI row — nhỏ gọn, đồng bộ style ────────────────────────────────
  function renderKpi() {
    let kpis: {label:string;value:string|number;color:string}[];
    if (fixedTypeGroup==='supplier'){
      kpis=[{label:'Tổng NCC',value:stats.suppliers,color:'text-violet-600'},{label:'Trong nước',value:stats.domesticSuppliers,color:'text-blue-600'},{label:'Nước ngoài',value:stats.foreignSuppliers,color:'text-orange-600'},{label:'Tổng nợ NCC',value:Number(stats.totalSupplierDebt)>0?fmtNum(Number(stats.totalSupplierDebt)):'0',color:'text-red-600'}];
    } else if (fixedTypeGroup==='customer'){
      kpis=[{label:'Tổng KH',value:stats.customers,color:'text-blue-600'},{label:'VIP',value:stats.vip,color:'text-amber-500'},{label:'Có công nợ',value:stats.customersWithDebt,color:'text-red-500'},{label:'Tổng nợ KH',value:Number(stats.totalCustomerDebt)>0?fmtNum(Number(stats.totalCustomerDebt)):'0',color:'text-red-600'}];
    } else {
      kpis=[{label:'Tổng đối tác',value:stats.total,color:'text-gray-800'},{label:'Khách hàng',value:stats.customers,color:'text-blue-600'},{label:'Nhà cung cấp',value:stats.suppliers,color:'text-violet-600'},{label:'Đơn vị VC',value:stats.freight,color:'text-orange-600'}];
    }
    return (
      <div className="flex items-stretch gap-2 px-5 py-1.5 border-b border-gray-50 bg-white flex-shrink-0">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-2.5 bg-gray-50/80 rounded-lg px-3 py-1.5 border border-gray-100 flex-1">
            <div>
              <p className="text-[10px] text-gray-400 leading-none mb-0.5">{k.label}</p>
              <p className={`text-sm font-bold leading-none ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Sort icon in header ─────────────────────────────────────────────
  const SORTABLE:Record<string,string> = { name:'name',totalDebt:'totalDebt',supplierDebt:'supplierDebt',creditLimit:'creditLimit',totalOrders:'totalOrders',totalRevenue:'totalRevenue',totalPurchase:'totalPurchase',rank:'rank' };
  const thBase = 'text-left px-4 py-1.5 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap bg-white select-none relative group/th';

  function renderTh(key:string) {
    const label = ALL_COLS.find((c)=>c.key===key)?.label??key;
    const field = SORTABLE[key];
    const w = colWidths[key]??DEFAULT_COL_WIDTHS[key]??120;
    const isSticky = key in stickyLeft;
    const active = sortBy===field;
    const thStyle:React.CSSProperties = {
      width:w, minWidth:w,
      ...(isSticky?{position:'sticky',left:stickyLeft[key],zIndex:25,boxShadow:'2px 0 4px -2px rgba(0,0,0,0.08)'}:{}),
    };
    return (
      <th key={key} style={thStyle} className={thBase}>
        {field
          ? <div className="flex items-center gap-1 cursor-pointer" onClick={()=>handleSort(field)}>
              {label}
              <span className="flex flex-col leading-none">
                <svg className={`w-2 h-2 -mb-0.5 ${active&&sortOrder==='ASC'?'text-blue-500 opacity-100':'text-gray-500 opacity-60'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0L5 0z"/></svg>
                <svg className={`w-2 h-2 ${active&&sortOrder==='DESC'?'text-blue-500 opacity-100':'text-gray-500 opacity-60'}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0H10L5 6z"/></svg>
              </span>
            </div>
          : label}
        {key in stickyLeft && <span className="ml-1 text-blue-300 text-[9px]">📌</span>}
        {/* Resize handle */}
        <div onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation(); onResizeMouseDown(e,key); }}
          style={{position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',zIndex:10}}
          className="group/rh flex items-center justify-center hover:bg-blue-300/30 transition-colors"
          onClick={(e)=>e.stopPropagation()}>
          <div className="w-px h-3 bg-gray-300 opacity-0 group-hover/rh:opacity-100 transition-opacity"/>
        </div>
      </th>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <div><h1 className="text-base font-bold text-gray-900">{cfg.title}</h1><p className="text-xs text-gray-400">{cfg.subtitle}</p></div>
        <div className="flex items-center gap-2">
          <button onClick={()=>exportCSV()} className="flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Xuất CSV
          </button>
          <button onClick={()=>router.push(`/dashboard/partners/new${fixedTypeGroup?`?type=${fixedTypeGroup}`:''}`)} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>{cfg.btnLabel}
          </button>
        </div>
      </div>

      {/* ── KPI ── */}
      {renderKpi()}

      {/* ── Bulk bar ── */}
      {selectedIds.size>0 && (
        <div className="bg-blue-50 border-b border-blue-100 px-5 py-2 flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-semibold text-blue-700">Đã chọn {selectedIds.size}</span>
          <div className="relative" ref={bulkRef}>
            <button onClick={()=>setShowBulkMenu((o)=>!o)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
              Thao tác <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {showBulkMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-100 rounded-xl shadow-xl w-44 py-1.5">
                <button onClick={()=>exportCSV(selectedIds)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Xuất CSV đã chọn</button>
                <div className="relative">
                  <button onClick={()=>setShowRankPick((o)=>!o)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Đổi hạng...</button>
                  {showRankPick && (
                    <div className="absolute left-full top-0 ml-1 bg-white border border-gray-100 rounded-xl shadow-xl w-36 py-1.5">
                      {Object.entries(RANK_LABEL).map(([v,l])=><button key={v} onClick={()=>handleBulkRank(v)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{l}</button>)}
                    </div>
                  )}
                </div>
                <div className="h-px bg-gray-100 my-1"/>
                <button onClick={handleBulkDelete} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">Xóa {selectedIds.size} đã chọn</button>
              </div>
            )}
          </div>
          <button onClick={exitSelectionMode} className="text-xs text-blue-400 hover:text-blue-600 ml-auto">Bỏ chọn tất cả</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="bg-white border-b border-gray-50 px-5 py-2 flex items-center gap-3 flex-wrap flex-shrink-0">
        {/* Selection mode toggle */}
        <button onClick={()=>{ selectionMode ? exitSelectionMode() : setSelectionMode(true); }} title={selectionMode ? 'Thoát chọn' : 'Chọn nhiều'}
          className={`w-7 h-7 flex items-center justify-center rounded-lg border transition flex-shrink-0 ${selectionMode ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 17.5h7M17.5 14v7"/>
          </svg>
        </button>

        {/* Gear icon */}
        <button onClick={()=>setShowColModal(true)} title="Điều chỉnh & sắp xếp cột"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </button>

        <div className="relative">
          <svg className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" value={search} onChange={(e)=>{setPage(1);setSearch(e.target.value);}} placeholder="Tên, mã, SĐT, email..."
            className="pl-8 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 bg-gray-50/80 placeholder:text-gray-300"/>
        </div>

        {!fixedTypeGroup && (
          <select value={filterType} onChange={(e)=>{setPage(1);setFilterType(e.target.value);}} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tất cả loại</option><option value="customer">Khách hàng</option><option value="supplier">Nhà cung cấp</option><option value="both">KH + NCC</option><option value="freight">Đơn vị VC</option>
          </select>
        )}

        <select value={filterRank} onChange={(e)=>{setPage(1);setFilterRank(e.target.value);}} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả hạng</option><option value="new">Mới</option><option value="normal">Thường</option><option value="loyal">Thân thiết</option><option value="vip">VIP</option>
        </select>

        <ProvinceSelect value={filterProvince} onChange={(v)=>{setPage(1);setFilterProvince(v);}} provinces={provinces}/>

        {groups.length>0 && (
          <select value={filterGroup} onChange={(e)=>{setPage(1);setFilterGroup(e.target.value);}} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tất cả nhóm</option>{groups.map((g)=><option key={g} value={g}>{g}</option>)}
          </select>
        )}

        {(search||filterType||filterRank||filterProvince.length>0||filterGroup) && (
          <button onClick={()=>{setSearch('');setFilterType('');setFilterRank('');setFilterProvince([]);setFilterGroup('');setPage(1);}} className="text-xs text-gray-300 hover:text-red-400 transition flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>Xóa lọc
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {highlightId && <button onClick={()=>setHighlightId(null)} className="text-xs text-amber-500 hover:text-amber-700 border border-amber-200 px-2 py-1 rounded-lg transition">Bỏ highlight</button>}
          <span className="text-xs text-gray-300">{total.toLocaleString('vi-VN')} kết quả</span>
        </div>
      </div>

      {/* ── Table — flex-1 overflow-auto min-h-0: scrollbar luôn ở dưới vùng hiển thị ── */}
      <div ref={tableScrollRef} className="flex-1 overflow-auto min-h-0" style={{isolation:'isolate'}}>
        <table className="min-w-full text-sm" style={{borderCollapse:'separate',borderSpacing:0}}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-white">
              {showCheckboxes && <th className="w-10 pl-4 py-1.5 border-b border-gray-200" style={{position:'sticky',left:0,zIndex:30,backgroundColor:'white'}}>
                <input type="checkbox" checked={partners.length>0&&selectedIds.size===partners.length}
                  ref={(el)=>{ if(el) el.indeterminate=selectedIds.size>0&&selectedIds.size<partners.length; }}
                  onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer"/>
              </th>}
              {visibleCols.map((col)=>renderTh(col.key))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={visibleCols.length+1} className="text-center py-14"><div className="inline-flex flex-col items-center gap-2 text-gray-300"><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg><span className="text-xs">Đang tải...</span></div></td></tr>
              : partners.length===0
                ? <tr><td colSpan={visibleCols.length+1} className="text-center py-14 text-gray-300 text-sm">Không có dữ liệu</td></tr>
                : partners.map((p) => {
                    const isSel  = selectedIds.has(p.id);
                    const isHov  = hoveredId===p.id;
                    const isHigh = highlightId===p.id;
                    const rowBg  = isSel?'#dbeafe':isHigh?'#fefce8':isHov?'#eff6ff':'#ffffff';
                    return (
                      <tr key={p.id}
                        className="border-b border-gray-50 cursor-pointer transition-colors"
                        onMouseEnter={()=>setHoveredId(p.id)}
                        onMouseLeave={()=>setHoveredId(null)}
                        onClick={()=>router.push(`/dashboard/partners/${p.id}`)}
                        onContextMenu={(e)=>{ e.preventDefault(); setHighlightId(highlightId===p.id?null:p.id); }}>
                        {showCheckboxes && <td className="w-10 pl-4 py-1.5 border-b border-gray-50"
                          style={{position:'sticky',left:0,zIndex:9,backgroundColor:rowBg}}
                          onClick={(e)=>{ e.stopPropagation(); toggleSelect(p.id); }}>
                          <input type="checkbox" checked={isSel} onChange={()=>toggleSelect(p.id)} className="w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer"/>
                        </td>}
                        {visibleCols.map((col) => {
                          const cell = renderCell(col.key, p);
                          const cellEl = cell as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
                          const orig = cellEl.props.style||{};
                          const rowBorder = { borderBottom:'1px solid rgb(249 250 251)' };
                          if (col.key in stickyLeft) {
                            const w = colWidths[col.key]??DEFAULT_COL_WIDTHS[col.key]??120;
                            return React.cloneElement(cellEl, { style:{...orig,position:'sticky',left:stickyLeft[col.key],zIndex:9,backgroundColor:rowBg,boxShadow:'2px 0 4px -2px rgba(0,0,0,0.06)',minWidth:w,width:w,...rowBorder} });
                          }
                          return React.cloneElement(cellEl, { style:{...orig,...rowBorder,backgroundColor:rowBg} });
                        })}
                      </tr>
                    );
                  })
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Hiển thị</span>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              {([20,50,100] as const).map((n)=>(
                <button key={n} onClick={()=>{ setLimit(n); setPage(1); }}
                  className={`px-2.5 py-1 text-xs font-medium transition border-r border-gray-200 last:border-r-0 ${limit===n?'bg-blue-600 text-white':'text-gray-500 hover:bg-gray-50'}`}>{n}</button>
              ))}
            </div>
            <span>kết quả</span>
          </div>
          <span className="text-gray-200">·</span>
          <span className="text-xs text-gray-400">
            {total===0 ? '0' : `${(page-1)*limit+1}–${Math.min(page*limit,total)}`} trên <span className="font-semibold text-gray-600">{total}</span> đối tác
          </span>
        </div>
        {totalPages>1 && (
          <div className="flex items-center gap-1">
            <button onClick={()=>setPage(1)} disabled={page===1} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs">«</button>
            <button onClick={()=>setPage((p)=>Math.max(1,p-1))} disabled={page===1} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs">‹</button>
            {Array.from({length:totalPages},(_,i)=>i+1)
              .filter((p)=>p===1||p===totalPages||Math.abs(p-page)<=1)
              .reduce<(number|'e')[]>((acc,p,idx,arr)=>{ if (idx>0&&typeof arr[idx-1]==='number'&&(p as number)-(arr[idx-1] as number)>1) acc.push('e'); acc.push(p); return acc; },[])
              .map((p,i)=>p==='e'
                ? <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">…</span>
                : <button key={p} onClick={()=>setPage(p as number)} className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition ${page===p?'bg-blue-600 text-white':'text-gray-500 hover:bg-gray-100'}`}>{p}</button>
              )}
            <button onClick={()=>setPage((p)=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs">›</button>
            <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 text-xs">»</button>
          </div>
        )}
      </div>

      {/* ── Column settings modal (centered) ── */}
      {showColModal && <ColSettingsModal colOrder={colOrder} onSave={handleSaveCols} onClose={()=>setShowColModal(false)} defaultOrder={defaultColOrder(ctx)}/>}

      {/* ── Expanded cell modal ── */}
      {expandedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={()=>setExpandedCell(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">{expandedCell.label}</h3>
              <button onClick={()=>setExpandedCell(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{expandedCell.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}

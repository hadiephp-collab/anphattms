'use client';

import { useState, useRef } from 'react';

export interface ColDef {
  key: string;
  label: string;
  defaultOn: boolean;
}

interface ColManagerModalProps {
  allCols: ColDef[];
  visibleCols: Record<string, boolean>;
  colOrder: string[];
  saveClass?: string;
  ringClass?: string;
  onSave(vc: Record<string, boolean>, order: string[]): void;
  onClose(): void;
}

export default function ColManagerModal({
  allCols, visibleCols, colOrder,
  saveClass = 'bg-blue-600 hover:bg-blue-700',
  ringClass = 'focus:ring-blue-400',
  onSave, onClose,
}: ColManagerModalProps) {
  const allColKeys = allCols.map(c => c.key);
  const labelMap = Object.fromEntries(allCols.map(c => [c.key, c.label]));

  const [activeItems, setActiveItems] = useState<string[]>(() => colOrder.filter(k => visibleCols[k]));
  const [search, setSearch] = useState('');
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrc = useRef<number | null>(null);

  const inactiveKeys = allColKeys.filter(k => !activeItems.includes(k));
  const filteredInactive = search
    ? inactiveKeys.filter(k => labelMap[k].toLowerCase().includes(search.toLowerCase()))
    : inactiveKeys;

  const addCol = (key: string) => setActiveItems(prev => [...prev, key]);
  const removeCol = (key: string) => setActiveItems(prev => prev.filter(k => k !== key));

  function handleDragStart(e: React.DragEvent, idx: number) {
    dragSrc.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }
  function handleDrop(e: React.DragEvent, toIdx: number) {
    e.preventDefault();
    const fromIdx = dragSrc.current;
    if (fromIdx === null || fromIdx === toIdx) { setDragOverIdx(null); return; }
    setActiveItems(prev => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
    dragSrc.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }
  function handleDragEnd() {
    dragSrc.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function handleSave() {
    const newVisible = Object.fromEntries(allColKeys.map(k => [k, activeItems.includes(k)]));
    const newOrder = [...activeItems, ...allColKeys.filter(k => !activeItems.includes(k))];
    onSave(newVisible, newOrder);
    onClose();
  }

  function handleReset() {
    setActiveItems(allCols.filter(c => c.defaultOn).map(c => c.key));
    setSearch('');
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-base">Điều chỉnh cột hiển thị</h2>
            <p className="text-xs text-gray-400 mt-0.5">Chọn cột và kéo thả để sắp xếp thứ tự</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex gap-4 px-6 py-5 flex-1 overflow-hidden min-h-0">
          {/* Left: available columns */}
          <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 shrink-0 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Thêm cột hiển thị</p>
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm cột..."
                  className={`w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 ${ringClass}`} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filteredInactive.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-8">{search ? 'Không tìm thấy cột' : 'Tất cả cột đã được hiển thị'}</p>
              ) : filteredInactive.map(key => (
                <button key={key} onClick={() => addCol(key)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition text-left">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {labelMap[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Right: active columns (draggable) */}
          <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cột hiển thị</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Giữ và kéo thả để sắp xếp thứ tự</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {activeItems.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-8">Chưa có cột nào được chọn</p>
              ) : activeItems.map((key, idx) => (
                <div key={key} draggable
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={[
                    'flex items-center gap-2.5 px-4 py-2.5 cursor-grab select-none transition',
                    draggingIdx === idx ? 'opacity-40 bg-gray-50' : '',
                    dragOverIdx === idx && draggingIdx !== idx ? 'bg-blue-50 border-t-2 border-blue-400' : 'hover:bg-gray-50',
                  ].join(' ')}
                >
                  <svg className="w-4 h-4 text-gray-300 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/>
                    <circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/>
                    <circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/>
                  </svg>
                  <span className="flex-1 text-sm text-gray-700">{labelMap[key]}</span>
                  <button onClick={() => removeCol(key)}
                    className="w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">Quay về mặc định</button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Thoát</button>
            <button onClick={handleSave} className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition ${saveClass}`}>Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { settingsApi } from '@/lib/settings';
import {
  renderTemplate, generateItemsTable, buildPrintDocument,
  numberToWords, TemplateVars,
} from '@/lib/template-engine';
import {
  DEFAULT_TEMPLATE_HOA_DON, DEFAULT_TEMPLATE_PHIEU_THU, DEFAULT_TEMPLATE_PHIEU_CHI,
  KEYWORDS_HOA_DON, KEYWORDS_TX, VarCategory,
} from '@/lib/default-templates';

// ── Demo data for live preview ────────────────────────────────────────────────

const DEMO_ITEMS_TABLE = generateItemsTable([
  { stt: 1, name: 'Laptop Dell Inspiron 15', code: 'SP001', qty: 1, unit: 'Cái', price: 12_000_000, discountPct: 5, total: 11_400_000 },
  { stt: 2, name: 'Chuột Logitech MX Master', code: 'SP002', qty: 2, unit: 'Cái', price: 800_000, discountPct: 0, total: 1_600_000 },
  { stt: 3, name: 'Bàn phím cơ Keychron K2', code: 'SP003', qty: 1, unit: 'Cái', price: 1_500_000, discountPct: 0, total: 1_500_000 },
]);

const DEMO_HOA_DON: TemplateVars = {
  store_name: 'An Phát Technology',
  store_address: '123 Đường Nguyễn Trãi, Quận 1, TP.HCM',
  store_phone: '0901 234 567',
  store_email: 'info@anphat.vn',
  store_tax_code: '0123456789',
  print_footer: 'Cảm ơn quý khách! Vui lòng liên hệ nếu có thắc mắc.',
  print_date: '01/07/2026 09:55',
  order_code: 'DH-260701-001',
  order_date: '01/07/2026',
  customer_name: 'Nguyễn Văn A',
  customer_phone: '0987 654 321',
  customer_address: '456 Đường Lê Lợi, Q.1, TP.HCM',
  staff_name: 'Trần Thị B',
  branch_name: 'Chi nhánh Quận 1',
  notes: 'Giao hàng trước 17:00',
  payment_method: 'Tiền mặt (5.000.000đ) + Chuyển khoản (9.500.000đ)',
  subtotal: '14.500.000đ',
  discount_amount: '600.000đ',
  shipping_fee: '',
  total_amount: '13.900.000đ',
  total_text: numberToWords(13_900_000),
  paid_amount: '9.500.000đ',
  debt_amount: '4.400.000đ',
  items: [
    { line_stt: '1', line_name: 'Laptop Dell Inspiron 15', line_code: 'SP001', line_qty: '1', line_unit: 'Cái', line_price: '12.000.000', line_discount_pct: '5%', line_total: '11.400.000' },
    { line_stt: '2', line_name: 'Chuột Logitech MX Master', line_code: 'SP002', line_qty: '2', line_unit: 'Cái', line_price: '800.000', line_discount_pct: '', line_total: '1.600.000' },
    { line_stt: '3', line_name: 'Bàn phím cơ Keychron K2', line_code: 'SP003', line_qty: '1', line_unit: 'Cái', line_price: '1.500.000', line_discount_pct: '', line_total: '1.500.000' },
  ],
  items_table: DEMO_ITEMS_TABLE,
};

const DEMO_PHIEU_THU: TemplateVars = {
  store_name: 'An Phát Technology',
  store_address: '123 Đường Nguyễn Trãi, Quận 1, TP.HCM',
  store_phone: '0901 234 567',
  store_email: 'info@anphat.vn',
  store_tax_code: '0123456789',
  print_footer: 'Cảm ơn quý khách! Vui lòng liên hệ nếu có thắc mắc.',
  print_date: '01/07/2026 09:55',
  tx_code: 'PT-260701-001',
  tx_date: '01/07/2026',
  partner_name: 'Nguyễn Văn A',
  amount: '4.400.000 ₫',
  amount_text: numberToWords(4_400_000),
  reason: 'Thu tiền hàng đơn DH-260701-001',
  notes: '',
  linked_order: 'DH-260701-001',
  payment_method: 'Tiền mặt',
  branch_name: 'Chi nhánh Quận 1',
  staff_name: 'Trần Thị B',
};

const DEMO_PHIEU_CHI: TemplateVars = {
  ...DEMO_PHIEU_THU,
  tx_code: 'PC-260701-001',
  reason: 'Chi trả nhà cung cấp ABC',
  linked_order: '',
};

type TabKey = 'hoaDon' | 'phieuThu' | 'phieuChi';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'hoaDon', label: 'Hóa Đơn Bán Hàng' },
  { key: 'phieuThu', label: 'Phiếu Thu' },
  { key: 'phieuChi', label: 'Phiếu Chi' },
];

const DEFAULT_TEMPLATES: Record<TabKey, string> = {
  hoaDon: DEFAULT_TEMPLATE_HOA_DON,
  phieuThu: DEFAULT_TEMPLATE_PHIEU_THU,
  phieuChi: DEFAULT_TEMPLATE_PHIEU_CHI,
};

function getDemoVars(tab: TabKey): TemplateVars {
  if (tab === 'hoaDon') return DEMO_HOA_DON;
  if (tab === 'phieuThu') return DEMO_PHIEU_THU;
  return DEMO_PHIEU_CHI;
}

function getKeywords(tab: TabKey): VarCategory[] {
  return tab === 'hoaDon' ? KEYWORDS_HOA_DON : KEYWORDS_TX;
}

// ── Keyword Picker Modal ──────────────────────────────────────────────────────

function KeywordModal({
  tab, onSelect, onClose,
}: {
  tab: TabKey;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const categories = getKeywords(tab);

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories
      .map(cat => ({
        ...cat,
        vars: cat.vars.filter(v =>
          v.label.toLowerCase().includes(q) || v.code.toLowerCase().includes(q)
        ),
      }))
      .filter(cat => cat.vars.length > 0);
  }, [search, categories]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 780,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Danh sách từ khóa</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                Nhấn <strong>Chọn</strong> để chèn từ khóa tại vị trí con trỏ trong editor
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 6, border: '1px solid #e5e7eb',
                background: '#f9fafb', cursor: 'pointer', fontSize: 15, color: '#6b7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >✕</button>
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm từ khóa... (vd: khách hàng, tổng tiền)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            style={{
              width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
              borderRadius: 7, fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '12px 20px 16px', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '48px 0' }}>
              Không tìm thấy từ khóa phù hợp
            </div>
          ) : (
            filtered.map(cat => (
              <div key={cat.title} style={{ marginBottom: 18 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '.06em',
                  marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid #f3f4f6',
                }}>
                  {cat.title}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {cat.vars.map(v => (
                    <div key={v.code} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 9px', borderRadius: 6, background: '#f9fafb',
                      border: '1px solid #f0f0f0',
                    }}>
                      <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                        <div style={{ fontSize: 12, color: '#111', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.label}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563eb', marginTop: 1 }}>
                          {v.code}
                        </div>
                      </div>
                      <button
                        onClick={() => { onSelect(v.code); onClose(); }}
                        style={{
                          padding: '3px 11px', fontSize: 11, fontWeight: 600,
                          background: '#eff6ff', color: '#1d4ed8',
                          border: '1px solid #bfdbfe', borderRadius: 5,
                          cursor: 'pointer', flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Chọn
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{
          padding: '10px 20px', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {filtered.reduce((s, c) => s + c.vars.length, 0)} từ khóa
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 18px', fontSize: 13, background: '#f3f4f6',
              border: '1px solid #d1d5db', borderRadius: 7, cursor: 'pointer', color: '#374151',
            }}
          >
            Thoát
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MauInPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('hoaDon');
  const [templates, setTemplates] = useState<Record<TabKey, string>>({
    hoaDon: DEFAULT_TEMPLATE_HOA_DON,
    phieuThu: DEFAULT_TEMPLATE_PHIEU_THU,
    phieuChi: DEFAULT_TEMPLATE_PHIEU_CHI,
  });
  const [paperSizes, setPaperSizes] = useState<Record<TabKey, string>>({
    hoaDon: 'A4', phieuThu: 'A4', phieuChi: 'A4',
  });
  const [showKeywords, setShowKeywords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved templates from backend
  useEffect(() => {
    settingsApi.get()
      .then(s => {
        setTemplates({
          hoaDon: s.templateHoaDon || DEFAULT_TEMPLATE_HOA_DON,
          phieuThu: s.templatePhieuThu || DEFAULT_TEMPLATE_PHIEU_THU,
          phieuChi: s.templatePhieuChi || DEFAULT_TEMPLATE_PHIEU_CHI,
        });
        setPaperSizes({
          hoaDon: s.paperSizeHoaDon || 'A4',
          phieuThu: s.paperSizePhieuThu || 'A4',
          phieuChi: s.paperSizePhieuChi || 'A4',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Recompute preview when template / paper size / active tab changes
  const previewHtml = useMemo(() => {
    try {
      const body = renderTemplate(templates[activeTab], getDemoVars(activeTab));
      return buildPrintDocument(body, paperSizes[activeTab]);
    } catch {
      return '<html><body style="padding:20px;font-family:Arial;color:red">Lỗi render template</body></html>';
    }
  }, [templates, paperSizes, activeTab]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.update({
        templateHoaDon: templates.hoaDon,
        templatePhieuThu: templates.phieuThu,
        templatePhieuChi: templates.phieuChi,
        paperSizeHoaDon: paperSizes.hoaDon,
        paperSizePhieuThu: paperSizes.phieuThu,
        paperSizePhieuChi: paperSizes.phieuChi,
      });
      showToast('Đã lưu mẫu in thành công', true);
    } catch {
      showToast('Lưu thất bại, thử lại sau', false);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const label = TABS.find(t => t.key === activeTab)?.label;
    if (!confirm(`Khôi phục mẫu "${label}" về mặc định?\nThay đổi chưa lưu sẽ bị mất.`)) return;
    setTemplates(prev => ({ ...prev, [activeTab]: DEFAULT_TEMPLATES[activeTab] }));
  };

  // Insert keyword at textarea cursor position
  const insertKeyword = useCallback((code: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setTemplates(prev => ({ ...prev, [activeTab]: prev[activeTab] + code }));
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const newVal = ta.value.substring(0, start) + code + ta.value.substring(end);
    setTemplates(prev => ({ ...prev, [activeTab]: newVal }));
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + code.length;
      ta.focus();
    });
  }, [activeTab]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '60vh', color: '#9ca3af', fontSize: 14,
      }}>
        Đang tải...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid #e5e7eb',
        background: '#fff', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Mẫu In</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            Tuỳ chỉnh HTML mẫu in. Dùng <code style={{ background: '#f0f4ff', padding: '1px 4px', borderRadius: 3, color: '#2563eb' }}>{'{biến}'}</code> để chèn dữ liệu động.
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '7px 20px',
              background: saving ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 7,
              cursor: saving ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            {saving ? 'Đang lưu...' : 'Lưu mẫu'}
          </button>
        </div>
      </div>

      {/* ── Tab + paper size strip ───────────────────────────────────── */}
      <div style={{
        padding: '0 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'flex-end', gap: 0, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 2, flex: 1, paddingTop: 6 }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 16px', fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                background: activeTab === tab.key ? '#fff' : 'transparent',
                border: activeTab === tab.key ? '1px solid #d1d5db' : '1px solid transparent',
                borderBottom: activeTab === tab.key ? '1px solid #fff' : '1px solid transparent',
                borderRadius: '6px 6px 0 0', cursor: 'pointer',
                color: activeTab === tab.key ? '#111' : '#6b7280',
                marginBottom: -1, transition: 'all .1s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Khổ in:</span>
          {(['A4', 'A5'] as const).map(sz => (
            <button
              key={sz}
              onClick={() => setPaperSizes(prev => ({ ...prev, [activeTab]: sz }))}
              style={{
                padding: '3px 12px', fontSize: 12, borderRadius: 5,
                background: paperSizes[activeTab] === sz ? '#1d4ed8' : '#f3f4f6',
                color: paperSizes[activeTab] === sz ? '#fff' : '#374151',
                border: '1px solid ' + (paperSizes[activeTab] === sz ? '#1d4ed8' : '#d1d5db'),
                cursor: 'pointer',
                fontWeight: paperSizes[activeTab] === sz ? 600 : 400,
              }}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* ── Editor + Preview split pane ──────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: Code editor */}
        <div style={{
          width: '50%', display: 'flex', flexDirection: 'column',
          borderRight: '2px solid #2a2a3e', background: '#1e1e2e',
        }}>
          {/* Editor toolbar */}
          <div style={{
            padding: '6px 10px', background: '#2a2a3e',
            borderBottom: '1px solid #3a3a50',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}>
            <button
              onClick={() => setShowKeywords(true)}
              style={{
                padding: '5px 13px', fontSize: 12, fontWeight: 600,
                background: '#3b5bdb', color: '#fff',
                border: 'none', borderRadius: 5, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Thêm từ khóa
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '5px 12px', fontSize: 12, background: 'transparent',
                color: '#9ca3af', border: '1px solid #4a4a5e',
                borderRadius: 5, cursor: 'pointer',
              }}
            >
              ↺ Mặc định
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
              {templates[activeTab].length.toLocaleString()} ký tự
            </span>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={templates[activeTab]}
            onChange={e => setTemplates(prev => ({ ...prev, [activeTab]: e.target.value }))}
            spellCheck={false}
            style={{
              flex: 1, width: '100%', resize: 'none',
              border: 'none', outline: 'none',
              fontFamily: 'Consolas, "Courier New", monospace',
              fontSize: 12.5, lineHeight: 1.65,
              padding: '12px 14px',
              background: '#1e1e2e', color: '#d4d4d4',
              overflowY: 'auto', tabSize: 2,
            }}
          />
        </div>

        {/* Right: Live preview */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', background: '#dde1e7' }}>
          <div style={{
            padding: '6px 12px', background: '#f3f4f6',
            borderBottom: '1px solid #d1d5db', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Xem trước</span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>— dữ liệu mẫu, cập nhật realtime</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
            <div style={{
              background: '#fff', borderRadius: 4, overflow: 'hidden',
              boxShadow: '0 2px 16px rgba(0,0,0,.12)', minHeight: 300,
            }}>
              <iframe
                srcDoc={previewHtml}
                style={{ width: '100%', height: '100%', minHeight: 620, border: 'none', display: 'block' }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Keyword Picker Modal ─────────────────────────────────────── */}
      {showKeywords && (
        <KeywordModal
          tab={activeTab}
          onSelect={insertKeyword}
          onClose={() => setShowKeywords(false)}
        />
      )}

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,.22)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

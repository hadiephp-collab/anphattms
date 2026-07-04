'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { settingsApi } from '@/lib/settings';
import {
  renderTemplate, generateItemsTable, buildPrintDocument,
  numberToWords, TemplateVars,
} from '@/lib/template-engine';
import {
  DEFAULT_TEMPLATE_HOA_DON, DEFAULT_TEMPLATE_PHIEU_THU, DEFAULT_TEMPLATE_PHIEU_CHI,
  DEFAULT_TEMPLATE_DON_HANG_NHAP, DEFAULT_TEMPLATE_TRA_HANG_NCC, DEFAULT_TEMPLATE_VAN_DON,
  KEYWORDS_HOA_DON, KEYWORDS_TX, KEYWORDS_DON_HANG_NHAP, KEYWORDS_TRA_HANG_NCC, KEYWORDS_VAN_DON,
  VarCategory,
} from '@/lib/default-templates';

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_ITEMS_TABLE = generateItemsTable([
  { stt: 1, name: 'Laptop Dell Inspiron 15', code: 'SP001', qty: 1, unit: 'Cái', price: 12_000_000, discountPct: 5, total: 11_400_000 },
  { stt: 2, name: 'Chuột Logitech MX Master', code: 'SP002', qty: 2, unit: 'Cái', price: 800_000, discountPct: 0, total: 1_600_000 },
  { stt: 3, name: 'Bàn phím cơ Keychron K2', code: 'SP003', qty: 1, unit: 'Cái', price: 1_500_000, discountPct: 0, total: 1_500_000 },
]);

const DEMO_HOA_DON: TemplateVars = {
  store_name: 'An Phát Technology', store_address: '123 Đường Nguyễn Trãi, Quận 1, TP.HCM',
  store_phone: '0901 234 567', store_email: 'info@anphat.vn', store_tax_code: '0123456789',
  print_footer: 'Cảm ơn quý khách! Vui lòng liên hệ nếu có thắc mắc.', print_date: '01/07/2026 09:55',
  order_code: 'DH-260701-001', order_date: '01/07/2026',
  order_status: 'Hoàn thành', payment_status: 'Thanh toán một phần',
  customer_name: 'Nguyễn Văn A', customer_code: 'KH-001',
  customer_phone: '0987 654 321', customer_email: 'nguyenvana@gmail.com',
  customer_address: '456 Đường Lê Lợi, Q.1',
  staff_name: 'Trần Thị B', branch_name: 'Chi nhánh Quận 1', notes: 'Giao hàng trước 17:00',
  payment_method: 'Tiền mặt (5.000.000đ) + Chuyển khoản (9.500.000đ)',
  total_quantity: '4',
  subtotal: '14.500.000đ', discount_amount: '600.000đ', shipping_fee: '',
  total_amount: '13.900.000đ', total_text: numberToWords(13_900_000),
  paid_amount: '9.500.000đ', debt_amount: '4.400.000đ',
  items: [
    { line_stt: '1', line_name: 'Laptop Dell Inspiron 15', line_code: 'SP001', line_qty: '1', line_unit: 'Cái', line_price: '12.000.000', line_discount_pct: '5%', line_total: '11.400.000' },
    { line_stt: '2', line_name: 'Chuột Logitech MX Master', line_code: 'SP002', line_qty: '2', line_unit: 'Cái', line_price: '800.000', line_discount_pct: '', line_total: '1.600.000' },
    { line_stt: '3', line_name: 'Bàn phím cơ Keychron K2', line_code: 'SP003', line_qty: '1', line_unit: 'Cái', line_price: '1.500.000', line_discount_pct: '', line_total: '1.500.000' },
  ],
  items_table: DEMO_ITEMS_TABLE,
  payment_qr: '<img src="https://img.vietqr.io/image/970422-0123456789-print.png?amount=13900000&addInfo=DH-260701-001&accountName=AN%20PHAT%20TECHNOLOGY" style="width:180px;height:180px;display:block" alt="QR thanh toán" />',
};

const DEMO_PHIEU_THU: TemplateVars = {
  store_name: 'An Phát Technology', store_address: '123 Đường Nguyễn Trãi, Quận 1, TP.HCM',
  store_phone: '0901 234 567', store_email: 'info@anphat.vn', store_tax_code: '0123456789',
  print_footer: 'Cảm ơn quý khách!', print_date: '01/07/2026 09:55',
  tx_code: 'PT-260701-001', tx_date: '01/07/2026', partner_name: 'Nguyễn Văn A',
  amount: '4.400.000 ₫', amount_text: numberToWords(4_400_000),
  reason: 'Thu tiền hàng đơn DH-260701-001', notes: '',
  linked_order: 'DH-260701-001', payment_method: 'Tiền mặt',
  branch_name: 'Chi nhánh Quận 1', staff_name: 'Trần Thị B',
};

const DEMO_PHIEU_CHI: TemplateVars = { ...DEMO_PHIEU_THU, tx_code: 'PC-260701-001', reason: 'Chi trả nhà cung cấp ABC', linked_order: '' };

const DEMO_PO_ITEMS_TABLE = generateItemsTable([
  { stt: 1, name: 'Điện thoại Xiaomi 14', code: 'SP010', qty: 5, unit: 'Cái', price: 3_500_000, discountPct: 0, total: 17_500_000 },
  { stt: 2, name: 'Tai nghe Bluetooth', code: 'SP011', qty: 10, unit: 'Cái', price: 450_000, discountPct: 0, total: 4_500_000 },
]);

const DEMO_DON_HANG_NHAP: TemplateVars = {
  store_name: 'An Phát Technology', store_address: '123 Đường Nguyễn Trãi, Q.1', store_phone: '0901 234 567',
  store_email: 'info@anphat.vn', store_tax_code: '0123456789',
  print_footer: 'Cảm ơn đã hợp tác!', print_date: '01/07/2026 10:00',
  po_code: 'PN-2607-001', po_date: '01/07/2026', po_status: 'Đã nhận hàng',
  supplier_name: 'Công ty TNHH ABC', supplier_code: 'NCC-001',
  supplier_phone: '028 1234 5678', supplier_address: '456 Đường CN, Bình Dương',
  currency: 'VND', exchange_rate: '', expected_date: '05/07/2026', received_date: '03/07/2026',
  staff_name: 'Trần Văn C', branch_name: 'Chi nhánh Quận 1', notes: 'Kiểm tra hàng trước khi nhận',
  payment_method: 'Chuyển khoản (22.000.000đ)',
  subtotal_foreign: '', subtotal_vnd: '22.000.000đ', discount_amount: '', shipping_fee: '500.000đ',
  total_amount_vnd: '22.500.000đ', total_text: numberToWords(22_500_000),
  paid_amount: '22.500.000đ', debt_amount: '',
  items: [
    { line_stt: '1', line_name: 'Điện thoại Xiaomi 14', line_code: 'SP010', line_qty: '5', line_unit: 'Cái', line_price_vnd: '3.500.000đ', line_total_vnd: '17.500.000đ', line_price_foreign: '', line_total_foreign: '' },
    { line_stt: '2', line_name: 'Tai nghe Bluetooth', line_code: 'SP011', line_qty: '10', line_unit: 'Cái', line_price_vnd: '450.000đ', line_total_vnd: '4.500.000đ', line_price_foreign: '', line_total_foreign: '' },
  ],
  items_table: DEMO_PO_ITEMS_TABLE,
};

const DEMO_TRA_HANG_ITEMS_TABLE = generateItemsTable([
  { stt: 1, name: 'Điện thoại Xiaomi 14 (lỗi màn hình)', code: 'SP010', qty: 2, unit: 'Cái', price: 3_500_000, discountPct: 0, total: 7_000_000 },
]);

const DEMO_TRA_HANG_NCC: TemplateVars = {
  store_name: 'An Phát Technology', store_address: '123 Đường Nguyễn Trãi, Q.1', store_phone: '0901 234 567',
  store_email: 'info@anphat.vn', store_tax_code: '0123456789',
  print_footer: '', print_date: '01/07/2026 14:30',
  return_code: 'TN-2607-001', return_date: '01/07/2026', return_status: 'Đã xác nhận',
  supplier_name: 'Công ty TNHH ABC', supplier_code: 'NCC-001',
  po_code: 'PN-2607-001', return_reason: 'Hàng Lỗi',
  notes: 'Hàng lỗi màn hình, trả lại toàn bộ lô', supplier_notes: 'Đề nghị đổi hàng mới',
  staff_name: 'Trần Văn C', branch_name: 'Chi nhánh Quận 1',
  total_amount: '7.000.000đ', total_text: numberToWords(7_000_000),
  refunded_amount: '7.000.000đ', refund_status: 'Đã hoàn đủ',
  items: [
    { line_stt: '1', line_name: 'Điện thoại Xiaomi 14 (lỗi màn hình)', line_code: 'SP010', line_qty: '2', line_unit: 'Cái', line_price: '3.500.000đ', line_total: '7.000.000đ' },
  ],
  items_table: DEMO_TRA_HANG_ITEMS_TABLE,
};

const DEMO_VAN_DON: TemplateVars = {
  store_name: 'An Phát Technology', store_address: '123 Đường Nguyễn Trãi, Q.1', store_phone: '0901 234 567',
  store_email: 'info@anphat.vn', store_tax_code: '0123456789',
  print_footer: '', print_date: '01/07/2026 09:00',
  shipment_code: 'VD-260701-001', tracking_code: 'GHN123456789', shipment_date: '01/07/2026',
  carrier_name: 'Giao Hàng Nhanh', shipment_type: 'COD (Thu hộ tiền)',
  order_code: 'DH-260701-001', scheduled_date: '03/07/2026', delivered_date: '',
  shipment_status: 'Đang vận chuyển', notes: 'Gọi trước khi giao',
  receiver_name: 'Nguyễn Văn A', receiver_phone: '0987 654 321',
  receiver_address: '456 Đường Lê Lợi, Quận 1, TP.HCM',
  shipping_fee: '35.000đ', cod_amount: '13.900.000đ',
};

type TabKey = 'hoaDon' | 'phieuThu' | 'phieuChi' | 'donHangNhap' | 'traHangNcc' | 'vanDon';
type EditorMode = 'visual' | 'html';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'hoaDon', label: 'Hóa Đơn Bán Hàng' },
  { key: 'phieuThu', label: 'Phiếu Thu' },
  { key: 'phieuChi', label: 'Phiếu Chi' },
  { key: 'donHangNhap', label: 'Đơn Hàng Nhập' },
  { key: 'traHangNcc', label: 'Trả Hàng NCC' },
  { key: 'vanDon', label: 'Vận Đơn' },
];

const DEFAULT_TEMPLATES: Record<TabKey, string> = {
  hoaDon: DEFAULT_TEMPLATE_HOA_DON,
  phieuThu: DEFAULT_TEMPLATE_PHIEU_THU,
  phieuChi: DEFAULT_TEMPLATE_PHIEU_CHI,
  donHangNhap: DEFAULT_TEMPLATE_DON_HANG_NHAP,
  traHangNcc: DEFAULT_TEMPLATE_TRA_HANG_NCC,
  vanDon: DEFAULT_TEMPLATE_VAN_DON,
};

function getKeywords(tab: TabKey): VarCategory[] {
  if (tab === 'hoaDon') return KEYWORDS_HOA_DON;
  if (tab === 'donHangNhap') return KEYWORDS_DON_HANG_NHAP;
  if (tab === 'traHangNcc') return KEYWORDS_TRA_HANG_NCC;
  if (tab === 'vanDon') return KEYWORDS_VAN_DON;
  return KEYWORDS_TX;
}

function getDemoVars(tab: TabKey): TemplateVars {
  if (tab === 'hoaDon') return DEMO_HOA_DON;
  if (tab === 'phieuThu') return DEMO_PHIEU_THU;
  if (tab === 'phieuChi') return DEMO_PHIEU_CHI;
  if (tab === 'donHangNhap') return DEMO_DON_HANG_NHAP;
  if (tab === 'traHangNcc') return DEMO_TRA_HANG_NCC;
  return DEMO_VAN_DON;
}

// ── Keyword Picker Modal ──────────────────────────────────────────────────────

function KeywordModal({ tab, onSelect, onClose }: {
  tab: TabKey; onSelect: (code: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const categories = getKeywords(tab);

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories
      .map(cat => ({ ...cat, vars: cat.vars.filter(v => v.label.toLowerCase().includes(q) || v.code.toLowerCase().includes(q)) }))
      .filter(cat => cat.vars.length > 0);
  }, [search, categories]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(1060px, calc(100vw - 24px))', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
        <div style={{ padding: '18px 24px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Danh sách từ khóa</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Nhấn <strong>Chọn</strong> để chèn từ khóa tại vị trí con trỏ</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 16, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <input type="text" placeholder="Tìm kiếm từ khóa..." value={search} onChange={e => setSearch(e.target.value)} autoFocus
            style={{ width: '100%', padding: '9px 14px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ overflowY: 'auto', padding: '14px 24px 20px', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '48px 0' }}>Không tìm thấy từ khóa phù hợp</div>
          ) : filtered.map(cat => (
            <div key={cat.title} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>{cat.title}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {cat.vars.map(v => (
                  <div key={v.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 6, background: '#f9fafb', border: '1px solid #f0f0f0' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <div style={{ fontSize: 12, color: '#111', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563eb', marginTop: 1 }}>{v.code}</div>
                    </div>
                    <button onClick={() => { onSelect(v.code); onClose(); }}
                      style={{ padding: '3px 11px', fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer', flexShrink: 0 }}>
                      Chọn
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{filtered.reduce((s, c) => s + c.vars.length, 0)} từ khóa</span>
          <button onClick={onClose} style={{ padding: '6px 20px', fontSize: 13, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>Thoát</button>
        </div>
      </div>
    </div>
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function TBtn({ label, title, onClick, active }: { label: string; title?: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      style={{
        padding: '3px 8px', fontSize: 12, minWidth: 28, height: 26,
        background: active ? '#dbeafe' : '#f9fafb',
        color: active ? '#1d4ed8' : '#374151',
        border: '1px solid ' + (active ? '#93c5fd' : '#d1d5db'),
        borderRadius: 4, cursor: 'pointer', fontWeight: active ? 700 : 400,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MauInPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('hoaDon');
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const [templates, setTemplates] = useState<Record<TabKey, string>>({
    hoaDon: DEFAULT_TEMPLATE_HOA_DON,
    phieuThu: DEFAULT_TEMPLATE_PHIEU_THU,
    phieuChi: DEFAULT_TEMPLATE_PHIEU_CHI,
    donHangNhap: DEFAULT_TEMPLATE_DON_HANG_NHAP,
    traHangNcc: DEFAULT_TEMPLATE_TRA_HANG_NCC,
    vanDon: DEFAULT_TEMPLATE_VAN_DON,
  });
  const [paperSizes, setPaperSizes] = useState<Record<TabKey, string>>({
    hoaDon: 'A4', phieuThu: 'A4', phieuChi: 'A4',
    donHangNhap: 'A4', traHangNcc: 'A4', vanDon: 'A4',
  });
  const [showKeywords, setShowKeywords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const editorDivRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Load saved templates
  useEffect(() => {
    settingsApi.get().then(s => {
      setTemplates({
        hoaDon: s.templateHoaDon || DEFAULT_TEMPLATE_HOA_DON,
        phieuThu: s.templatePhieuThu || DEFAULT_TEMPLATE_PHIEU_THU,
        phieuChi: s.templatePhieuChi || DEFAULT_TEMPLATE_PHIEU_CHI,
        donHangNhap: s.templateDonHangNhap || DEFAULT_TEMPLATE_DON_HANG_NHAP,
        traHangNcc: s.templateTraHangNcc || DEFAULT_TEMPLATE_TRA_HANG_NCC,
        vanDon: s.templateVanDon || DEFAULT_TEMPLATE_VAN_DON,
      });
      setPaperSizes({
        hoaDon: s.paperSizeHoaDon || 'A4', phieuThu: s.paperSizePhieuThu || 'A4', phieuChi: s.paperSizePhieuChi || 'A4',
        donHangNhap: s.paperSizeDonHangNhap || 'A4', traHangNcc: s.paperSizeTraHangNcc || 'A4', vanDon: s.paperSizeVanDon || 'A4',
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Sync contenteditable when tab changes or after loading
  useEffect(() => {
    if (editorMode === 'visual' && editorDivRef.current && !loading) {
      editorDivRef.current.innerHTML = templates[activeTab];
    }
  }, [activeTab, editorMode, loading]);

  // Read from contenteditable on input → update templates → triggers preview recompute
  const handleEditorInput = useCallback(() => {
    if (editorDivRef.current) {
      const html = editorDivRef.current.innerHTML;
      setTemplates(prev => ({ ...prev, [activeTab]: html }));
    }
  }, [activeTab]);

  // Prevent pasting rich HTML — paste as plain text only
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Switch between visual ↔ html modes
  const switchEditorMode = (newMode: EditorMode) => {
    if (newMode === editorMode) return;
    if (editorMode === 'visual' && editorDivRef.current) {
      // flush contenteditable → state before switching
      setTemplates(prev => ({ ...prev, [activeTab]: editorDivRef.current!.innerHTML }));
    }
    setEditorMode(newMode);
    if (newMode === 'visual') {
      // useEffect above will init contenteditable
    }
  };

  // Live preview
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
    // Flush visual editor before saving
    if (editorMode === 'visual' && editorDivRef.current) {
      setTemplates(prev => ({ ...prev, [activeTab]: editorDivRef.current!.innerHTML }));
    }
    setSaving(true);
    try {
      const toSave = editorMode === 'visual' && editorDivRef.current
        ? { ...templates, [activeTab]: editorDivRef.current.innerHTML }
        : templates;
      await settingsApi.update({
        templateHoaDon: toSave.hoaDon,
        templatePhieuThu: toSave.phieuThu,
        templatePhieuChi: toSave.phieuChi,
        templateDonHangNhap: toSave.donHangNhap,
        templateTraHangNcc: toSave.traHangNcc,
        templateVanDon: toSave.vanDon,
        paperSizeHoaDon: paperSizes.hoaDon,
        paperSizePhieuThu: paperSizes.phieuThu,
        paperSizePhieuChi: paperSizes.phieuChi,
        paperSizeDonHangNhap: paperSizes.donHangNhap,
        paperSizeTraHangNcc: paperSizes.traHangNcc,
        paperSizeVanDon: paperSizes.vanDon,
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
    const def = DEFAULT_TEMPLATES[activeTab];
    setTemplates(prev => ({ ...prev, [activeTab]: def }));
    if (editorMode === 'visual' && editorDivRef.current) {
      editorDivRef.current.innerHTML = def;
    }
  };

  // Format command (visual mode toolbar)
  const execFmt = (cmd: string, val?: string) => {
    editorDivRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  // Save cursor position before opening modal (contenteditable loses focus when modal opens)
  const openKeywords = useCallback(() => {
    if (editorMode === 'visual') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    }
    setShowKeywords(true);
  }, [editorMode]);

  // Insert keyword at cursor (works in both modes)
  const insertKeyword = useCallback((code: string) => {
    if (editorMode === 'visual') {
      editorDivRef.current?.focus();
      // Restore saved cursor position so keyword inserts at the right spot
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }
        savedRangeRef.current = null;
      }
      document.execCommand('insertText', false, code);
      setTimeout(() => {
        if (editorDivRef.current) {
          setTemplates(prev => ({ ...prev, [activeTab]: editorDivRef.current!.innerHTML }));
        }
      }, 0);
    } else {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      const newVal = ta.value.substring(0, start) + code + ta.value.substring(end);
      setTemplates(prev => ({ ...prev, [activeTab]: newVal }));
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + code.length;
        ta.focus();
      });
    }
  }, [editorMode, activeTab]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: 14 }}>
      Đang tải...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Mẫu In</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>Tuỳ chỉnh nội dung phiếu in. Dùng nút <strong>Thêm từ khóa</strong> để chèn dữ liệu động.</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '7px 20px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Đang lưu...' : 'Lưu mẫu'}
          </button>
        </div>
      </div>

      {/* ── Tabs + paper size ──────────────────────────────────────── */}
      <div style={{ padding: '0 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 2, flex: 1, paddingTop: 6 }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 16px', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                background: activeTab === tab.key ? '#fff' : 'transparent',
                border: activeTab === tab.key ? '1px solid #d1d5db' : '1px solid transparent',
                borderBottom: activeTab === tab.key ? '1px solid #fff' : '1px solid transparent',
                borderRadius: '6px 6px 0 0', cursor: 'pointer',
                color: activeTab === tab.key ? '#111' : '#6b7280', marginBottom: -1,
              }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Khổ in:</span>
          {(['A4', 'A5'] as const).map(sz => (
            <button key={sz} onClick={() => setPaperSizes(prev => ({ ...prev, [activeTab]: sz }))}
              style={{
                padding: '3px 12px', fontSize: 12, borderRadius: 5,
                background: paperSizes[activeTab] === sz ? '#1d4ed8' : '#f3f4f6',
                color: paperSizes[activeTab] === sz ? '#fff' : '#374151',
                border: '1px solid ' + (paperSizes[activeTab] === sz ? '#1d4ed8' : '#d1d5db'),
                cursor: 'pointer', fontWeight: paperSizes[activeTab] === sz ? 600 : 400,
              }}>
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* ── Split pane ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: editor ─────────────────────────────────────────── */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #d1d5db', background: '#fff' }}>

          {/* Toolbar */}
          <div style={{ padding: '6px 10px', background: '#f8f9fa', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
            {/* Mode toggle */}
            <button
              onClick={() => switchEditorMode(editorMode === 'visual' ? 'html' : 'visual')}
              style={{
                padding: '3px 10px', fontSize: 11, fontWeight: 600,
                background: editorMode === 'html' ? '#1e293b' : '#f1f5f9',
                color: editorMode === 'html' ? '#e2e8f0' : '#475569',
                border: '1px solid ' + (editorMode === 'html' ? '#1e293b' : '#cbd5e1'),
                borderRadius: 4, cursor: 'pointer', marginRight: 4,
              }}
            >
              {'</>'} Mã HTML
            </button>

            {/* Formatting buttons (visual only) */}
            {editorMode === 'visual' && (
              <>
                <div style={{ width: 1, height: 20, background: '#d1d5db', margin: '0 2px' }} />
                <TBtn label="B" title="In đậm" onClick={() => execFmt('bold')} />
                <TBtn label="I" title="In nghiêng" onClick={() => execFmt('italic')} />
                <TBtn label="U" title="Gạch chân" onClick={() => execFmt('underline')} />
                <div style={{ width: 1, height: 20, background: '#d1d5db', margin: '0 2px' }} />
                <TBtn label="≡←" title="Căn trái" onClick={() => execFmt('justifyLeft')} />
                <TBtn label="≡" title="Căn giữa" onClick={() => execFmt('justifyCenter')} />
                <TBtn label="≡→" title="Căn phải" onClick={() => execFmt('justifyRight')} />
                <div style={{ width: 1, height: 20, background: '#d1d5db', margin: '0 2px' }} />
              </>
            )}

            {/* Keyword + Reset */}
            <button onClick={openKeywords}
              style={{ padding: '3px 12px', fontSize: 12, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginLeft: editorMode === 'html' ? 0 : 0 }}>
              + Thêm từ khóa
            </button>
            <button onClick={handleReset}
              style={{ padding: '3px 10px', fontSize: 12, background: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer' }}>
              ↺ Mặc định
            </button>

            {editorMode === 'html' && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>
                {templates[activeTab].length.toLocaleString()} ký tự
              </span>
            )}
          </div>

          {/* Visual editor (contenteditable) */}
          {editorMode === 'visual' && (
            <div
              ref={editorDivRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onPaste={handlePaste}
              style={{
                flex: 1, overflowY: 'auto',
                padding: '16px 20px',
                fontFamily: 'Arial, sans-serif', fontSize: 12,
                color: '#000', background: '#fff',
                outline: 'none', lineHeight: 1.5,
              }}
            />
          )}

          {/* HTML code editor (textarea) */}
          {editorMode === 'html' && (
            <textarea
              ref={textareaRef}
              value={templates[activeTab]}
              onChange={e => setTemplates(prev => ({ ...prev, [activeTab]: e.target.value }))}
              spellCheck={false}
              style={{
                flex: 1, width: '100%', resize: 'none', border: 'none', outline: 'none',
                fontFamily: 'Consolas, "Courier New", monospace', fontSize: 12, lineHeight: 1.6,
                padding: '12px 14px', background: '#1e1e2e', color: '#d4d4d4', overflowY: 'auto',
              }}
            />
          )}
        </div>

        {/* ── Right: preview ───────────────────────────────────────── */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', background: '#dde1e7' }}>
          <div style={{ padding: '6px 12px', background: '#f3f4f6', borderBottom: '1px solid #d1d5db', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Bản xem trước</span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>— dữ liệu mẫu, cập nhật realtime</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
            <div style={{ background: '#fff', borderRadius: 4, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.12)', minHeight: 300 }}>
              <iframe srcDoc={previewHtml} style={{ width: '100%', height: '100%', minHeight: 640, border: 'none', display: 'block' }} sandbox="allow-same-origin" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Keyword picker modal ─────────────────────────────────────── */}
      {showKeywords && (
        <KeywordModal tab={activeTab} onSelect={insertKeyword} onClose={() => setShowKeywords(false)} />
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

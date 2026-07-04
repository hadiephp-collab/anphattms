// Default HTML templates — mirrors constants in settings.service.ts (backend)
// Used by mau-in settings page for keyword picker & "reset to default" button

export const DEFAULT_TEMPLATE_HOA_DON = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:12px">
  <div>
    <div style="font-weight:700;font-size:15px">{store_name}</div>
    {#if store_address}<div style="color:#555;margin-top:2px;font-size:11px">{store_address}</div>{/if}
    {#if store_phone}<div style="color:#555;margin-top:1px;font-size:11px">ĐT: {store_phone}</div>{/if}
    {#if store_tax_code}<div style="color:#555;margin-top:1px;font-size:11px">MST: {store_tax_code}</div>{/if}
  </div>
  <div style="text-align:right;min-width:180px">
    <div style="font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Hóa Đơn Bán Hàng</div>
    <div style="margin-top:6px;font-size:13px"><strong>Số:</strong> <span style="font-family:monospace">{order_code}</span></div>
    <div style="font-size:11px;color:#555;margin-top:2px"><strong>Ngày:</strong> {order_date}</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:14px;font-size:12px">
  <div><strong>Khách hàng:</strong> {customer_name}</div>
  <div><strong>SĐT:</strong> {customer_phone}</div>
  {#if staff_name}<div><strong>Nhân viên:</strong> {staff_name}</div>{/if}
  {#if branch_name}<div><strong>Chi nhánh:</strong> {branch_name}</div>{/if}
</div>
{items_table}
<div style="display:flex;justify-content:flex-end;margin-bottom:14px">
  <table style="min-width:260px;font-size:12px;border-collapse:collapse">
    <tbody>
      {#if subtotal}<tr><td style="padding:3px 8px;color:#555">Tạm tính:</td><td style="padding:3px 8px;text-align:right">{subtotal}</td></tr>{/if}
      {#if discount_amount}<tr><td style="padding:3px 8px;color:#555">Giảm giá:</td><td style="padding:3px 8px;text-align:right;color:#dc2626">-{discount_amount}</td></tr>{/if}
      {#if shipping_fee}<tr><td style="padding:3px 8px;color:#555">Phí vận chuyển:</td><td style="padding:3px 8px;text-align:right">{shipping_fee}</td></tr>{/if}
      <tr style="border-top:1.5px solid #000"><td style="padding:7px 8px;font-weight:700;font-size:13px">TỔNG TIỀN:</td><td style="padding:7px 8px;text-align:right;font-weight:700;font-size:14px">{total_amount}</td></tr>
      {#if paid_amount}<tr><td style="padding:3px 8px;color:#16a34a">Đã thanh toán:</td><td style="padding:3px 8px;text-align:right;color:#16a34a;font-weight:600">{paid_amount}</td></tr>{/if}
      {#if debt_amount}<tr><td style="padding:3px 8px;color:#dc2626;font-weight:600">Còn lại:</td><td style="padding:3px 8px;text-align:right;color:#dc2626;font-weight:700">{debt_amount}</td></tr>{/if}
    </tbody>
  </table>
</div>
<div style="font-size:11px;margin-bottom:8px;color:#444">Bằng chữ: <em>{total_text}</em></div>
{#if payment_method}<div style="font-size:12px;margin-bottom:8px">PTTT: {payment_method}</div>{/if}
{#if notes}<div style="margin-bottom:16px;padding:6px 10px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:11px"><strong>Ghi chú:</strong> {notes}</div>{/if}
{#if payment_qr}<div style="margin:16px 0;display:flex;align-items:flex-start;gap:16px"><div>{payment_qr}</div><div style="font-size:11px;color:#555;padding-top:4px"><div style="font-weight:600;margin-bottom:4px">Quét QR để thanh toán</div><div style="margin-top:2px;color:#888">Chuyển khoản ngân hàng</div></div></div>{/if}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;text-align:center;font-size:12px">
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người mua hàng</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#555;font-style:italic">{customer_name}</div>
  </div>
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người bán hàng</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#555;font-style:italic">{staff_name}</div>
  </div>
</div>
{#if print_footer}<div style="margin-top:24px;text-align:center;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px">{print_footer}</div>{/if}
<div style="margin-top:12px;font-size:9px;color:#bbb;text-align:right">In lúc: {print_date}</div>`;

export const DEFAULT_TEMPLATE_PHIEU_THU = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:10px">
  <div>
    <div style="font-weight:700;font-size:14px">{store_name}</div>
    {#if store_address}<div style="font-size:11px;color:#555;margin-top:2px">{store_address}</div>{/if}
    {#if store_phone}<div style="font-size:11px;color:#555;margin-top:1px">ĐT: {store_phone}</div>{/if}
  </div>
  <div style="text-align:right">
    <div style="font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Phiếu Thu</div>
    <div style="font-size:12px;font-family:monospace;margin-top:4px;font-weight:600">{tx_code}</div>
    <div style="font-size:11px;color:#555;margin-top:2px">{tx_date}</div>
  </div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px">
  <tbody>
    <tr><td style="padding:4px 0;color:#555;width:160px;vertical-align:top">Người nộp tiền:</td><td style="padding:4px 0;font-weight:600">{partner_name}</td></tr>
    <tr><td style="padding:4px 0;color:#555;vertical-align:top">Lý do thu:</td><td style="padding:4px 0">{reason}</td></tr>
    {#if notes}<tr><td style="padding:4px 0;color:#555;vertical-align:top">Ghi chú:</td><td style="padding:4px 0;color:#555">{notes}</td></tr>{/if}
    {#if linked_order}<tr><td style="padding:4px 0;color:#555;vertical-align:top">Đơn hàng:</td><td style="padding:4px 0;font-family:monospace;color:#2563eb">{linked_order}</td></tr>{/if}
    <tr><td style="padding:4px 0;color:#555;vertical-align:top">PTTT:</td><td style="padding:4px 0">{payment_method}</td></tr>
    {#if branch_name}<tr><td style="padding:4px 0;color:#555;vertical-align:top">Chi nhánh:</td><td style="padding:4px 0">{branch_name}</td></tr>{/if}
  </tbody>
</table>
<div style="border:1px solid #000;border-radius:4px;padding:14px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
  <div style="font-size:13px;font-weight:600">SỐ TIỀN THU:</div>
  <div style="font-size:22px;font-weight:700;color:#16a34a">{amount}</div>
</div>
<div style="font-style:italic;font-size:11px;color:#444;margin-bottom:20px">Bằng chữ: <em style="font-style:normal">{amount_text}</em></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:20px;text-align:center;font-size:12px">
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người nộp</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555">{partner_name}</div>
  </div>
  <div>
    <div style="font-weight:600;margin-bottom:4px">Thủ quỹ</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555"></div>
  </div>
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người lập</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555">{staff_name}</div>
  </div>
</div>
{#if print_footer}<div style="margin-top:20px;text-align:center;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px">{print_footer}</div>{/if}
<div style="margin-top:12px;font-size:9px;color:#bbb;text-align:right">In lúc: {print_date}</div>`;

export const DEFAULT_TEMPLATE_PHIEU_CHI = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:10px">
  <div>
    <div style="font-weight:700;font-size:14px">{store_name}</div>
    {#if store_address}<div style="font-size:11px;color:#555;margin-top:2px">{store_address}</div>{/if}
    {#if store_phone}<div style="font-size:11px;color:#555;margin-top:1px">ĐT: {store_phone}</div>{/if}
  </div>
  <div style="text-align:right">
    <div style="font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Phiếu Chi</div>
    <div style="font-size:12px;font-family:monospace;margin-top:4px;font-weight:600">{tx_code}</div>
    <div style="font-size:11px;color:#555;margin-top:2px">{tx_date}</div>
  </div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px">
  <tbody>
    <tr><td style="padding:4px 0;color:#555;width:160px;vertical-align:top">Người nhận tiền:</td><td style="padding:4px 0;font-weight:600">{partner_name}</td></tr>
    <tr><td style="padding:4px 0;color:#555;vertical-align:top">Lý do chi:</td><td style="padding:4px 0">{reason}</td></tr>
    {#if notes}<tr><td style="padding:4px 0;color:#555;vertical-align:top">Ghi chú:</td><td style="padding:4px 0;color:#555">{notes}</td></tr>{/if}
    {#if linked_order}<tr><td style="padding:4px 0;color:#555;vertical-align:top">Đơn hàng:</td><td style="padding:4px 0;font-family:monospace;color:#2563eb">{linked_order}</td></tr>{/if}
    <tr><td style="padding:4px 0;color:#555;vertical-align:top">PTTT:</td><td style="padding:4px 0">{payment_method}</td></tr>
    {#if branch_name}<tr><td style="padding:4px 0;color:#555;vertical-align:top">Chi nhánh:</td><td style="padding:4px 0">{branch_name}</td></tr>{/if}
  </tbody>
</table>
<div style="border:1px solid #000;border-radius:4px;padding:14px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
  <div style="font-size:13px;font-weight:600">SỐ TIỀN CHI:</div>
  <div style="font-size:22px;font-weight:700;color:#dc2626">{amount}</div>
</div>
<div style="font-style:italic;font-size:11px;color:#444;margin-bottom:20px">Bằng chữ: <em style="font-style:normal">{amount_text}</em></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:20px;text-align:center;font-size:12px">
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người nhận</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555">{partner_name}</div>
  </div>
  <div>
    <div style="font-weight:600;margin-bottom:4px">Thủ quỹ</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555"></div>
  </div>
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người lập</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#555">{staff_name}</div>
  </div>
</div>
{#if print_footer}<div style="margin-top:20px;text-align:center;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px">{print_footer}</div>{/if}
<div style="margin-top:12px;font-size:9px;color:#bbb;text-align:right">In lúc: {print_date}</div>`;

// ── Keyword definitions per template type ─────────────────────────────────────

export interface VarDef { code: string; label: string }
export interface VarCategory { title: string; vars: VarDef[] }

const STORE_VARS: VarDef[] = [
  { code: '{store_name}', label: 'Tên cửa hàng' },
  { code: '{store_address}', label: 'Địa chỉ' },
  { code: '{store_phone}', label: 'Điện thoại' },
  { code: '{store_email}', label: 'Email' },
  { code: '{store_tax_code}', label: 'Mã số thuế' },
  { code: '{print_footer}', label: 'Chân trang' },
  { code: '{print_date}', label: 'Ngày giờ in' },
];

const UTIL_VARS: VarDef[] = [
  { code: '{#if tên_biến}', label: 'Bắt đầu điều kiện — hiện khi biến có giá trị' },
  { code: '{/if}', label: 'Kết thúc điều kiện' },
];

export const KEYWORDS_HOA_DON: VarCategory[] = [
  { title: 'Thông tin cửa hàng', vars: STORE_VARS },
  {
    title: 'Thông tin đơn hàng', vars: [
      { code: '{order_code}', label: 'Mã đơn hàng' },
      { code: '{order_date}', label: 'Ngày tạo đơn' },
      { code: '{order_status}', label: 'Trạng thái đơn hàng' },
      { code: '{payment_status}', label: 'Trạng thái thanh toán' },
      { code: '{customer_name}', label: 'Tên khách hàng' },
      { code: '{customer_code}', label: 'Mã khách hàng' },
      { code: '{customer_phone}', label: 'SĐT khách hàng' },
      { code: '{customer_email}', label: 'Email khách hàng' },
      { code: '{customer_address}', label: 'Địa chỉ khách hàng' },
      { code: '{staff_name}', label: 'Nhân viên bán' },
      { code: '{branch_name}', label: 'Chi nhánh' },
      { code: '{notes}', label: 'Ghi chú đơn hàng' },
      { code: '{payment_method}', label: 'Phương thức thanh toán' },
    ],
  },
  {
    title: 'Tổng giá trị', vars: [
      { code: '{total_quantity}', label: 'Tổng số lượng SP' },
      { code: '{subtotal}', label: 'Tạm tính' },
      { code: '{discount_amount}', label: 'Giảm giá (rỗng nếu không có)' },
      { code: '{shipping_fee}', label: 'Phí vận chuyển (rỗng nếu không có)' },
      { code: '{total_amount}', label: 'Tổng tiền' },
      { code: '{total_text}', label: 'Tổng tiền bằng chữ' },
      { code: '{paid_amount}', label: 'Đã thanh toán (rỗng nếu chưa TT)' },
      { code: '{debt_amount}', label: 'Còn nợ (rỗng nếu không nợ)' },
    ],
  },
  {
    title: 'QR thanh toán', vars: [
      { code: '{payment_qr}', label: 'Mã QR VietQR (ngân hàng mặc định — cần internet khi in)' },
    ],
  },
  {
    title: 'Bảng sản phẩm — tiện ích', vars: [
      { code: '{items_table}', label: 'Bảng sản phẩm tự động (đơn giản nhất)' },
    ],
  },
  {
    title: 'Bảng sản phẩm — vòng lặp tùy chỉnh', vars: [
      { code: '{#each items}', label: 'Bắt đầu lặp từng sản phẩm' },
      { code: '{line_stt}', label: '  STT dòng' },
      { code: '{line_name}', label: '  Tên sản phẩm' },
      { code: '{line_code}', label: '  Mã sản phẩm' },
      { code: '{line_qty}', label: '  Số lượng' },
      { code: '{line_unit}', label: '  Đơn vị tính' },
      { code: '{line_price}', label: '  Đơn giá' },
      { code: '{line_discount_pct}', label: '  Chiết khấu %' },
      { code: '{line_total}', label: '  Thành tiền' },
      { code: '{/each}', label: 'Kết thúc lặp' },
    ],
  },
  { title: 'Điều kiện', vars: UTIL_VARS },
];

// ── Default template: Đơn Hàng Nhập ─────────────────────────────────────────

export const DEFAULT_TEMPLATE_DON_HANG_NHAP = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:12px">
  <div>
    <div style="font-weight:700;font-size:15px">{store_name}</div>
    {#if store_address}<div style="color:#555;margin-top:2px;font-size:11px">{store_address}</div>{/if}
    {#if store_phone}<div style="color:#555;margin-top:1px;font-size:11px">ĐT: {store_phone}</div>{/if}
    {#if store_tax_code}<div style="color:#555;margin-top:1px;font-size:11px">MST: {store_tax_code}</div>{/if}
  </div>
  <div style="text-align:right;min-width:180px">
    <div style="font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Đơn Hàng Nhập</div>
    <div style="margin-top:6px;font-size:13px"><strong>Số:</strong> <span style="font-family:monospace">{po_code}</span></div>
    <div style="font-size:11px;color:#555;margin-top:2px"><strong>Ngày:</strong> {po_date}</div>
    {#if po_status}<div style="font-size:11px;color:#555;margin-top:1px"><strong>Trạng thái:</strong> {po_status}</div>{/if}
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:14px;font-size:12px">
  <div><strong>Nhà cung cấp:</strong> {supplier_name}</div>
  {#if supplier_phone}<div><strong>SĐT NCC:</strong> {supplier_phone}</div>{/if}
  {#if staff_name}<div><strong>Nhân viên:</strong> {staff_name}</div>{/if}
  {#if branch_name}<div><strong>Chi nhánh:</strong> {branch_name}</div>{/if}
  {#if currency}<div><strong>Tiền tệ:</strong> {currency} — tỷ giá {exchange_rate}</div>{/if}
  {#if expected_date}<div><strong>Ngày dự kiến:</strong> {expected_date}</div>{/if}
</div>
{items_table}
<div style="display:flex;justify-content:flex-end;margin-bottom:14px">
  <table style="min-width:280px;font-size:12px;border-collapse:collapse">
    <tbody>
      {#if subtotal_foreign}<tr><td style="padding:3px 8px;color:#555">Tạm tính ({currency}):</td><td style="padding:3px 8px;text-align:right">{subtotal_foreign}</td></tr>{/if}
      {#if subtotal_vnd}<tr><td style="padding:3px 8px;color:#555">Tạm tính (VNĐ):</td><td style="padding:3px 8px;text-align:right">{subtotal_vnd}</td></tr>{/if}
      {#if discount_amount}<tr><td style="padding:3px 8px;color:#555">Giảm giá:</td><td style="padding:3px 8px;text-align:right;color:#dc2626">-{discount_amount}</td></tr>{/if}
      {#if shipping_fee}<tr><td style="padding:3px 8px;color:#555">Phí vận chuyển:</td><td style="padding:3px 8px;text-align:right">{shipping_fee}</td></tr>{/if}
      <tr style="border-top:1.5px solid #000"><td style="padding:7px 8px;font-weight:700;font-size:13px">TỔNG TIỀN (VNĐ):</td><td style="padding:7px 8px;text-align:right;font-weight:700;font-size:14px">{total_amount_vnd}</td></tr>
      {#if paid_amount}<tr><td style="padding:3px 8px;color:#16a34a">Đã thanh toán:</td><td style="padding:3px 8px;text-align:right;color:#16a34a;font-weight:600">{paid_amount}</td></tr>{/if}
      {#if debt_amount}<tr><td style="padding:3px 8px;color:#dc2626;font-weight:600">Còn nợ NCC:</td><td style="padding:3px 8px;text-align:right;color:#dc2626;font-weight:700">{debt_amount}</td></tr>{/if}
    </tbody>
  </table>
</div>
<div style="font-size:11px;margin-bottom:8px;color:#444">Bằng chữ: <em>{total_text}</em></div>
{#if payment_method}<div style="font-size:12px;margin-bottom:8px">PTTT: {payment_method}</div>{/if}
{#if notes}<div style="margin-bottom:16px;padding:6px 10px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:11px"><strong>Ghi chú:</strong> {notes}</div>{/if}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;text-align:center;font-size:12px">
  <div>
    <div style="font-weight:600;margin-bottom:4px">Nhà cung cấp</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#555;font-style:italic">{supplier_name}</div>
  </div>
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người lập phiếu</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#555;font-style:italic">{staff_name}</div>
  </div>
</div>
{#if print_footer}<div style="margin-top:24px;text-align:center;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px">{print_footer}</div>{/if}
<div style="margin-top:12px;font-size:9px;color:#bbb;text-align:right">In lúc: {print_date}</div>`;

// ── Default template: Trả Hàng NCC ───────────────────────────────────────────

export const DEFAULT_TEMPLATE_TRA_HANG_NCC = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:12px">
  <div>
    <div style="font-weight:700;font-size:15px">{store_name}</div>
    {#if store_address}<div style="color:#555;margin-top:2px;font-size:11px">{store_address}</div>{/if}
    {#if store_phone}<div style="color:#555;margin-top:1px;font-size:11px">ĐT: {store_phone}</div>{/if}
  </div>
  <div style="text-align:right;min-width:180px">
    <div style="font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Phiếu Trả Hàng NCC</div>
    <div style="margin-top:6px;font-size:13px"><strong>Số:</strong> <span style="font-family:monospace">{return_code}</span></div>
    <div style="font-size:11px;color:#555;margin-top:2px"><strong>Ngày:</strong> {return_date}</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:14px;font-size:12px">
  <div><strong>Nhà cung cấp:</strong> {supplier_name}</div>
  {#if po_code}<div><strong>Đơn nhập gốc:</strong> <span style="font-family:monospace;color:#2563eb">{po_code}</span></div>{/if}
  {#if return_reason}<div><strong>Lý do trả:</strong> {return_reason}</div>{/if}
  {#if staff_name}<div><strong>Nhân viên:</strong> {staff_name}</div>{/if}
  {#if branch_name}<div><strong>Chi nhánh:</strong> {branch_name}</div>{/if}
</div>
{items_table}
<div style="display:flex;justify-content:flex-end;margin-bottom:14px">
  <table style="min-width:260px;font-size:12px;border-collapse:collapse">
    <tbody>
      <tr style="border-top:1.5px solid #000"><td style="padding:7px 8px;font-weight:700;font-size:13px">TỔNG GIÁ TRỊ TRẢ:</td><td style="padding:7px 8px;text-align:right;font-weight:700;font-size:14px">{total_amount}</td></tr>
      {#if refunded_amount}<tr><td style="padding:3px 8px;color:#16a34a">NCC đã hoàn tiền:</td><td style="padding:3px 8px;text-align:right;color:#16a34a;font-weight:600">{refunded_amount}</td></tr>{/if}
    </tbody>
  </table>
</div>
<div style="font-size:11px;margin-bottom:8px;color:#444">Bằng chữ: <em>{total_text}</em></div>
{#if notes}<div style="margin-bottom:8px;padding:6px 10px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:11px"><strong>Ghi chú nội bộ:</strong> {notes}</div>{/if}
{#if supplier_notes}<div style="margin-bottom:16px;padding:6px 10px;background:#eff6ff;border-left:3px solid #3b82f6;font-size:11px"><strong>Ghi chú gửi NCC:</strong> {supplier_notes}</div>{/if}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;text-align:center;font-size:12px">
  <div>
    <div style="font-weight:600;margin-bottom:4px">Đại diện NCC</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#555;font-style:italic">{supplier_name}</div>
  </div>
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người lập phiếu</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#555;font-style:italic">{staff_name}</div>
  </div>
</div>
{#if print_footer}<div style="margin-top:24px;text-align:center;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px">{print_footer}</div>{/if}
<div style="margin-top:12px;font-size:9px;color:#bbb;text-align:right">In lúc: {print_date}</div>`;

// ── Default template: Vận Đơn ─────────────────────────────────────────────────

export const DEFAULT_TEMPLATE_VAN_DON = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:12px">
  <div>
    <div style="font-weight:700;font-size:15px">{store_name}</div>
    {#if store_address}<div style="color:#555;margin-top:2px;font-size:11px">{store_address}</div>{/if}
    {#if store_phone}<div style="color:#555;margin-top:1px;font-size:11px">ĐT: {store_phone}</div>{/if}
  </div>
  <div style="text-align:right;min-width:180px">
    <div style="font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Vận Đơn</div>
    <div style="margin-top:6px;font-size:13px"><strong>Mã:</strong> <span style="font-family:monospace">{shipment_code}</span></div>
    {#if tracking_code}<div style="font-size:12px;color:#2563eb;margin-top:2px"><strong>Tracking:</strong> <span style="font-family:monospace">{tracking_code}</span></div>{/if}
    <div style="font-size:11px;color:#555;margin-top:2px"><strong>Ngày tạo:</strong> {shipment_date}</div>
  </div>
</div>
<div style="margin-bottom:16px;padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px">
  <div style="font-weight:600;font-size:12px;margin-bottom:8px;color:#0369a1">THÔNG TIN NGƯỜI NHẬN</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:12px">
    <div><strong>Tên:</strong> {receiver_name}</div>
    {#if receiver_phone}<div><strong>SĐT:</strong> {receiver_phone}</div>{/if}
    {#if receiver_address}<div style="grid-column:1/-1"><strong>Địa chỉ:</strong> {receiver_address}</div>{/if}
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:14px;font-size:12px">
  <div><strong>Đơn vị VC:</strong> {carrier_name}</div>
  <div><strong>Loại:</strong> {shipment_type}</div>
  {#if order_code}<div><strong>Đơn hàng:</strong> <span style="font-family:monospace;color:#2563eb">{order_code}</span></div>{/if}
  {#if scheduled_date}<div><strong>Ngày giao dự kiến:</strong> {scheduled_date}</div>{/if}
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px">
  <tbody>
    <tr style="border-bottom:1px solid #eee"><td style="padding:5px 8px;color:#555;width:160px">Phí vận chuyển:</td><td style="padding:5px 8px;font-weight:600;text-align:right">{shipping_fee}</td></tr>
    {#if cod_amount}<tr style="border-bottom:1px solid #eee"><td style="padding:5px 8px;color:#555">Tiền thu hộ (COD):</td><td style="padding:5px 8px;font-weight:700;font-size:14px;text-align:right;color:#7c3aed">{cod_amount}</td></tr>{/if}
  </tbody>
</table>
{#if notes}<div style="margin-bottom:16px;padding:6px 10px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:11px"><strong>Ghi chú:</strong> {notes}</div>{/if}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;text-align:center;font-size:12px">
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người giao hàng</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px"></div>
  </div>
  <div>
    <div style="font-weight:600;margin-bottom:4px">Người nhận hàng</div>
    <div style="font-size:10px;color:#777;margin-bottom:44px">(Ký, ghi rõ họ tên)</div>
    <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#555;font-style:italic">{receiver_name}</div>
  </div>
</div>
{#if print_footer}<div style="margin-top:24px;text-align:center;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px">{print_footer}</div>{/if}
<div style="margin-top:12px;font-size:9px;color:#bbb;text-align:right">In lúc: {print_date}</div>`;

// ── Keywords: Đơn Hàng Nhập ──────────────────────────────────────────────────

export const KEYWORDS_DON_HANG_NHAP: VarCategory[] = [
  { title: 'Thông tin cửa hàng', vars: STORE_VARS },
  {
    title: 'Thông tin đơn nhập', vars: [
      { code: '{po_code}', label: 'Mã đơn nhập' },
      { code: '{po_date}', label: 'Ngày tạo đơn' },
      { code: '{po_status}', label: 'Trạng thái đơn' },
      { code: '{supplier_name}', label: 'Tên nhà cung cấp' },
      { code: '{supplier_code}', label: 'Mã nhà cung cấp' },
      { code: '{supplier_phone}', label: 'SĐT nhà cung cấp' },
      { code: '{supplier_address}', label: 'Địa chỉ nhà cung cấp' },
      { code: '{currency}', label: 'Tiền tệ (VND/CNY/USD)' },
      { code: '{exchange_rate}', label: 'Tỷ giá' },
      { code: '{expected_date}', label: 'Ngày dự kiến nhận' },
      { code: '{received_date}', label: 'Ngày thực tế nhận' },
      { code: '{staff_name}', label: 'Nhân viên lập đơn' },
      { code: '{branch_name}', label: 'Chi nhánh' },
      { code: '{notes}', label: 'Ghi chú' },
      { code: '{payment_method}', label: 'Phương thức thanh toán' },
    ],
  },
  {
    title: 'Tổng giá trị', vars: [
      { code: '{subtotal_foreign}', label: 'Tạm tính (ngoại tệ)' },
      { code: '{subtotal_vnd}', label: 'Tạm tính (VNĐ)' },
      { code: '{discount_amount}', label: 'Giảm giá' },
      { code: '{shipping_fee}', label: 'Phí vận chuyển' },
      { code: '{total_amount_vnd}', label: 'Tổng tiền (VNĐ)' },
      { code: '{total_text}', label: 'Tổng tiền bằng chữ' },
      { code: '{paid_amount}', label: 'Đã thanh toán' },
      { code: '{debt_amount}', label: 'Còn nợ NCC' },
    ],
  },
  {
    title: 'Bảng sản phẩm', vars: [
      { code: '{items_table}', label: 'Bảng SP tự động' },
      { code: '{#each items}', label: 'Bắt đầu lặp từng SP' },
      { code: '{line_stt}', label: '  STT dòng' },
      { code: '{line_name}', label: '  Tên sản phẩm' },
      { code: '{line_code}', label: '  Mã sản phẩm' },
      { code: '{line_qty}', label: '  Số lượng' },
      { code: '{line_unit}', label: '  Đơn vị tính' },
      { code: '{line_price_foreign}', label: '  Đơn giá (ngoại tệ)' },
      { code: '{line_total_foreign}', label: '  Thành tiền (ngoại tệ)' },
      { code: '{line_price_vnd}', label: '  Đơn giá (VNĐ)' },
      { code: '{line_total_vnd}', label: '  Thành tiền (VNĐ)' },
      { code: '{/each}', label: 'Kết thúc lặp' },
    ],
  },
  { title: 'Điều kiện', vars: UTIL_VARS },
];

// ── Keywords: Trả Hàng NCC ────────────────────────────────────────────────────

export const KEYWORDS_TRA_HANG_NCC: VarCategory[] = [
  { title: 'Thông tin cửa hàng', vars: STORE_VARS },
  {
    title: 'Thông tin phiếu trả', vars: [
      { code: '{return_code}', label: 'Mã phiếu trả hàng' },
      { code: '{return_date}', label: 'Ngày trả' },
      { code: '{return_status}', label: 'Trạng thái phiếu' },
      { code: '{supplier_name}', label: 'Tên nhà cung cấp' },
      { code: '{supplier_code}', label: 'Mã nhà cung cấp' },
      { code: '{po_code}', label: 'Mã đơn nhập gốc' },
      { code: '{return_reason}', label: 'Lý do trả' },
      { code: '{notes}', label: 'Ghi chú nội bộ' },
      { code: '{supplier_notes}', label: 'Ghi chú gửi NCC' },
      { code: '{staff_name}', label: 'Nhân viên lập phiếu' },
      { code: '{branch_name}', label: 'Chi nhánh' },
    ],
  },
  {
    title: 'Tổng giá trị', vars: [
      { code: '{total_amount}', label: 'Tổng giá trị trả' },
      { code: '{total_text}', label: 'Tổng tiền bằng chữ' },
      { code: '{refunded_amount}', label: 'NCC đã hoàn tiền' },
      { code: '{refund_status}', label: 'Trạng thái hoàn tiền' },
    ],
  },
  {
    title: 'Bảng sản phẩm', vars: [
      { code: '{items_table}', label: 'Bảng SP tự động' },
      { code: '{#each items}', label: 'Bắt đầu lặp từng SP' },
      { code: '{line_stt}', label: '  STT dòng' },
      { code: '{line_name}', label: '  Tên sản phẩm' },
      { code: '{line_code}', label: '  Mã sản phẩm' },
      { code: '{line_qty}', label: '  Số lượng' },
      { code: '{line_unit}', label: '  Đơn vị tính' },
      { code: '{line_price}', label: '  Đơn giá (VNĐ)' },
      { code: '{line_total}', label: '  Thành tiền (VNĐ)' },
      { code: '{/each}', label: 'Kết thúc lặp' },
    ],
  },
  { title: 'Điều kiện', vars: UTIL_VARS },
];

// ── Keywords: Vận Đơn ─────────────────────────────────────────────────────────

export const KEYWORDS_VAN_DON: VarCategory[] = [
  { title: 'Thông tin cửa hàng', vars: STORE_VARS },
  {
    title: 'Thông tin vận đơn', vars: [
      { code: '{shipment_code}', label: 'Mã vận đơn' },
      { code: '{tracking_code}', label: 'Mã tracking (GHTK/GHN...)' },
      { code: '{shipment_date}', label: 'Ngày tạo vận đơn' },
      { code: '{carrier_name}', label: 'Đơn vị vận chuyển' },
      { code: '{shipment_type}', label: 'Loại (B2B / COD)' },
      { code: '{order_code}', label: 'Mã đơn hàng liên kết' },
      { code: '{scheduled_date}', label: 'Ngày giao dự kiến' },
      { code: '{delivered_date}', label: 'Ngày giao thực tế' },
      { code: '{shipment_status}', label: 'Trạng thái vận đơn' },
      { code: '{notes}', label: 'Ghi chú' },
    ],
  },
  {
    title: 'Người nhận', vars: [
      { code: '{receiver_name}', label: 'Tên người nhận' },
      { code: '{receiver_phone}', label: 'SĐT người nhận' },
      { code: '{receiver_address}', label: 'Địa chỉ giao hàng' },
    ],
  },
  {
    title: 'Cước phí', vars: [
      { code: '{shipping_fee}', label: 'Phí vận chuyển' },
      { code: '{cod_amount}', label: 'Tiền thu hộ COD' },
    ],
  },
  { title: 'Điều kiện', vars: UTIL_VARS },
];

export const KEYWORDS_TX: VarCategory[] = [
  { title: 'Thông tin cửa hàng', vars: STORE_VARS },
  {
    title: 'Thông tin phiếu', vars: [
      { code: '{tx_code}', label: 'Mã phiếu' },
      { code: '{tx_date}', label: 'Ngày phiếu' },
      { code: '{partner_name}', label: 'Người nộp / nhận tiền' },
      { code: '{amount}', label: 'Số tiền (định dạng tiền tệ)' },
      { code: '{amount_text}', label: 'Số tiền bằng chữ' },
      { code: '{reason}', label: 'Lý do thu / chi' },
      { code: '{payment_method}', label: 'Phương thức thanh toán' },
      { code: '{notes}', label: 'Ghi chú (rỗng nếu không có)' },
      { code: '{linked_order}', label: 'Mã đơn hàng liên kết (rỗng nếu không có)' },
      { code: '{staff_name}', label: 'Người lập phiếu' },
      { code: '{branch_name}', label: 'Chi nhánh (rỗng nếu không có)' },
    ],
  },
  { title: 'Điều kiện', vars: UTIL_VARS },
];

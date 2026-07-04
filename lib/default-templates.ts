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

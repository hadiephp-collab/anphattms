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

// ─── Shared mini-components ──────────────────────────────────────────────────

function Sec({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider
                    mt-5 mb-2 pb-1 border-b border-slate-100">
      {children}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((s, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold
                          flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </div>
          <div className="text-[12px] leading-relaxed flex-1"
               dangerouslySetInnerHTML={{ __html: s }} />
        </div>
      ))}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border-l-[3px] border-blue-500 rounded-r-lg
                    px-4 py-2.5 text-[12px] text-blue-800 mt-3">
      {children}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-orange-50 border-l-[3px] border-orange-400 rounded-r-lg
                    px-4 py-2.5 text-[12px] text-orange-800 mt-3">
      {children}
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] leading-[1.85] text-slate-700">{children}</div>;
}

// ─── Content for each tab ────────────────────────────────────────────────────

function ContentTongQuan() {
  const modules = [
    { color: '#16a34a', name: 'Đơn Hàng Bán', desc: 'Tạo đơn POS split-screen, quản lý trạng thái, in hóa đơn' },
    { color: '#7c3aed', name: 'Đối Tác', desc: 'Khách hàng + Nhà cung cấp dual-role, công nợ, lịch sử' },
    { color: '#0891b2', name: 'Sản Phẩm', desc: 'Danh mục, giá bán, giá vốn, đơn vị tính, bảo hành' },
    { color: '#dc2626', name: 'Thu Chi', desc: 'Phiếu thu/chi, sổ quỹ, loại phiếu, tài khoản NH' },
    { color: '#0e7490', name: 'Đơn Hàng Nhập', desc: 'Nhập hàng NCC, đa ngoại tệ CNY/USD, thanh toán nhiều lần' },
    { color: '#5b21b6', name: 'Vận Chuyển', desc: 'Vận đơn tracking, B2B + COD, đơn vị vận chuyển' },
    { color: '#be185d', name: 'Nhân Viên', desc: 'Thông tin HR, tài khoản đăng nhập, vai trò & phân quyền' },
    { color: '#059669', name: 'Kế Toán', desc: 'HĐ VAT, Chốt Sổ, Hỗ Trợ KT Thuế, Vốn & BreakEven' },
  ];
  return (
    <>
      <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
        <strong className="text-slate-800">An Phát TMS</strong> là phần mềm quản lý bán hàng &amp; vận hành
        toàn diện xây dựng trên <strong>NestJS + Next.js + Supabase</strong>. Hỗ trợ nghiệp vụ
        <strong> B2B</strong> (bán sỉ / đại lý) và <strong>B2C / COD</strong> (bán lẻ).
      </p>

      <Sec>Các Module Chính</Sec>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {modules.map(m => (
          <div key={m.name}
               className="flex gap-3 bg-slate-50 rounded-lg px-3 py-2.5 items-start">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: m.color }} />
            <div>
              <div className="text-[12px] font-semibold text-slate-800">{m.name}</div>
              <div className="text-[11px] text-slate-500">{m.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <Sec>Phím Tắt Hữu Ích</Sec>
      <div className="flex flex-wrap gap-3 text-[12px]">
        {[
          ['Ctrl+S', 'Lưu form'],
          ['Esc', 'Đóng modal'],
          ['Ctrl+F', 'Tìm kiếm nhanh'],
          ['Enter', 'Xác nhận'],
        ].map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <code className="inline-flex items-center bg-slate-100 border border-slate-200
                             rounded px-2 py-0.5 font-mono text-[11px] text-slate-700">
              {k}
            </code>
            <span className="text-slate-500">{v}</span>
          </span>
        ))}
      </div>
      <Tip>💡 Điều hướng nhanh qua thanh sidebar bên trái. Nhấp vào tên module để xem hướng dẫn.</Tip>
    </>
  );
}

function ContentDonHang() {
  return (
    <>
      <Sec>Tạo Đơn Hàng Mới (Giao Diện POS)</Sec>
      <Steps items={[
        'Nhấn nút <strong>+ Tạo đơn hàng</strong> trên trang Đơn Hàng Bán.',
        'Màn hình chia đôi: <strong>trái (70%)</strong> = danh sách sản phẩm, <strong>phải (30%)</strong> = giỏ hàng & tổng tiền.',
        'Tìm sản phẩm bằng thanh tìm kiếm hoặc lọc danh mục. Nhấn để thêm vào giỏ.',
        'Điều chỉnh số lượng, ghi chú từng dòng sản phẩm trong giỏ.',
        'Chọn khách hàng (tùy chọn), phương thức thanh toán, chi nhánh, giảm giá nếu có.',
        'Nhấn <strong>Hoàn tất đơn hàng</strong> — hệ thống tự trừ tồn kho, cập nhật công nợ KH.',
      ]} />

      <Sec>Quản Lý Đơn Hàng</Sec>
      <Prose>
        • <strong>KPI bar</strong> phía trên: Hôm nay / Tháng này / Đang xử lý / Doanh thu.<br/>
        • Lọc theo trạng thái: Tất cả / Chờ xử lý / Đang xử lý / Hoàn thành / Đã hủy.<br/>
        • Nhấn vào đơn để xem chi tiết, sửa thông tin, hoặc hủy.<br/>
        • Tab <strong>Thanh toán</strong> trong chi tiết: ghi nhận thanh toán nhiều lần (cập nhật paymentStatus tự động).
      </Prose>

      <Warn>⚠️ Đơn hàng ở trạng thái <strong>Hoàn thành</strong> chỉ Admin mới có thể hủy.</Warn>
      <Tip>💡 Nếu cần giảm giá đặc biệt, tạo <strong>Yêu Cầu Giá</strong> để manager duyệt trước khi chốt đơn.</Tip>
    </>
  );
}

function ContentDoiTac() {
  return (
    <>
      <p className="text-[12px] text-slate-500 mb-3">
        Đối Tác = Khách Hàng + Nhà Cung Cấp. Một người có thể đảm nhận cả 2 vai trò cùng lúc.
      </p>

      <Sec>Thêm Đối Tác Mới</Sec>
      <Steps items={[
        'Nhấn <strong>+ Thêm đối tác</strong>, chọn Loại: Khách hàng / Nhà cung cấp / Đơn vị VC / Cả hai.',
        'Điền thông tin: Tên, SĐT, Địa chỉ, Mã số thuế (B2B), Nhóm, Phân loại (trong nước/nước ngoài).',
        'Chọn nhân viên phụ trách và nhóm giá nếu có.',
        'Lưu → Mã tự động tạo (KH001 hoặc NCC001).',
      ]} />

      <Sec>Trang Chi Tiết Đối Tác</Sec>
      <Prose>
        <strong>Sidebar Tài chính</strong> — Tổng đơn, Doanh thu, Công nợ, Ngày giao dịch cuối.<br/>
        <strong>Tab Lịch sử đơn hàng</strong> — Toàn bộ đơn bán liên quan đến KH này.<br/>
        <strong>Công nợ NCC</strong> — Hiển thị <code>supplierDebt</code> cho đối tác là NCC/VC.
      </Prose>

      <Sec>Trang Tổng Quan Đối Tác</Sec>
      <Prose>
        📊 <strong>3 KPI card</strong>: Công nợ phải thu / Công nợ phải trả / Công nợ ròng.<br/>
        🏆 <strong>Top công nợ</strong>: Bảng KH phải thu nhiều nhất &amp; NCC phải trả nhiều nhất.
      </Prose>

      <Tip>💡 Quản lý chi tiết công nợ tại module <strong>Công Nợ</strong> — có aging analysis và FIFO tự động.</Tip>
    </>
  );
}

function ContentSanPham() {
  return (
    <>
      <Sec>Thêm Sản Phẩm</Sec>
      <Steps items={[
        'Nhấn <strong>+ Thêm sản phẩm</strong>, điền tên, danh mục, đơn vị tính (chọn từ danh sách ĐVT).',
        'Nhập giá vốn, giá bán lẻ. Hệ thống tính biên lợi nhuận tự động.',
        'Nhập số tháng bảo hành nếu có — hệ thống tự tạo phiếu BH khi bán.',
        'Upload ảnh sản phẩm (tối đa 5MB).',
        'Lưu → Mã sản phẩm tự động tạo (SP001...).',
      ]} />

      <Sec>Quản Lý Tồn Kho</Sec>
      <Prose>
        • <strong>Nhập hàng</strong>: Tạo Đơn Hàng Nhập → tồn tự động cộng khi chuyển trạng thái &quot;Đã nhận&quot;.<br/>
        • <strong>Kiểm hàng</strong>: Vào module Tồn Kho → tab Kiểm Hàng → nhập số thực tế → hệ thống điều chỉnh chênh lệch.<br/>
        • <strong>Tồn tối thiểu</strong>: Đặt giá trị cảnh báo cho từng SP trong form sửa sản phẩm.
      </Prose>

      <Sec>Đơn Vị Tính</Sec>
      <Prose>
        Quản lý danh sách ĐVT tại <strong>Danh Mục → Đơn Vị Tính</strong>.<br/>
        Hệ thống seed sẵn 10 ĐVT: Cái, Chiếc, Hộp, Thùng, Bộ, Kg, Gram, Lít, Mét, Cuộn.
      </Prose>

      <Tip>💡 Cài đặt giá theo nhóm khách hàng tại module <strong>Bảng Giá</strong>.</Tip>
    </>
  );
}

function ContentTonKho() {
  return (
    <>
      <p className="text-[12px] text-slate-500 mb-3">
        Module Tồn Kho cung cấp cái nhìn tổng thể về hàng tồn, lịch sử biến động và kiểm hàng thực tế.
      </p>

      <Sec>3 Tab Chính</Sec>
      <Prose>
        📊 <strong>Tồn Kho</strong> — Danh sách toàn bộ sản phẩm: số lượng, giá vốn trung bình, tổng giá trị.
        Column manager cho phép ẩn/hiện 7 cột tùy ý.<br/>
        🔄 <strong>Biến Động</strong> — Audit trail mọi thay đổi tồn kho (nhập hàng, bán hàng, điều chỉnh, trả hàng).<br/>
        📋 <strong>Kiểm Hàng</strong> — Tạo phiếu kiểm, nhập số lượng thực tế, hệ thống ghi chênh lệch và điều chỉnh.
      </Prose>

      <Sec>Các Loại Biến Động</Sec>
      <Prose>
        <code className="bg-slate-100 px-1 rounded text-[11px]">PURCHASE_IN</code> — Nhập từ đơn hàng nhập<br/>
        <code className="bg-slate-100 px-1 rounded text-[11px]">SALE_OUT</code> — Xuất theo đơn bán<br/>
        <code className="bg-slate-100 px-1 rounded text-[11px]">RETURN_IN</code> — KH trả hàng<br/>
        <code className="bg-slate-100 px-1 rounded text-[11px]">SUPPLIER_RETURN_OUT</code> — Trả hàng NCC<br/>
        <code className="bg-slate-100 px-1 rounded text-[11px]">MANUAL_IN / MANUAL_OUT</code> — Điều chỉnh thủ công
      </Prose>

      <Warn>⚠️ Tồn kho được tính tổng toàn hệ thống. Phân bổ theo chi nhánh sẽ có trong phiên bản tiếp theo.</Warn>
    </>
  );
}

function ContentThuChi() {
  return (
    <>
      <Sec>Tạo Phiếu Thu</Sec>
      <Steps items={[
        'Vào <strong>Thu Chi → Tab Phiếu Thu</strong> → nhấn <strong>+ Phiếu thu</strong>.',
        'Chọn loại phiếu thu (dropdown từ danh sách đã cấu hình), nhập diễn giải và số tiền.',
        'Chọn phương thức (Tiền mặt / Chuyển khoản / MoMo / Khác).',
        'Nếu CK: chọn tài khoản ngân hàng cụ thể.',
        'Tích <strong>Cập nhật công nợ</strong> nếu thu từ KH — hệ thống tự FIFO phân bổ vào đơn cũ nhất.',
        'Đính kèm ảnh chứng từ (tối đa 5MB). Lưu → Sổ quỹ tự cập nhật.',
      ]} />

      <Sec>Sổ Quỹ</Sec>
      <Prose>
        📊 Số dư đầu kỳ + lũy kế từng dòng — dễ đối chiếu với thực tế két.<br/>
        🔍 Filter theo kỳ, phương thức, chi nhánh. Sort mới nhất lên đầu.<br/>
        📥 Xuất file Excel/CSV cho kỳ đã chọn.
      </Prose>

      <Sec>Loại Phiếu</Sec>
      <Prose>
        Quản lý danh sách loại phiếu thu &amp; chi tại <strong>Thu Chi → Loại</strong>.<br/>
        Không xóa được loại đang có phiếu — chỉ có thể ẩn.
      </Prose>

      <Tip>💡 Dùng filter 18 cột để tìm kiếm nâng cao theo tag, người liên quan, khoảng tiền, ngày.</Tip>
    </>
  );
}

function ContentDonNhap() {
  return (
    <>
      <p className="text-[12px] text-slate-500 mb-3">
        Nhập hàng từ nhà cung cấp, hỗ trợ đa ngoại tệ CNY/USD với tỷ giá tùy chỉnh.
      </p>

      <Sec>Tạo Đơn Hàng Nhập</Sec>
      <Steps items={[
        'Chọn <strong>Nhà cung cấp</strong> từ danh sách Đối Tác (vai trò NCC).',
        'Thêm sản phẩm, nhập số lượng và <strong>đơn giá</strong> (chọn tiền tệ: VNĐ / CNY / USD).',
        'Nhập tỷ giá nếu là ngoại tệ — hệ thống quy đổi về VNĐ tự động.',
        'Thêm phí vận chuyển nếu có.',
        'Chuyển trạng thái <strong>Đặt hàng → Đã nhận</strong> khi hàng về — tồn kho tự tăng.',
        'Ghi nhận thanh toán (có thể nhiều lần) — hệ thống cập nhật nợ NCC tự động.',
      ]} />

      <Sec>Quản Lý Công Nợ NCC</Sec>
      <Prose>
        • Nợ NCC tăng tự động khi PO chuyển sang &quot;Đã nhận&quot;.<br/>
        • Thanh toán từng phần/toàn phần bằng nút <strong>Ghi nhận thanh toán</strong> trong chi tiết PO.<br/>
        • Tạo phiếu chi liên kết tự động khi thanh toán (tick &quot;Tạo phiếu chi&quot;).
      </Prose>

      <Tip>💡 Tạo HĐ VAT đầu vào từ chi tiết PO bằng nút <strong>Tạo HĐ VAT đầu vào</strong> (khi PO đã nhận).</Tip>
    </>
  );
}

function ContentVanChuyen() {
  return (
    <>
      <Sec>Tab Phương Thức Vận Chuyển</Sec>
      <Prose>
        Thêm đơn vị VC: GHTK, GHN, J&amp;T, Viettel Post, Tự giao...<br/>
        Chọn loại: <strong>B2B</strong> (giao doanh nghiệp) / <strong>COD</strong> (giao nhận tiền) / <strong>B2B+COD</strong>.<br/>
        Bật/tắt đơn vị — không xóa được khi còn vận đơn đang giao.
      </Prose>

      <Sec>Tab Vận Đơn</Sec>
      <Steps items={[
        'Nhấn <strong>+ Tạo vận đơn</strong>, chọn đơn vị vận chuyển.',
        'Chọn loại B2B hoặc COD. Nếu COD: nhập số tiền thu hộ.',
        'Điền thông tin người nhận, mã tracking (nếu có), ngày dự kiến giao.',
        'Liên kết với đơn hàng bán (nhập mã đơn hàng).',
      ]} />

      <Sec>Luồng Trạng Thái</Sec>
      <Prose>
        <strong>Chờ lấy hàng</strong> → <strong>Đã lấy hàng</strong> → <strong>Đang giao</strong> → <strong>Đã giao</strong> / <strong>Hoàn hàng</strong><br/>
        Từ &quot;Chờ lấy hàng&quot; hoặc &quot;Đã lấy hàng&quot; có thể chuyển sang <strong>Hủy</strong>.
      </Prose>

      <Tip>💡 KPI bar theo dõi: Đang giao / Đã giao / Hoàn hàng / Tổng tiền COD chờ thu.</Tip>
    </>
  );
}

function ContentNhanVien() {
  return (
    <>
      <Sec>Thêm Nhân Viên Mới</Sec>
      <Steps items={[
        'Nhấn <strong>+ Thêm nhân viên</strong>, điền: Họ tên, SĐT, Email, Phòng ban, Vị trí, Chi nhánh.',
        'Chọn <strong>Vai trò</strong>: Admin / Kế Toán / Sale / Viewer (hoặc vai trò tùy chỉnh).',
        '(Tùy chọn) Tick <strong>Cấp tài khoản</strong> → nhập username/mật khẩu để NV đăng nhập hệ thống.',
        'Phân quyền chi nhánh: chọn chi nhánh NV được phép thao tác (trống = toàn hệ thống).',
      ]} />

      <Sec>Ma Trận Phân Quyền</Sec>
      <Prose>
        Cấu hình chi tiết tại <strong>Cài Đặt → Vai Trò &amp; Quyền</strong>.<br/>
        Ma trận <strong>16 module × 5 action</strong> (view / create / edit / delete / export) cho mỗi vai trò.<br/>
        <span className="inline-flex items-center bg-yellow-100 text-yellow-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">Admin</span>
        {' '}luôn có đủ quyền, không bị ảnh hưởng bởi ma trận.
      </Prose>

      <Warn>⚠️ Mật khẩu được mã hóa (bcrypt) — Admin không xem được. Dùng &quot;Đặt lại mật khẩu&quot; nếu NV quên.</Warn>
      <Tip>💡 Vai trò chỉ cập nhật trong JWT sau khi NV đăng nhập lại.</Tip>
    </>
  );
}

function ContentChiNhanh() {
  return (
    <>
      <p className="text-[12px] text-slate-500 mb-3">
        Quản lý các kho/văn phòng của doanh nghiệp. Mỗi chi nhánh có mã riêng (CN-001).
      </p>

      <Sec>Thêm Chi Nhánh</Sec>
      <Steps items={[
        'Nhấn <strong>+ Thêm chi nhánh</strong>.',
        'Nhập tên, địa chỉ, email, SĐT liên hệ.',
        'Chọn <strong>Người phụ trách</strong> từ danh sách nhân viên đang hoạt động.',
        'Chọn múi giờ (mặc định Asia/Ho_Chi_Minh).',
        'Tick <strong>Đặt làm mặc định</strong> nếu đây là chi nhánh chính.',
      ]} />

      <Sec>Lưu Ý Quan Trọng</Sec>
      <Prose>
        ☆ Nhấn vào biểu tượng <strong>☆/★</strong> trong bảng để đổi chi nhánh mặc định nhanh.<br/>
        🔒 Không thể tắt chi nhánh duy nhất còn hoạt động.<br/>
        👤 NV được gán 1 chi nhánh → tự động điền khi tạo đơn/phiếu.<br/>
        👥 NV được gán nhiều chi nhánh → phải chọn tay khi thao tác.
      </Prose>
    </>
  );
}

function ContentBaoCao() {
  return (
    <>
      <p className="text-[12px] text-slate-500 mb-3">
        Báo cáo tổng hợp theo nhiều chiều: doanh thu, chi phí, tồn kho, đối tác, nhân viên.
      </p>

      <Sec>Các Báo Cáo Có Sẵn</Sec>
      <Prose>
        💰 <strong>Doanh thu &amp; Chi phí</strong> — theo ngày/tháng, lợi nhuận ròng, so sánh kỳ.<br/>
        📦 <strong>Tồn kho</strong> — giá trị tồn, sắp hết hàng, biến động.<br/>
        👥 <strong>Đối tác</strong> — Top KH doanh thu, công nợ tuổi nợ aging.<br/>
        👤 <strong>Nhân viên</strong> — Doanh thu theo NV, số đơn xử lý.<br/>
        🏢 <strong>Chi nhánh</strong> — Lọc toàn bộ báo cáo theo chi nhánh cụ thể.
      </Prose>

      <Sec>Cách Lọc</Sec>
      <Prose>
        Chọn <strong>khoảng thời gian</strong> (tháng này / quý này / tùy chỉnh) và <strong>chi nhánh</strong> trong header báo cáo.<br/>
        Nhấn <strong>Xuất</strong> để tải xuống Excel.
      </Prose>

      <Tip>💡 Module Báo Cáo đang được mở rộng — thêm phân tích CRM và ABC tồn kho trong phiên bản tới.</Tip>
    </>
  );
}

function ContentCaiDat() {
  return (
    <>
      <Sec>Cài Đặt Chung</Sec>
      <Prose>
        ⚙️ <strong>Thông tin công ty</strong>: Tên, địa chỉ, SĐT, email, mã số thuế, website.<br/>
        💳 <strong>Phương thức thanh toán</strong>: Thêm/sửa/bật-tắt PTTT. 4 PTTT hệ thống (TM/CK/MoMo/Khác) không xóa được.<br/>
        🏦 <strong>Thuế suất VAT mặc định</strong> và <strong>số ngày cảnh báo HĐ quá hạn</strong>.
      </Prose>

      <Sec>Vai Trò &amp; Quyền</Sec>
      <Prose>
        Tạo và quản lý vai trò tại <strong>Cài Đặt → Vai Trò &amp; Quyền</strong>.<br/>
        Tab <strong>Phân Quyền</strong> trong chi tiết vai trò: ma trận checkbox 16 module × 5 action.<br/>
        4 vai trò hệ thống (Admin/Kế Toán/Sale/Viewer) không xóa được.
      </Prose>

      <Sec>Tài Khoản Ngân Hàng</Sec>
      <Prose>
        Thêm TK NH tại <strong>Cài Đặt → Tài Khoản NH</strong>.<br/>
        TK mặc định sẽ được tự điền khi tạo phiếu CK.<br/>
        Không xóa được TK đang có giao dịch liên kết.
      </Prose>

      <Sec>Chốt Sổ &amp; Khóa Kỳ</Sec>
      <Prose>
        Kế toán viên dùng <strong>Kế Toán → Chốt Sổ &amp; Khóa Kỳ</strong> cuối mỗi tháng.<br/>
        Hệ thống kiểm tra 7 điều kiện trước khi cho phép khóa kỳ (đơn chưa hoàn thành, HĐ nháp...).<br/>
        Kỳ đã khóa có thể mở lại với lý do ≥ 20 ký tự.
      </Prose>
    </>
  );
}

// ─── Content map (filled for 12 tabs from GAS) ───────────────────────────────

const CONTENT_MAP: Partial<Record<TabKey, () => React.JSX.Element>> = {
  'tong-quan':   ContentTongQuan,
  'don-hang':    ContentDonHang,
  'doi-tac':     ContentDoiTac,
  'san-pham':    ContentSanPham,
  'ton-kho':     ContentTonKho,
  'thu-chi':     ContentThuChi,
  'don-nhap':    ContentDonNhap,
  'van-chuyen':  ContentVanChuyen,
  'nhan-vien':   ContentNhanVien,
  'chi-nhanh':   ContentChiNhanh,
  'bao-cao':     ContentBaoCao,
  'cai-dat':     ContentCaiDat,
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
                    const hasContent = !!CONTENT_MAP[tab.key];
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
                        {!hasContent && !isActive && (
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

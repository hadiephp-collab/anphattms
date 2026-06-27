# Hồ Sơ Module — Đối Tác (Partners)

> Trạng thái: ✅ **HOÀN THÀNH**  
> Ngày chốt: 15/06/2026  
> Người thực hiện: An Phát TMS Team

---

## Module này dùng để làm gì?

Module Đối Tác quản lý toàn bộ thông tin **khách hàng** và **nhà cung cấp** của An Phát.

Một đối tác có thể là:
- **Khách hàng** — người mua hàng từ An Phát
- **Nhà cung cấp** — đơn vị cung cấp hàng hoá cho An Phát
- **Cả hai** — vừa mua vừa bán (trường hợp đặc biệt)

---

## Tính năng đã hoàn thành

### Danh sách đối tác
- Hiển thị bảng danh sách với đầy đủ thông tin: mã, tên, SĐT, hạng, loại, nhân viên phụ trách
- **Tìm kiếm** theo tên, số điện thoại, mã đối tác — không phân biệt chữ hoa/thường
- **Lọc** theo loại (KH/NCC/Cả hai), hạng (Mới/Thường/Thân thiết/VIP), tỉnh thành, nhóm
- **Sắp xếp** theo tên, ngày tạo, doanh thu, công nợ, hạng
- **Phân trang** với tùy chọn hiển thị 20 / 50 / 100 kết quả mỗi trang
- **Chọn nhiều** để thao tác hàng loạt: xuất CSV, cập nhật hạng, xóa

### Thêm / Sửa đối tác
- Form đầy đủ: tên, mã, SĐT, email, địa chỉ, mã số thuế, ngân hàng, hạn mức công nợ, kỳ thanh toán...
- **Kiểm tra dữ liệu tự động:**
  - SĐT chỉ nhận chữ số (không gõ được chữ)
  - Mã số thuế chỉ nhận 10–13 chữ số
  - Số tài khoản chỉ nhận chữ số
  - Email kiểm tra đúng định dạng
- Mã đối tác tự sinh (`KH001`, `KH002`...) nếu không nhập tay
- Xóa mềm — đối tác bị xóa chỉ bị ẩn, không mất dữ liệu

### Trang chi tiết đối tác
Nhấn vào tên hoặc mã đối tác → mở trang chi tiết gồm:

**Thông tin cơ bản:**
- Mã, loại, SĐT, email, MST, website, nhóm, nguồn khách, nhân viên phụ trách, ngày tạo

**7 tab nội dung:**
| Tab | Nội dung |
|-----|---------|
| Lịch sử đơn hàng | Danh sách đơn hàng đã đặt (sẽ có dữ liệu khi làm module Đơn Hàng) |
| Công nợ & Phiếu | Tổng thu / Tổng chi / Công nợ + lịch sử phiếu thu chi |
| Liên hệ | SĐT, email, website, mạng xã hội |
| Địa chỉ | Tỉnh/thành, địa chỉ chi tiết |
| Ghi chú | Ghi chú tự do |
| Ngân hàng | Số TK, tên ngân hàng, kỳ thanh toán |

**Sidebar phải:**
- Hạng đối tác + tổng đơn hàng + tổng chi tiêu
- Tài chính: hạn mức công nợ, tỉ lệ sử dụng (thanh progress bar)
- Nhân viên phụ trách
- Tài khoản ngân hàng

### Tạo phiếu thu / chi
Nút "Tạo phiếu thu/chi" ở góc trên phải trang chi tiết đối tác.

**Form gồm:**
| Trường | Mô tả |
|--------|-------|
| Chi nhánh | Tự điền từ chi nhánh của người dùng đang đăng nhập |
| Ngày ghi nhận | Ngày + giờ cụ thể (không chỉ ngày) |
| Đối tác | Tự điền, chỉ đọc |
| Giá trị | Số tiền, hiển thị định dạng tiếng Việt (1.000.000đ) |
| Hình thức TT | Tiền mặt / Chuyển khoản / MoMo / Khác |
| Lý do | Danh sách gợi ý khác nhau cho phiếu thu và phiếu chi |
| Mô tả | Ghi chú tự do |
| Hạch toán KQKD | Tick = tính vào doanh thu/chi phí; bỏ tick = khoản nội bộ |

**Mã phiếu tự sinh:**
- Phiếu thu: `PT0001`, `PT0002`...
- Phiếu chi: `PC0001`, `PC0002`...

---

## Điểm còn hạn chế — sẽ làm sau

| Hạn chế | Lý do chưa làm | Dự kiến |
|---------|----------------|---------|
| Xuất CSV chưa có dữ liệu thật | Cần thêm API export | Module sau |
| Chi nhánh là ô nhập tay | Cần module Chi Nhánh hoàn thiện trước | Sau module Chi Nhánh |
| Tab Lịch sử đơn hàng còn trống | Cần module Đơn Hàng | Sau module Đơn Hàng |
| Chưa có báo cáo tổng hợp công nợ | Thuộc module Báo Cáo | Giai đoạn 2 |

---

## Cấu trúc dữ liệu chính (để tham khảo)

### Đối tác (Partner)
```
Mã đối tác      : KH001, KH002... (tự sinh)
Tên             : bắt buộc
Loại            : customer / supplier / both
Hạng            : new / normal / loyal / vip
Số điện thoại   : 8–15 chữ số
Email           : định dạng email hợp lệ
Mã số thuế      : 10–13 chữ số
Số tài khoản    : chỉ số, tối đa 30 ký tự
Hạn mức công nợ : số tiền (đồng)
Kỳ thanh toán   : số ngày
```

### Phiếu thu / chi (Transaction)
```
Mã phiếu        : PT0001... (thu) / PC0001... (chi) — tự sinh
Loại            : receipt (thu) / payment (chi)
Số tiền         : bắt buộc, số dương
Hình thức TT    : cash / bank_transfer / momo / other
Ngày giờ        : timestamp đầy đủ giờ phút
Chi nhánh       : tên chi nhánh
Hạch toán KQKD  : true/false (mặc định true)
Đối tác         : liên kết với đối tác
Người tạo       : tự ghi nhận từ tài khoản đang đăng nhập
```

---

## Tài liệu kỹ thuật liên quan

- API Spec đầy đủ: `D:\Workspace\anphattms-api\docs\api-partners.md`
- Backend code: `D:\Workspace\anphattms-api\src\partners\` và `src\transactions\`
- Frontend code: `D:\Project\anphattms\app\dashboard\partners\`

---

## Lịch sử thay đổi

| Ngày | Nội dung |
|------|---------|
| 15/06/2026 | Hoàn thành toàn bộ 7 bước, chốt module |
| 15/06/2026 | Thêm Chi nhánh + Hạch toán KQKD vào phiếu thu/chi |
| 15/06/2026 | Fix tìm kiếm không phân biệt hoa thường (ILike) |
| 15/06/2026 | Fix validation SĐT, MST, số TK ngân hàng |
| 15/06/2026 | Thêm cột Nhân viên phụ trách, trang chi tiết đối tác |

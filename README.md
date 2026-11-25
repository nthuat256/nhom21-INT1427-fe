# LabEquip Frontend

Frontend quản lý mượn–trả và bảo trì thiết bị phòng thực hành, viết bằng HTML, CSS và JavaScript ES modules thuần. Không cần React, bundler hay thư viện frontend. Mọi danh sách và thao tác nghiệp vụ đều gọi REST API; giao diện đăng nhập có nút đăng nhập nhanh cho ba vai trò demo.

## Cấu trúc

```text
fe/
  index.html
  styles.css
  js/
    app.js             SPA, màn hình, biểu mẫu và luồng theo vai trò
    api.js             Fetch client, Bearer JWT, refresh và xử lý lỗi
    icons.js           Bộ icon SVG inline dùng chung cho giao diện
    utils/qr.js        Tạo QR cục bộ cho mã định danh tài sản
```

## Chạy giao diện

Yêu cầu Python 3 (hoặc một static web server bất kỳ). Trong thư mục `nhom21-INT1427-fe`:

```powershell
py -m http.server 5500 --directory fe
```

Mở `http://localhost:5500`. Địa chỉ API được ẩn khỏi giao diện đăng nhập; frontend mặc định kết nối `http://localhost:8000/api/v1`.

## Kết nối Backend

1. Khởi chạy Backend theo hướng dẫn trong `nhom21-INT1427-api/README.md` (thường là `http://localhost:8000`).
2. Cấu hình CORS của Backend cho origin đang chạy giao diện. Với lệnh trên, đặt trong file `.env` của Backend:

   ```env
   CORS_ORIGINS=http://localhost:5500
   ```

   Khởi động lại API sau khi đổi cấu hình. Nếu chạy ở cổng khác, thêm origin chính xác của frontend vào `CORS_ORIGINS`.
3. Tạo dữ liệu minh họa bằng `python -m api.cli seed-demo` trong thư mục Backend. Lệnh này tạo 30 tài khoản Người dùng, 1 tài khoản Nhà trường, 5 tài khoản Người vận hành và các trạng thái mẫu cho quy trình mượn/bảo trì. Mở giao diện, chọn một trong ba nút trải nghiệm nhanh để điền sẵn email/mật khẩu, sau đó bấm **Đăng nhập** để xem giao diện và quyền tương ứng. Thông tin ba tài khoản mẫu nằm trong README Backend.
4. Người dùng mới có thể chọn **Tạo tài khoản người dùng** ở màn hình đăng nhập. Tài khoản đăng ký bằng email và mật khẩu, mặc định chỉ có vai trò `BORROWER`; đăng ký xong sẽ tự đăng nhập. Đăng nhập thường cũng chỉ chấp nhận email và mật khẩu hợp lệ trong Backend.
5. Mã SV/GV hiện chỉ là thông tin hồ sơ, chưa phải định danh đăng nhập trong Backend. Token truy cập và refresh chỉ được giữ trong `sessionStorage` của tab; khi access token hết hạn frontend gọi `/auth/refresh`.

## Chức năng theo quyền

- **BORROWER (Người dùng):** dashboard, phòng, lịch học, thiết bị/chi tiết, tạo phiếu mượn nhiều thiết bị, ghi lý do sử dụng ngoài lịch, xem và hủy phiếu còn cho phép, thông báo.
- **ADMIN (Nhà trường):** dashboard, quản lý/cập nhật người dùng và phân vai trò, phòng, danh mục, thiết bị và in nhãn QR, lịch học, duyệt/từ chối yêu cầu, xác nhận bàn giao/nhận trả, báo hỏng và settings.
- **TECHNICIAN (Người vận hành):** dashboard bảo trì, tiếp nhận, bắt đầu sửa, ghi chú tiến độ, lịch sử và hoàn tất sau khi xác nhận kiểm tra đạt.

API Backend chịu trách nhiệm quyền, kiểm tra tồn kho, trạng thái nghiệp vụ, hạn trả và ghi lịch sử/audit. Frontend hiển thị lỗi API thay vì giả lập thành công. Bảng sử dụng phân trang phía máy chủ; tìm kiếm/lọc chỉ gửi những query parameter mà endpoint hỗ trợ. Dashboard Nhà trường so sánh cả bảy trạng thái phiếu mượn từ tối đa 100 bản ghi đã tải và hiển thị số tổng do API trả về khi có.

Thông báo lỗi từ API và kiểm tra biểu mẫu được hiển thị bằng tiếng Việt. Thời gian trong lịch học và phiếu mượn nhập theo định dạng 24 giờ `HH:MM`.

## Ghi chú vận hành

- `py -m http.server` chỉ phù hợp phát triển nội bộ; triển khai thực tế nên dùng HTTPS và web server phù hợp.
- API hiện dùng tài khoản email; muốn đăng nhập bằng mã SV/GV cần bổ sung hỗ trợ tương ứng ở Backend.
- Endpoint đăng ký hiện chỉ tạo `BORROWER`; Backend chưa có endpoint quản trị tạo tài khoản với role tùy chọn. Quản trị viên có thể đổi role trong chức năng quản lý người dùng.
- QR được tạo cục bộ trong trình duyệt từ UUID của thiết bị, không gửi mã tài sản tới dịch vụ QR bên ngoài.
- CORS phải cho phép đúng frontend origin; không tắt kiểm tra CORS trong trình duyệt.

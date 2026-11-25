# LabEquip Frontend

Frontend quản lý mượn–trả và bảo trì thiết bị phòng thực hành, viết bằng HTML, CSS và JavaScript ES modules thuần. Không cần React, bundler hay thư viện frontend. Mọi danh sách và thao tác nghiệp vụ đều gọi REST API; giao diện không có dữ liệu mẫu.

## Cấu trúc

```text
fe/
  index.html
  styles.css
  js/
    app.js             SPA, màn hình, biểu mẫu và luồng theo vai trò
    api.js             Fetch client, Bearer JWT, refresh và xử lý lỗi
    utils/qr.js        Tạo QR cục bộ cho mã định danh tài sản
```

## Chạy giao diện

Yêu cầu Python 3 (hoặc một static web server bất kỳ). Trong thư mục `nhom21-INT1427-fe`:

```powershell
py -m http.server 5500 --directory fe
```

Mở `http://localhost:5500`. Có thể cấu hình lại URL API ngay ở màn hình đăng nhập; mặc định là `http://localhost:8000/api/v1`.

## Kết nối Backend

1. Khởi chạy Backend theo hướng dẫn trong `nhom21-INT1427-api/README.md` (thường là `http://localhost:8000`).
2. Cấu hình CORS của Backend cho origin đang chạy giao diện. Với lệnh trên, đặt trong file `.env` của Backend:

   ```env
   CORS_ORIGINS=http://localhost:5500
   ```

   Khởi động lại API sau khi đổi cấu hình. Nếu chạy ở cổng khác, thêm origin chính xác của frontend vào `CORS_ORIGINS`.
3. Mở giao diện và đăng nhập bằng **email + mật khẩu** đã đăng ký/tạo trong Backend. API hiện nhận email qua `POST /api/v1/auth/token`; mã SV/GV hiện chỉ là thông tin hồ sơ, chưa phải định danh đăng nhập trong Backend.
4. Token truy cập và refresh chỉ được giữ trong `sessionStorage` của tab; mọi request có token gửi `Authorization: Bearer`. Khi access token hết hạn frontend gọi `/auth/refresh`; refresh thất bại sẽ yêu cầu đăng nhập lại.

### SSO / OIDC

Backend hỗ trợ `POST /api/v1/auth/oidc` khi OIDC đã được cấu hình. Lần đầu chọn SSO, nhập OIDC issuer và public client ID; frontend dùng Authorization Code + PKCE (S256), `state` và `nonce`, đổi code lấy ID token rồi gửi ID token/nonce tới Backend. Cấu hình issuer/client ID lưu trong `localStorage`; verifier, state và nonce chỉ tồn tại trong `sessionStorage` trong một giao dịch. Đăng ký redirect URI hiển thị trên form SSO ở Identity Provider, bật CORS cho origin frontend tại metadata/token endpoint, và bảo đảm issuer/client ID/JWKS ở Backend khớp. Chỉ dùng HTTPS ngoài localhost. Backend vẫn là nơi xác thực chữ ký và claims ID token.

## Chức năng theo quyền

- **BORROWER:** dashboard, phòng, lịch học, thiết bị/chi tiết, tạo phiếu mượn nhiều thiết bị, ghi lý do sử dụng ngoài lịch, xem và hủy phiếu còn cho phép, thông báo.
- **ADMIN:** dashboard, tạo tài khoản borrower / cập nhật người dùng, phòng, danh mục, thiết bị và in nhãn QR, lịch học, duyệt/từ chối yêu cầu, xác nhận bàn giao/nhận trả, báo hỏng, audit logs, settings.
- **TECHNICIAN:** dashboard bảo trì, tiếp nhận, bắt đầu sửa, ghi chú tiến độ, lịch sử và hoàn tất sau khi xác nhận kiểm tra đạt.

API Backend chịu trách nhiệm quyền, kiểm tra tồn kho, trạng thái nghiệp vụ, hạn trả và ghi lịch sử/audit. Frontend hiển thị lỗi API thay vì giả lập thành công. Bảng sử dụng phân trang phía máy chủ; tìm kiếm/lọc chỉ gửi những query parameter mà endpoint hỗ trợ. Dashboard tổng hợp các bản ghi hiện được tải (tối đa 100) và số tổng do API trả về khi có.

## Ghi chú vận hành

- `py -m http.server` chỉ phù hợp phát triển nội bộ; triển khai thực tế nên dùng HTTPS và web server phù hợp.
- API hiện dùng tài khoản email; muốn đăng nhập bằng mã SV/GV cần bổ sung hỗ trợ tương ứng ở Backend.
- Endpoint đăng ký hiện chỉ tạo `BORROWER`; Backend chưa có endpoint quản trị tạo tài khoản với role tùy chọn. Người dùng mới có thể được đổi role bằng chức năng cập nhật sau khi tạo.
- QR được tạo cục bộ trong trình duyệt từ UUID của thiết bị, không gửi mã tài sản tới dịch vụ QR bên ngoài.
- CORS phải cho phép đúng frontend origin; không tắt kiểm tra CORS trong trình duyệt.

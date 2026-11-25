const ACCESS_KEY = "labequip_access_token";
const REFRESH_KEY = "labequip_refresh_token";
const API_BASE_KEY = "labequip_api_base";

const fieldLabels = {
  asset_tag: "Mã tài sản",
  capacity: "Sức chứa",
  category_id: "Danh mục",
  course_code: "Mã môn học",
  course_name: "Tên môn học",
  description: "Mô tả",
  details: "Danh sách thiết bị",
  device_id: "Thiết bị",
  due_at: "Thời gian dự kiến trả",
  email: "Email",
  ends_at: "Thời gian kết thúc",
  full_name: "Họ và tên",
  instructor_id: "Giảng viên",
  is_active: "Trạng thái hoạt động",
  name: "Tên",
  password: "Mật khẩu",
  quantity: "Số lượng",
  quantity_total: "Tổng số lượng",
  reason: "Lý do",
  room_id: "Phòng thực hành",
  starts_at: "Thời gian bắt đầu",
  student_or_staff_id: "Mã sinh viên/giảng viên",
};

const apiErrorMessages = new Map([
  ["Email hoặc mật khẩu không chính xác", "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra và thử lại."],
  ["Email is already registered", "Email này đã được đăng ký. Vui lòng sử dụng email khác."],
  ["Could not validate credentials", "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại."],
  ["Insufficient permissions", "Bạn không có quyền thực hiện thao tác này."],
  ["Invalid or expired refresh token", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."],
  ["Account is unavailable", "Tài khoản không còn hoạt động. Vui lòng liên hệ quản trị viên."],
  ["Schedule overlaps another active schedule in this room", "Lịch học bị trùng với một lịch khác trong cùng phòng. Vui lòng chọn thời gian hoặc phòng khác."],
  ["Schedule timestamps must include a timezone", "Ngày giờ lịch học không hợp lệ. Vui lòng chọn lại thời gian."],
  ["Loan timestamps must include a timezone", "Ngày giờ mượn hoặc trả không hợp lệ. Vui lòng chọn lại thời gian."],
  ["Datetime values must include a timezone", "Ngày giờ không hợp lệ. Vui lòng chọn lại thời gian."],
  ["ends_at must be later than starts_at", "Thời gian kết thúc phải sau thời gian bắt đầu."],
  ["due_at must be later than starts_at", "Thời gian dự kiến trả phải sau thời gian bắt đầu."],
  ["starts_at must be in the future", "Thời gian bắt đầu phải ở tương lai."],
  ["Each device may appear only once", "Mỗi thiết bị chỉ được thêm một lần vào yêu cầu."],
  ["A reason is required when the request is outside class schedule", "Vui lòng nhập lý do khi mượn ngoài lịch học."],
  ["Inventory changed while processing; retry the request", "Số lượng thiết bị vừa thay đổi. Vui lòng tải lại trang và thử lại."],
  ["Only pending requests can be approved", "Chỉ yêu cầu đang chờ duyệt mới có thể được duyệt."],
  ["Insufficient inventory to approve this request", "Số lượng thiết bị hiện không đủ để duyệt yêu cầu này."],
  ["A rejection reason is required", "Vui lòng nhập lý do từ chối."],
  ["Only pending requests can be rejected", "Chỉ yêu cầu đang chờ duyệt mới có thể bị từ chối."],
  ["A reserved device is no longer available for handover", "Thiết bị đã đặt trước không còn sẵn sàng để bàn giao."],
  ["Only approved requests can be checked out", "Chỉ yêu cầu đã duyệt mới có thể xác nhận bàn giao."],
  ["Only checked-out or overdue requests can be returned", "Chỉ phiếu đang mượn hoặc quá hạn mới có thể xác nhận trả."],
  ["A device linked to this request no longer exists", "Không tìm thấy thiết bị trong yêu cầu này."],
  ["Return would exceed total inventory", "Số lượng trả vượt quá tổng số thiết bị trong kho."],
  ["This request can no longer be cancelled", "Yêu cầu này không còn có thể hủy."],
  ["Inventory changed while cancelling the request", "Số lượng thiết bị vừa thay đổi nên chưa thể hủy yêu cầu. Vui lòng tải lại trang."],
  ["A technician must accept the report first", "Kỹ thuật viên cần tiếp nhận báo cáo trước khi cập nhật."],
  ["Invalid maintenance status transition", "Trạng thái bảo trì không hợp lệ. Vui lòng tải lại trang và thử lại."],
  ["Maintenance record is assigned to another technician", "Phiếu bảo trì này đã được giao cho kỹ thuật viên khác."],
  ["Successful inspection is required before completion", "Cần xác nhận thiết bị đã kiểm tra đạt trước khi hoàn tất bảo trì."],
  ["Maintained device no longer exists", "Không tìm thấy thiết bị đang được bảo trì."],
  ["Retired devices cannot enter maintenance", "Thiết bị đã ngừng sử dụng không thể tạo phiếu bảo trì."],
  ["Device already has an active maintenance record", "Thiết bị đã có một phiếu bảo trì chưa hoàn tất."],
  ["Category is referenced by devices", "Không thể xóa danh mục vì vẫn còn thiết bị đang sử dụng danh mục này."],
  ["Total quantity cannot be lower than borrowed or reserved quantity", "Tổng số lượng không thể thấp hơn số thiết bị đang được mượn hoặc đặt trước."],
  ["Cannot retire a device with borrowed or reserved units", "Không thể ngừng sử dụng thiết bị đang được mượn hoặc đặt trước."],
  ["Cannot retire a device during maintenance", "Không thể ngừng sử dụng thiết bị đang được bảo trì."],
  ["Cannot retire a device with active maintenance", "Không thể ngừng sử dụng thiết bị khi còn phiếu bảo trì chưa hoàn tất."],
  ["Path key must match payload key", "Khóa cấu hình trên đường dẫn phải trùng với khóa trong dữ liệu."],
  ["Password must be at most 72 UTF-8 bytes", "Mật khẩu không được dài quá 72 byte."],
]);

const resourceLabels = {
  "Active room": "phòng thực hành đang hoạt động",
  Category: "danh mục",
  Device: "thiết bị",
  Instructor: "giảng viên",
  "Loan request": "phiếu mượn",
  "Maintenance record": "phiếu bảo trì",
  Notification: "thông báo",
  Room: "phòng thực hành",
  Schedule: "lịch học",
  Setting: "cấu hình",
  User: "người dùng",
};

function translateApiDetail(detail) {
  if (apiErrorMessages.has(detail)) return apiErrorMessages.get(detail);

  let match = detail.match(/^(.+) cannot be null$/);
  if (match) return `${fieldLabels[match[1]] || "Trường dữ liệu"} không được để trống.`;

  match = detail.match(/^Device (.+) is not available for lending$/);
  if (match) return `Thiết bị "${match[1]}" hiện không thể cho mượn.`;

  match = detail.match(/^Insufficient available quantity for (.+)$/);
  if (match) return `Số lượng thiết bị "${match[1]}" còn trong kho không đủ.`;

  match = detail.match(/^Device .+ not found$/);
  if (match) return "Không tìm thấy thiết bị được yêu cầu.";

  match = detail.match(/^(.+) not found$/);
  if (match) return resourceLabels[match[1]] ? `Không tìm thấy ${resourceLabels[match[1]]}.` : "Không tìm thấy dữ liệu được yêu cầu.";

  return /[À-ỹĐđ]/.test(detail) ? detail : null;
}

function translateValidationMessage(message) {
  const raw = message.replace(/^Value error,\s*/, "");
  const translated = translateApiDetail(raw);
  if (translated) return translated;

  let match = raw.match(/^String should have at least (\d+) characters?$/);
  if (match) return `cần có ít nhất ${match[1]} ký tự.`;
  match = raw.match(/^String should have at most (\d+) characters?$/);
  if (match) return `không được vượt quá ${match[1]} ký tự.`;
  match = raw.match(/^Input should be greater than or equal to (.+)$/);
  if (match) return `phải lớn hơn hoặc bằng ${match[1]}.`;
  match = raw.match(/^Input should be less than or equal to (.+)$/);
  if (match) return `phải nhỏ hơn hoặc bằng ${match[1]}.`;

  if (raw === "Field required") return "không được để trống.";
  if (raw === "Input should be a valid email address") return "phải là địa chỉ email hợp lệ.";
  if (raw === "Input should be a valid datetime") return "phải là ngày giờ hợp lệ.";
  if (raw === "Input should be a valid integer") return "phải là số nguyên hợp lệ.";
  if (raw === "Input should be a valid number") return "phải là số hợp lệ.";
  if (raw === "Input should be a valid boolean") return "phải là giá trị Có hoặc Không.";
  if (raw.startsWith("Input should be")) return "có giá trị không hợp lệ.";
  if (raw.startsWith("Value error")) return "có giá trị không hợp lệ.";
  return "có giá trị không hợp lệ.";
}

function validationErrorMessage(errors) {
  return errors.map((item) => {
    const location = (item.loc || []).filter((part) =>
      typeof part === "string" && !["body", "query", "path", "header", "cookie", "__root__"].includes(part),
    );
    const field = fieldLabels[location[location.length - 1]] || (location.length ? "Dữ liệu" : "");
    const message = translateValidationMessage(String(item.msg || ""));
    return field && !message.startsWith(`${field} `) ? `${field} ${message}` : message;
  }).join(" · ");
}

function fallbackErrorMessage(status) {
  if (status === 400) return "Yêu cầu chưa hợp lệ. Vui lòng kiểm tra thông tin đã nhập.";
  if (status === 401) return "Email hoặc mật khẩu không chính xác, hoặc phiên đăng nhập đã hết hạn.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy dữ liệu được yêu cầu.";
  if (status === 409) return "Dữ liệu vừa thay đổi hoặc không phù hợp với trạng thái hiện tại. Vui lòng kiểm tra và thử lại.";
  if (status === 422) return "Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra các trường và thử lại.";
  if (status >= 500) return "Máy chủ gặp sự cố. Vui lòng thử lại sau.";
  return `Không thể hoàn tất yêu cầu (mã lỗi ${status}).`;
}

async function responseErrorMessage(response) {
  let body;
  try { body = await response.json(); } catch { /* The server may not return JSON. */ }

  if (Array.isArray(body?.detail) && body.detail.length) {
    return validationErrorMessage(body.detail) || fallbackErrorMessage(response.status);
  }
  if (typeof body?.detail === "string") {
    return translateApiDetail(body.detail) || fallbackErrorMessage(response.status);
  }
  return fallbackErrorMessage(response.status);
}

export function getApiBase() {
  return (localStorage.getItem(API_BASE_KEY) || "http://localhost:8000/api/v1").replace(/\/+$/, "");
}

export function getAccessToken() { return sessionStorage.getItem(ACCESS_KEY); }
export function saveTokens(tokens) {
  sessionStorage.setItem(ACCESS_KEY, tokens.access_token);
  sessionStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}
export function clearTokens() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

async function request(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response;
  try {
    response = await fetch(`${getApiBase()}${path}`, { ...options, headers });
  } catch {
    throw new Error("Không thể kết nối máy chủ. Kiểm tra Backend và cấu hình CORS.");
  }
  if (response.status === 401 && retry && sessionStorage.getItem(REFRESH_KEY)) {
    const form = new URLSearchParams({ refresh_token: sessionStorage.getItem(REFRESH_KEY) });
    let refreshed;
    try {
      refreshed = await fetch(`${getApiBase()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
    } catch {
      throw new Error("Không thể kết nối máy chủ. Kiểm tra Backend và cấu hình CORS.");
    }
    if (refreshed.ok) {
      saveTokens(await refreshed.json());
      return request(path, options, false);
    }
    clearTokens();
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }
  if (response.status === 204) return null;
  return (response.headers.get("content-type") || "").includes("application/json") ? response.json() : null;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
  login: async (email, password) => {
    const form = new URLSearchParams({ username: email, password });
    let response;
    try {
      response = await fetch(`${getApiBase()}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
    } catch {
      throw new Error("Không thể kết nối máy chủ. Kiểm tra Backend và cấu hình CORS.");
    }
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }
    saveTokens(await response.json());
    return api.get("/auth/me");
  },
  logout: clearTokens,
};

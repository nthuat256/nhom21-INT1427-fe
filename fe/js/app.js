import { api, getAccessToken } from "./api.js";
import { icon } from "./icons.js";
import { createQrSvg } from "./utils/qr.js";

const root = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const state = { user: null, route: "dashboard", page: 1, q: "", status: "", menuOpen: false, lastRows: [] };

const titles = {
  dashboard: "Tổng quan", rooms: "Phòng thực hành", schedules: "Lịch học",
  devices: "Thiết bị", loans: "Phiếu mượn", "request-loan": "Đăng ký mượn",
  maintenance: "Bảo trì thiết bị", notifications: "Thông báo", users: "Người dùng",
  categories: "Danh mục thiết bị", settings: "Cài đặt",
};
const icons = {
  dashboard: "dashboard", rooms: "building", schedules: "calendar", devices: "package", loans: "exchange",
  "request-loan": "plus", maintenance: "wrench", notifications: "bell", users: "users",
  categories: "layers", settings: "settings",
};
const navByRole = {
  BORROWER: ["dashboard", "rooms", "schedules", "devices", "request-loan", "loans", "notifications"],
  ADMIN: ["dashboard", "users", "rooms", "categories", "devices", "schedules", "loans", "maintenance", "notifications", "settings"],
  TECHNICIAN: ["dashboard", "maintenance", "notifications"],
};
const entityConfig = {
  rooms: {
    endpoint: "/rooms", title: "Phòng thực hành", search: true,
    columns: [["code", "Mã phòng"], ["name", "Tên phòng"], ["location", "Vị trí"], ["capacity", "Sức chứa"], ["is_active", "Trạng thái"]],
    fields: [
      ["code", "Mã phòng", "text", true], ["name", "Tên phòng", "text", true],
      ["location", "Vị trí", "text"], ["capacity", "Sức chứa", "number", true],
    ],
  },
  categories: {
    endpoint: "/categories", title: "Danh mục thiết bị", search: true,
    columns: [["name", "Tên danh mục"], ["description", "Mô tả"], ["created_at", "Ngày tạo"]],
    fields: [["name", "Tên danh mục", "text", true], ["description", "Mô tả", "textarea"]],
  },
  devices: {
    endpoint: "/devices", title: "Thiết bị", search: true, filter: "status",
    columns: [["asset_tag", "Mã tài sản"], ["name", "Thiết bị"], ["category_id", "Danh mục"], ["room_id", "Phòng"], ["quantity_available", "Có thể mượn"], ["status", "Trạng thái"]],
    fields: [
      ["asset_tag", "Mã tài sản", "text", true], ["name", "Tên thiết bị", "text", true],
      ["description", "Mô tả", "textarea"], ["category_id", "Danh mục", "select:categories", true],
      ["room_id", "Phòng lưu trữ", "select:rooms"], ["quantity_total", "Tổng số lượng", "number", true],
    ],
  },
  schedules: {
    endpoint: "/schedules", title: "Lịch học", search: false,
    columns: [["course_code", "Mã môn"], ["course_name", "Tên môn"], ["room_id", "Phòng"], ["starts_at", "Bắt đầu"], ["ends_at", "Kết thúc"], ["is_active", "Trạng thái"]],
    fields: [
      ["course_code", "Mã môn học", "text", true], ["course_name", "Tên môn học", "text", true],
      ["room_id", "Phòng", "select:rooms", true], ["instructor_id", "Giảng viên (ID)", "text"],
      ["starts_at", "Bắt đầu", "datetime-local", true], ["ends_at", "Kết thúc", "datetime-local", true],
    ],
  },
  users: {
    endpoint: "/users", title: "Người dùng", search: true,
    columns: [["full_name", "Họ tên"], ["email", "Email"], ["student_or_staff_id", "Mã SV/GV"], ["role", "Vai trò"], ["is_active", "Trạng thái"]],
    fields: [
      ["full_name", "Họ tên", "text", true], ["student_or_staff_id", "Mã SV/GV", "text"],
      ["role", "Vai trò", "select:roles", true], ["is_active", "Tài khoản hoạt động", "checkbox"],
    ],
  },
};

const roleVi = {
  ADMIN: "Nhà trường · Quản trị",
  BORROWER: "Người dùng · Sinh viên / Giảng viên",
  TECHNICIAN: "Người vận hành · Kỹ thuật viên",
};
const statusVi = {
  PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối", CHECKED_OUT: "Đang mượn",
  RETURNED: "Đã trả", OVERDUE: "Quá hạn", CANCELLED: "Đã hủy", AVAILABLE: "Sẵn sàng",
  MAINTENANCE: "Đang bảo trì", RETIRED: "Ngừng sử dụng", REPORTED: "Mới báo hỏng",
  ACCEPTED: "Đã tiếp nhận", IN_PROGRESS: "Đang sửa chữa", COMPLETED: "Hoàn thành",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}
function userErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return /[À-ỹĐđ]/.test(message) ? message : "Đã xảy ra lỗi. Vui lòng kiểm tra thông tin và thử lại.";
}
function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }).format(date);
}
function shortId(value) { return value ? `${value.slice(0, 8)}…` : "—"; }
function statusBadge(value) {
  const status = String(value || "").toLowerCase();
  return `<span class="status status-${esc(status)}">${esc(statusVi[value] || value || "—")}</span>`;
}
function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast${error ? " error" : ""}`;
  item.textContent = message;
  toastRoot.append(item);
  setTimeout(() => item.remove(), 4200);
}
function showLogin(error = "") {
  const demoAccounts = [
    ["BORROWER", "Người dùng", "Trần Văn Bình · Sinh viên", "tran.van.binh@university.edu", "LabEquip123!"],
    ["ADMIN", "Nhà trường", "Nguyễn Thị Lan · Cán bộ nhà trường", "nguyen.thi.lan@university.edu", "LabEquip123!"],
    ["TECHNICIAN", "Người vận hành", "Lê Quốc Huy · Kỹ thuật viên thiết bị", "le.quoc.huy@university.edu", "LabEquip123!"],
  ];
  root.innerHTML = `
    <section class="login-screen">
      <div class="login-art">
        <div class="login-art-main">
          <div class="brand"><span class="brand-mark">${icon("flask")}</span><span>LabEquip</span></div>
          <div><div class="eyebrow" style="color:#d6e4ff">LABORATORY OPERATIONS</div>
            <h1>Thiết bị tốt.<br>Thực hành tốt.</h1>
            <p>Quản lý mượn, trả và bảo trì thiết bị phòng thực hành .</p></div>
        </div>
      </div>
      <div class="login-panel">
        <form class="login-card" id="login-form">
          <h2>Đăng nhập</h2>
          ${error ? `<div class="login-note" style="color:#b42318;background:#fff2f0">${esc(error)}</div>` : ""}
          <div class="field"><label for="login-email">Email tài khoản</label><input id="login-email" name="email" type="email" autocomplete="username" required placeholder="ten@university.edu"></div>
          <div class="field"><label for="login-password">Mật khẩu</label><input id="login-password" name="password" type="password" autocomplete="current-password" required></div>
          <button class="btn btn-primary btn-block" type="submit">Đăng nhập ${icon("arrowRight")}</button>
          <button class="btn btn-outline btn-block" style="margin-top:9px" type="button" data-action="show-register">Tạo tài khoản người dùng</button>
          <div class="quick-login">
            <div class="quick-login-heading">Tài Khoản sử dụng nhanh</div>
            <div class="quick-login-grid">${demoAccounts.map(([role, label, description, email, password]) => `
              <button class="quick-login-option" type="button" data-action="fill-demo-login" data-email="${email}" data-password="${password}" aria-label="Điền tài khoản mẫu vai trò ${label}">
                <span class="quick-login-label">${label}</span>
                <span class="quick-login-description">${description}</span>
                <span class="quick-login-role">${role}</span>
              </button>`).join("")}</div>
          </div>
        </form>
      </div>
    </section>`;
}

function showRegister() {
  root.innerHTML = `
    <section class="login-screen">
      <div class="login-art">
        <div class="login-art-main">
          <div class="brand"><span class="brand-mark">${icon("flask")}</span><span>LabEquip</span></div>
          <div><div class="eyebrow" style="color:#d6e4ff">LABORATORY OPERATIONS</div>
            <h1>Tạo tài khoản<br>người dùng.</h1>
            <p>Đăng ký để tra cứu thiết bị và gửi yêu cầu mượn tại phòng thực hành.</p></div>
        </div>
        <div class="login-art-foot">Tài khoản đăng ký mới được cấp quyền Người dùng.</div>
      </div>
      <div class="login-panel">
        <form class="login-card" id="register-form">
          <div class="eyebrow">ĐĂNG KÝ TÀI KHOẢN</div><h2>Tạo tài khoản</h2>
          <div class="field"><label for="register-name">Họ và tên</label><input id="register-name" name="full_name" autocomplete="name" required minlength="2" maxlength="160"></div>
          <div class="field"><label for="register-email">Email</label><input id="register-email" name="email" type="email" autocomplete="email" required placeholder="ten@university.edu"></div>
          <div class="field"><label for="register-id">Mã sinh viên / giảng viên (không bắt buộc)</label><input id="register-id" name="student_or_staff_id" maxlength="64"></div>
          <div class="field"><label for="register-password">Mật khẩu (ít nhất 10 ký tự)</label><input id="register-password" name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="72"></div>
          <div class="field"><label for="register-password-confirm">Nhập lại mật khẩu</label><input id="register-password-confirm" name="password_confirm" type="password" autocomplete="new-password" required minlength="10" maxlength="72"></div>
          <button class="btn btn-primary btn-block" type="submit">Tạo tài khoản</button>
          <button class="btn btn-outline btn-block" style="margin-top:9px" type="button" data-action="show-login">Quay lại đăng nhập</button>
        </form>
      </div>
    </section>`;
}

function allowed(route) { return (navByRole[state.user?.role] || []).includes(route); }
async function signIn(email, password) {
  state.user = await api.login(email, password);
  state.route = "dashboard";
  location.hash = "#dashboard";
  await loadRoute();
}
function renderShell() {
  const nav = navByRole[state.user.role] || [];
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar ${state.menuOpen ? "open" : ""}" id="sidebar">
        <a class="brand" href="#dashboard"><span class="brand-mark">${icon("flask")}</span><span>LabEquip</span></a>
        <div class="nav-caption">Không gian làm việc</div>
        <nav class="nav-list">${nav.map((route) => `<a class="nav-link ${route === state.route ? "active" : ""}" href="#${route}"><span class="nav-icon">${icon(icons[route])}</span>${titles[route]}</a>`).join("")}</nav>
        <div class="sidebar-bottom">
          <button class="btn btn-outline btn-block" data-action="logout">Đăng xuất</button>
          <div class="profile-mini"><span class="avatar">${esc((state.user.full_name || "?").slice(0, 1).toUpperCase())}</span><div style="min-width:0"><div class="profile-name">${esc(state.user.full_name)}</div><div class="profile-role">${esc(roleVi[state.user.role] || state.user.role)}</div></div></div>
        </div>
      </aside>
      <button class="mobile-overlay ${state.menuOpen ? "show" : ""}" data-action="close-menu" aria-label="Đóng menu"></button>
      <section class="main-area">
        <header class="topbar"><div class="topbar-left"><button class="icon-btn mobile-menu" data-action="toggle-menu" aria-label="Mở menu">${icon("menu")}</button><div class="top-title">${esc(titles[state.route] || "LabEquip")}</div><span class="top-date">${new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(new Date())}</span></div>
          <div class="topbar-actions"><button class="icon-btn" data-route="notifications" aria-label="Thông báo">${icon("bell")}<span class="dot hidden" id="notice-dot"></span></button><span class="avatar">${esc((state.user.full_name || "?").slice(0, 1).toUpperCase())}</span></div>
        </header>
        <main class="content" id="page-content"></main>
      </section>
    </div>`;
}

function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">LABEQUIP / ${esc(roleVi[state.user.role] || state.user.role)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function loadingBlock() { return `<div class="loading-state"><div class="spinner"></div>Đang tải dữ liệu từ máy chủ…</div>`; }
function emptyBlock(text) { return `<div class="empty-state"><div class="state-icon">${icon("search")}</div>${esc(text)}</div>`; }
function errorBlock(message) { return `<div class="error-state"><div class="state-icon">${icon("alert")}</div>${esc(message)}<div style="margin-top:14px"><button class="btn btn-outline btn-sm" data-action="reload">Thử lại</button></div></div>`; }

async function loadRoute() {
  state.route = location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard";
  if (!state.user) return showLogin();
  if (!allowed(state.route)) {
    state.route = "dashboard";
    location.hash = "#dashboard";
    return;
  }
  state.menuOpen = false;
  state.page = 1;
  state.q = "";
  state.status = "";
  renderShell();
  await renderPage();
}

async function renderPage() {
  const container = document.querySelector("#page-content");
  if (!container) return;
  container.innerHTML = loadingBlock();
  try {
    if (state.route === "dashboard") return await renderDashboard(container);
    if (state.route === "notifications") return await renderNotifications(container);
    if (state.route === "request-loan") return await renderRequestLoan(container);
    if (state.route === "maintenance") return await renderMaintenance(container);
    if (state.route === "loans") return await renderLoans(container);
    if (state.route === "settings") return await renderSettings(container);
    if (entityConfig[state.route]) return await renderEntity(container, state.route);
    container.innerHTML = errorBlock("Không tìm thấy trang yêu cầu.");
  } catch (error) {
    container.innerHTML = errorBlock(userErrorMessage(error));
  }
}

async function renderDashboard(container) {
  const role = state.user.role;
  if (role === "TECHNICIAN") {
    const result = await api.get("/maintenance?page=1&page_size=100");
    const items = result.items || [];
    container.innerHTML = heading("Bảng điều khiển", "Theo dõi và xử lý các yêu cầu sửa chữa thiết bị.")
      + `<section class="grid stats-grid">${stat("Cần tiếp nhận", items.filter((x) => x.status === "REPORTED").length, "Yêu cầu mới", "clipboardPlus")}${stat("Đang sửa chữa", items.filter((x) => ["ACCEPTED", "IN_PROGRESS"].includes(x.status)).length, "Đang xử lý", "wrench")}${stat("Hoàn thành", items.filter((x) => x.status === "COMPLETED").length, "Tổng trong trang", "checkCircle")}${stat("Tổng yêu cầu", result.total ?? items.length, "Dữ liệu API", "database")}</section>`
      + `<section class="panel"><div class="panel-head"><div><h2 class="panel-title">Yêu cầu mới nhất</h2><p class="panel-subtitle">Yêu cầu bảo trì gần đây từ máy chủ</p></div><a class="btn btn-outline btn-sm" href="#maintenance">Xem tất cả</a></div>${quickRows(items.slice(0, 5), (x) => `${statusVi[x.status] || x.status} · ${shortId(x.device_id)}`, (x) => x.description)}</section>`;
    return;
  }

  const requests = role === "ADMIN"
    ? [api.get("/devices?page=1&page_size=100"), api.get("/loan-requests?page=1&page_size=100"), api.get("/maintenance?page=1&page_size=100"), api.get("/rooms?page=1&page_size=100"), api.get("/notifications?page=1&page_size=20")]
    : [api.get("/devices?page=1&page_size=100&available_only=true"), api.get("/loan-requests?page=1&page_size=100"), api.get("/notifications?page=1&page_size=20"), api.get("/schedules?page=1&page_size=100")];
  const values = await Promise.all(requests);
  const devices = values[0].items || [];
  const loans = values[1].items || [];
  const notices = role === "ADMIN" ? values[4].items || [] : values[2].items || [];
  const overdue = loans.filter((x) => x.status === "OVERDUE").length;
  const pending = loans.filter((x) => x.status === "PENDING").length;
  const availableCount = devices.reduce((total, x) => total + Number(x.quantity_available || 0), 0);
  const cards = role === "ADMIN"
    ? [stat("Tổng thiết bị", values[0].total ?? devices.length, "Theo dữ liệu API", "package"), stat("Chờ duyệt", pending, "Yêu cầu mượn", "clock"), stat("Đang mượn", loans.filter((x) => x.status === "CHECKED_OUT").length, "Chưa quá hạn", "exchange"), stat("Quá hạn", overdue, overdue ? "Cần xử lý ngay" : "Không có phiếu quá hạn", "alert", overdue > 0)]
    : [stat("Thiết bị sẵn sàng", availableCount, "Tồn khả dụng trong trang", "package"), stat("Phiếu mượn", values[1].total ?? loans.length, "Tài khoản của bạn", "exchange"), stat("Đang mượn", loans.filter((x) => ["CHECKED_OUT", "OVERDUE"].includes(x.status)).length, "Thiết bị cần hoàn trả", "clock"), stat("Quá hạn", overdue, overdue ? "Vui lòng liên hệ quản trị" : "Không có phiếu quá hạn", "alert", overdue > 0)];
  const distribution = [
    ["Chờ duyệt", loans.filter((x) => x.status === "PENDING").length],
    ["Đã duyệt", loans.filter((x) => x.status === "APPROVED").length],
    ["Từ chối", loans.filter((x) => x.status === "REJECTED").length],
    ["Đang mượn", loans.filter((x) => x.status === "CHECKED_OUT").length],
    ["Đã trả", loans.filter((x) => x.status === "RETURNED").length],
    ["Quá hạn", overdue],
    ["Đã hủy", loans.filter((x) => x.status === "CANCELLED").length],
  ];
  const max = Math.max(1, ...distribution.map((x) => x[1]));
  container.innerHTML = heading("Bảng điều khiển", role === "ADMIN" ? "Tổng quan hoạt động mượn trả và tài sản phòng thực hành." : "Chào mừng bạn trở lại. Theo dõi các thiết bị và phiếu mượn của mình.")
    + `<section class="grid stats-grid">${cards.join("")}</section>
      <section class="grid dashboard-grid">
        <div class="chart-panel"><div class="panel-head"><div><h2 class="panel-title">Tình trạng phiếu mượn</h2><p class="panel-subtitle">So sánh số phiếu ở tất cả trạng thái</p></div><a href="#loans" class="btn btn-outline btn-sm">Danh sách phiếu</a></div>
          <div class="chart">${distribution.map(([label, count]) => `<div class="bar-col"><span class="bar-value">${count}</span><div class="bar" style="height:${Math.max(3, count / max * 145)}px"></div><span class="bar-label">${label}</span></div>`).join("")}</div>
          <div class="legend">${distribution.map(([label, count]) => `<span><i></i>${label}: ${count}</span>`).join("")}</div>
        </div>
        <div class="panel"><div class="panel-head"><div><h2 class="panel-title">Hoạt động gần đây</h2><p class="panel-subtitle">Các phiếu mượn mới nhất</p></div></div>
        ${loans.length ? quickRows(loans.slice(0, 5), (x) => `${statusVi[x.status] || x.status} · ${shortId(x.id)}`, (x) => `Hạn trả ${fmtDate(x.due_at)}`) : emptyBlock("Chưa có phiếu mượn nào.")}
        ${role === "BORROWER" ? `<a class="btn btn-primary btn-block" style="margin-top:12px" href="#request-loan">${icon("plus")} Tạo yêu cầu mượn</a>` : ""}</div>
      </section>`;
  if (notices.some((x) => !x.is_read)) document.querySelector("#notice-dot")?.classList.remove("hidden");
}

function stat(label, value, foot, iconName, alert = false) {
  return `<article class="stat-card"><div><div class="stat-label">${esc(label)}</div><div class="stat-value" ${alert ? 'style="color:#d92d20"' : ""}>${esc(value)}</div><div class="stat-foot">${esc(foot)}</div></div><div class="stat-icon">${icon(iconName)}</div></article>`;
}
function quickRows(items, titleFn, descFn) {
  if (!items.length) return emptyBlock("Chưa có dữ liệu.");
  return `<div class="quick-list">${items.map((item) => `<div class="quick-row"><span class="quick-bullet">${icon("arrowUpRight")}</span><div class="quick-text"><div class="quick-title">${esc(titleFn(item))}</div><div class="quick-desc">${esc(descFn(item) || "—")}</div></div></div>`).join("")}</div>`;
}

function queryString(params) {
  return new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value !== null && value !== undefined)).toString();
}
async function renderEntity(container, key) {
  const config = entityConfig[key];
  const params = { page: state.page, page_size: 20 };
  if (config.search && state.q) params.q = state.q;
  if (config.filter && state.status) params.status = state.status;
  const result = await api.get(`${config.endpoint}?${queryString(params)}`);
  const items = result.items || [];
  state.lastRows = items;
  const actions = state.user.role === "ADMIN" ? `<button class="btn btn-primary" data-action="create-entity" data-key="${key}">${icon("plus")} Thêm mới</button>` : "";
  const headingActions = key === "devices" && state.user.role === "ADMIN"
    ? `<button class="btn btn-outline" data-action="report-damage">${icon("alert")} Báo hỏng</button>${actions}` : actions;
  const filters = `${config.search ? `<input type="search" data-filter="q" value="${esc(state.q)}" placeholder="Tìm kiếm ${esc(config.title.toLowerCase())}…" aria-label="Tìm kiếm">` : ""}
    ${config.filter ? `<select data-filter="status" aria-label="Lọc trạng thái"><option value="">Tất cả trạng thái</option>${["AVAILABLE", "MAINTENANCE", "RETIRED"].map((x) => `<option value="${x}" ${state.status === x ? "selected" : ""}>${statusVi[x]}</option>`).join("")}</select>` : ""}
    <span class="toolbar-spacer"></span><span class="muted">${esc(result.total ?? items.length)} kết quả</span>`;
  container.innerHTML = heading(config.title, entityDescription(key), headingActions) + `<section class="table-panel"><div class="toolbar">${filters}</div>${tableHTML(key, items)}${paginationHTML(result)}</section>`;
}

function entityDescription(key) {
  return ({
    rooms: "Danh sách phòng thực hành đang được cung cấp bởi hệ thống.",
    categories: "Quản lý nhóm và phân loại thiết bị.",
    devices: "Theo dõi tồn kho, trạng thái và thông tin tài sản.",
    schedules: "Lịch học được dùng để đối chiếu yêu cầu mượn thiết bị.",
    users: "Quản lý tài khoản và quyền truy cập theo vai trò.",
  })[key] || "";
}
function paginationHTML(result) {
  const page = result.page || state.page;
  const pageSize = result.page_size || 20;
  const total = result.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return `<div class="pagination"><span>Trang ${page} / ${pages} · ${total} bản ghi</span><div class="pagination-actions"><button class="btn btn-outline btn-sm" data-action="page" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>${icon("arrowLeft")} Trước</button><button class="btn btn-outline btn-sm" data-action="page" data-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Sau ${icon("arrowRight")}</button></div></div>`;
}
function tableHTML(key, items) {
  if (!items.length) return emptyBlock("Không tìm thấy dữ liệu phù hợp.");
  const columns = key === "loans"
    ? [["id", "Mã phiếu"], ["room_id", "Phòng"], ["starts_at", "Thời gian mượn"], ["due_at", "Hạn trả"], ["details", "Số dòng thiết bị"], ["status", "Trạng thái"]]
    : key === "maintenance"
      ? [["device_id", "Mã thiết bị"], ["description", "Mô tả lỗi"], ["status", "Trạng thái"], ["technician_id", "Kỹ thuật viên"], ["created_at", "Ngày báo"]]
      : entityConfig[key].columns;
  const rows = items.map((item) => `<tr>${columns.map(([field]) => `<td>${cellValue(field, item[field], item)}</td>`).join("")}<td>${rowActions(key, item)}</td></tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${columns.map(([, label]) => `<th>${esc(label)}</th>`).join("")}<th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function cellValue(field, value, item) {
  if (field === "status") return statusBadge(value);
  if (field === "is_active") return value ? statusBadge("AVAILABLE") : statusBadge("RETIRED");
  if (["created_at", "starts_at", "ends_at", "due_at"].includes(field)) return esc(fmtDate(value));
  if (field === "id" || field.endsWith("_id")) return `<span title="${esc(value || "")}">${esc(shortId(value))}</span>`;
  if (field === "details") return esc(Array.isArray(value) ? `${value.length} thiết bị` : "—");
  if (field === "quantity_available") return `<span class="cell-primary">${esc(value ?? 0)}</span><div class="cell-secondary">Tổng ${esc(item.quantity_total ?? "—")}</div>`;
  if (field === "asset_tag" || field === "name" || field === "full_name" || field === "course_name" || field === "action") return `<span class="cell-primary">${esc(value || "—")}</span>`;
  return esc(value || "—");
}

function rowActions(key, item) {
  const id = esc(item.id);
  if (key === "loans") {
    const actions = [`<button class="btn btn-outline btn-sm" data-action="detail" data-key="loan" data-id="${id}">Chi tiết</button>`];
    if (state.user.role === "ADMIN") {
      if (item.status === "PENDING") actions.push(`<button class="btn btn-sm" data-action="loan-transition" data-transition="approve" data-id="${id}">Duyệt</button>`, `<button class="btn btn-danger btn-sm" data-action="loan-transition" data-transition="reject" data-id="${id}">Từ chối</button>`);
      if (item.status === "APPROVED") actions.push(`<button class="btn btn-sm" data-action="loan-transition" data-transition="checkout" data-id="${id}">Bàn giao</button>`);
      if (["CHECKED_OUT", "OVERDUE"].includes(item.status)) actions.push(`<button class="btn btn-primary btn-sm" data-action="loan-transition" data-transition="return" data-id="${id}">Xác nhận trả</button>`);
    } else if (state.user.role === "BORROWER" && ["PENDING", "APPROVED"].includes(item.status)) {
      actions.push(`<button class="btn btn-danger btn-sm" data-action="loan-transition" data-transition="cancel" data-id="${id}">Hủy</button>`);
    }
    return `<div class="row-actions">${actions.join("")}</div>`;
  }
  if (key === "maintenance") return `<div class="row-actions"><button class="btn btn-outline btn-sm" data-action="maintenance-detail" data-id="${id}">Chi tiết</button>${maintenanceAction(item)}</div>`;
  if (key === "devices") {
    const actions = [`<button class="btn btn-outline btn-sm" data-action="detail" data-key="device" data-id="${id}">Chi tiết</button>`];
    if (state.user.role === "ADMIN") actions.push(`<button class="btn btn-outline btn-sm" data-action="edit-entity" data-key="devices" data-id="${id}">Sửa</button>`, `<button class="btn btn-outline btn-sm" data-action="print-label" data-id="${id}">QR / In nhãn</button>`, `<button class="btn btn-danger btn-sm" data-action="retire-device" data-id="${id}">Ngừng dùng</button>`);
    return `<div class="row-actions">${actions.join("")}</div>`;
  }
  if (["rooms", "categories", "schedules", "users"].includes(key) && state.user.role === "ADMIN") {
    const buttons = [`<button class="btn btn-outline btn-sm" data-action="edit-entity" data-key="${key}" data-id="${id}">Sửa</button>`];
    if (["rooms", "categories", "schedules"].includes(key)) buttons.push(`<button class="btn btn-danger btn-sm" data-action="delete-entity" data-key="${key}" data-id="${id}">Ngừng / xóa</button>`);
    return `<div class="row-actions">${buttons.join("")}</div>`;
  }
  return "—";
}
function maintenanceAction(item) {
  if (state.user.role !== "TECHNICIAN") return "";
  if (item.status === "REPORTED") return `<button class="btn btn-primary btn-sm" data-action="maintenance-update" data-state="ACCEPTED" data-id="${esc(item.id)}">Tiếp nhận</button>`;
  if (item.status === "ACCEPTED") return `<button class="btn btn-primary btn-sm" data-action="maintenance-update" data-state="IN_PROGRESS" data-id="${esc(item.id)}">Bắt đầu sửa</button>`;
  if (item.status === "IN_PROGRESS") return `<button class="btn btn-primary btn-sm" data-action="maintenance-update" data-state="complete" data-id="${esc(item.id)}">Cập nhật / hoàn tất</button>`;
  return "";
}

async function renderLoans(container) {
  const params = { page: state.page, page_size: 20, status: state.status };
  const result = await api.get(`/loan-requests?${queryString(params)}`);
  state.lastRows = result.items || [];
  const statuses = ["PENDING", "APPROVED", "REJECTED", "CHECKED_OUT", "RETURNED", "OVERDUE", "CANCELLED"];
  const filters = `<select data-filter="status" aria-label="Lọc trạng thái"><option value="">Tất cả trạng thái</option>${statuses.map((x) => `<option value="${x}" ${state.status === x ? "selected" : ""}>${statusVi[x]}</option>`).join("")}</select><span class="toolbar-spacer"></span><span class="muted">${esc(result.total ?? 0)} phiếu</span>`;
  const add = state.user.role === "BORROWER" ? `<a class="btn btn-primary" href="#request-loan">${icon("plus")} Đăng ký mượn</a>` : "";
  container.innerHTML = heading("Phiếu mượn", "Theo dõi trạng thái và lịch sử bàn giao – hoàn trả thiết bị.", add)
    + `<section class="table-panel"><div class="toolbar">${filters}</div>${tableHTML("loans", result.items || [])}${paginationHTML(result)}</section>`;
}

async function renderMaintenance(container) {
  const result = await api.get(`/maintenance?${queryString({ page: state.page, page_size: 20, status: state.status })}`);
  state.lastRows = result.items || [];
  const filters = `<select data-filter="status"><option value="">Tất cả trạng thái</option>${["REPORTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"].map((x) => `<option value="${x}" ${state.status === x ? "selected" : ""}>${statusVi[x]}</option>`).join("")}</select><span class="toolbar-spacer"></span><span class="muted">${esc(result.total ?? 0)} yêu cầu</span>`;
  const add = state.user.role === "ADMIN" ? `<button class="btn btn-primary" data-action="report-damage">${icon("plus")} Báo thiết bị hỏng</button>` : "";
  container.innerHTML = heading("Bảo trì thiết bị", "Ghi nhận sự cố và theo dõi toàn bộ quy trình sửa chữa.", add)
    + `<section class="table-panel"><div class="toolbar">${filters}</div>${tableHTML("maintenance", result.items || [])}${paginationHTML(result)}</section>`;
}

async function renderNotifications(container) {
  const result = await api.get(`/notifications?page=1&page_size=100`);
  const items = result.items || [];
  const unread = items.filter((item) => !item.is_read);
  document.querySelector("#notice-dot")?.classList.toggle("hidden", unread.length === 0);
  container.innerHTML = heading("Thông báo", "Cập nhật về yêu cầu mượn, trả thiết bị và bảo trì.")
    + (items.length ? `<section class="notice-list">${items.map((item) => `<article class="notice ${item.is_read ? "" : "unread"}"><span class="quick-bullet">${icon("bell")}</span><div class="notice-main"><div class="notice-title">${esc(item.title)}</div><div class="notice-message">${esc(item.message)}</div><div class="notice-time">${fmtDate(item.created_at)}</div></div>${item.is_read ? "" : `<button class="btn btn-outline btn-sm" data-action="mark-read" data-id="${esc(item.id)}">Đã đọc</button>`}</article>`).join("")}</section>` : emptyBlock("Bạn chưa có thông báo nào."));
}

async function renderRequestLoan(container) {
  const [rooms, devices] = await Promise.all([
    api.get("/rooms?page=1&page_size=100&active=true"),
    api.get("/devices?page=1&page_size=100&available_only=true"),
  ]);
  const roomOptions = (rooms.items || []).map((x) => `<option value="${esc(x.id)}">${esc(x.code)} — ${esc(x.name)}</option>`).join("");
  const deviceOptions = (devices.items || []).map((x) => `<option value="${esc(x.id)}">${esc(x.asset_tag)} — ${esc(x.name)} (còn ${esc(x.quantity_available)})</option>`).join("");
  container.innerHTML = heading("Đăng ký mượn thiết bị", "Chọn phòng, thời gian sử dụng và thiết bị cần mượn.")
    + `<section class="panel" style="max-width:780px"><form id="loan-create-form">
      ${rooms.items?.length ? "" : `<div class="login-note">Chưa có phòng hoạt động. Liên hệ quản trị viên.</div>`}
      <div class="field"><label for="loan-room">Phòng thực hành</label><select id="loan-room" name="room_id" required><option value="">Chọn phòng</option>${roomOptions}</select></div>
      <div class="details-grid">${dateTimeControl("starts_at", "Thời gian bắt đầu")}${dateTimeControl("due_at", "Thời gian dự kiến trả")}</div>
      <div class="panel-head"><div><h3 class="panel-title">Thiết bị yêu cầu</h3><p class="panel-subtitle">Tồn kho được kiểm tra lại bởi backend khi gửi.</p></div><button class="btn btn-outline btn-sm" type="button" data-action="add-loan-line">${icon("plus")} Thêm dòng</button></div>
      <div id="loan-lines">${loanLine(deviceOptions, 0)}</div>
      <div class="field"><label for="loan-reason">Lý do (bắt buộc nếu ngoài lịch học)</label><textarea id="loan-reason" name="reason" maxlength="2000" placeholder="Mô tả mục đích sử dụng nếu yêu cầu ngoài lịch…"></textarea></div>
      <button class="btn btn-primary" type="submit">Gửi yêu cầu mượn</button>
    </form></section>`;
}
function loanLine(options, index) {
  return `<div class="details-grid loan-line" style="align-items:end"><div class="field"><label for="loan-device-${index}">Thiết bị ${index + 1}</label><select id="loan-device-${index}" name="device_id" required><option value="">Chọn thiết bị</option>${options}</select></div><div class="field"><label for="loan-quantity-${index}">Số lượng</label><input id="loan-quantity-${index}" name="quantity" type="number" min="1" value="1" required></div></div>`;
}

async function renderSettings(container) {
  const result = await api.get("/settings");
  const items = result.items || [];
  const rows = items.map((item) => `<tr><td><span class="cell-primary">${esc(item.key)}</span></td><td>${esc(JSON.stringify(item.value))}</td><td>${esc(item.description || "—")}</td><td><button class="btn btn-outline btn-sm" data-action="edit-setting" data-key="${esc(item.key)}">Sửa</button><button class="btn btn-danger btn-sm" data-action="delete-setting" data-key="${esc(item.key)}">Xóa</button></td></tr>`).join("");
  container.innerHTML = heading("Cài đặt", "Quản lý cấu hình JSON do backend lưu trữ.", `<button class="btn btn-primary" data-action="create-setting">${icon("plus")} Thêm cấu hình</button>`)
    + `<section class="table-panel"><div class="table-wrap"><table><thead><tr><th>Khóa</th><th>Giá trị JSON</th><th>Mô tả</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>${items.length ? "" : emptyBlock("Chưa có cấu hình.")}</section>`;
}

function fieldControl([name, label, type, required], value = "", options = []) {
  const req = required ? "required" : "";
  const safe = esc(value ?? "");
  if (type === "checkbox") return `<div class="field"><label class="field-check"><input type="checkbox" name="${esc(name)}" ${value ? "checked" : ""}>${esc(label)}</label></div>`;
  if (type.startsWith("select:")) {
    const opts = options.map(([key, text]) => `<option value="${esc(key)}" ${String(value) === String(key) ? "selected" : ""}>${esc(text)}</option>`).join("");
    return `<div class="field"><label for="field-${esc(name)}">${esc(label)}</label><select id="field-${esc(name)}" name="${esc(name)}" ${req}><option value="">Chọn ${esc(label.toLowerCase())}</option>${opts}</select></div>`;
  }
  if (type === "datetime-local") return dateTimeControl(name, label, value, req);
  const inputType = type === "textarea" ? "textarea" : "input";
  const input = inputType === "textarea"
    ? `<textarea id="field-${esc(name)}" name="${esc(name)}" ${req}>${safe}</textarea>`
    : `<input id="field-${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${safe}" ${req} ${type === "number" ? 'min="1"' : ""}>`;
  return `<div class="field"><label for="field-${esc(name)}">${esc(label)}</label>${input}</div>`;
}

function dateTimeControl(name, label, value = "", required = "required") {
  const date = new Date(value);
  const hasValue = value && !Number.isNaN(date.getTime());
  const pad = (part) => String(part).padStart(2, "0");
  const dateValue = hasValue ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : "";
  const timeValue = hasValue ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
  return `<div class="field"><label>${esc(label)}</label><div class="date-time-fields">
    <input type="date" name="${esc(name)}_date" value="${dateValue}" ${required} aria-label="${esc(label)} - ngày">
    <input type="text" name="${esc(name)}_time" value="${timeValue}" ${required} inputmode="numeric" placeholder="HH:MM" pattern="(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]" maxlength="5" aria-label="${esc(label)} - giờ 24 giờ">
  </div><span class="field-hint">Nhập giờ theo định dạng 24 giờ (HH:MM).</span></div>`;
}

async function optionsFor(type) {
  if (type === "rooms") {
    const result = await api.get("/rooms?page=1&page_size=100");
    return (result.items || []).filter((x) => x.is_active).map((x) => [x.id, `${x.code} — ${x.name}`]);
  }
  if (type === "categories") {
    const result = await api.get("/categories?page=1&page_size=100");
    return (result.items || []).map((x) => [x.id, x.name]);
  }
  if (type === "roles") return ["BORROWER", "ADMIN", "TECHNICIAN"].map((x) => [x, roleVi[x]]);
  return [];
}

async function openEntityForm(key, record = null) {
  const config = entityConfig[key];
  if (key === "users" && !record) {
    const body = `<form id="entity-form" data-key="users"><div class="field"><label for="new-user-name">Họ tên</label><input id="new-user-name" name="full_name" required minlength="2" maxlength="160"></div><div class="field"><label for="new-user-email">Email</label><input id="new-user-email" name="email" type="email" required></div><div class="field"><label for="new-user-code">Mã SV/GV</label><input id="new-user-code" name="student_or_staff_id" maxlength="64"></div><div class="field"><label for="new-user-password">Mật khẩu tạm thời</label><input id="new-user-password" name="password" type="password" required minlength="10" maxlength="72" autocomplete="new-password"></div><p class="muted">Backend tạo tài khoản mới với vai trò BORROWER. Admin có thể đổi vai trò sau khi tạo.</p></form>`;
    showModal("Tạo tài khoản", body, `<button class="btn btn-outline" data-action="close-modal">Hủy</button><button class="btn btn-primary" type="submit" form="entity-form">Tạo tài khoản</button>`);
    return;
  }
  const fields = [];
  for (const field of config.fields) fields.push(fieldControl(field, record?.[field[0]], await optionsFor(field[2].split(":")[1])));
  showModal(record ? `Cập nhật ${config.title.toLowerCase()}` : `Thêm ${config.title.toLowerCase()}`,
    `<form id="entity-form" data-key="${key}" data-id="${esc(record?.id || "")}">${fields.join("")}</form>`,
    `<button class="btn btn-outline" data-action="close-modal">Hủy</button><button class="btn btn-primary" type="submit" form="entity-form">Lưu thay đổi</button>`);
}

function showModal(title, body, footer = `<button class="btn btn-outline" data-action="close-modal">Đóng</button>`) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Đóng">${icon("close")}</button></header><div class="modal-body">${body}</div><footer class="modal-foot">${footer}</footer></section></div>`;
}
function closeModal() { modalRoot.innerHTML = ""; }

function detailBody(record, exclude = []) {
  return `<div class="details-grid">${Object.entries(record).filter(([key]) => !exclude.includes(key) && key !== "details").map(([key, value]) => `<div class="detail-item"><div class="detail-label">${esc(key.replaceAll("_", " "))}</div><div class="detail-value">${key === "status" ? statusBadge(value) : esc(value && typeof value === "object" ? JSON.stringify(value) : (key.endsWith("_at") ? fmtDate(value) : (value ?? "—")))}</div></div>`).join("")}</div>`;
}
async function openDetail(kind, id) {
  const record = await api.get(kind === "loan" ? `/loan-requests/${encodeURIComponent(id)}` : `/devices/${encodeURIComponent(id)}`);
  if (kind === "loan") {
    const lines = record.details || await api.get(`/loan-requests/${encodeURIComponent(id)}/details`);
    const body = detailBody(record, ["matched_schedule_id", "reviewed_by", "details"])
      + `<h3 class="panel-title" style="margin:22px 0 12px">Thiết bị trong phiếu</h3>`
      + (lines.length ? `<div class="table-wrap"><table><thead><tr><th>Mã thiết bị</th><th>Số lượng</th><th>Đã trả</th></tr></thead><tbody>${lines.map((line) => `<tr><td>${esc(shortId(line.device_id))}</td><td>${esc(line.quantity)}</td><td>${esc(line.quantity_returned)}</td></tr>`).join("")}</tbody></table></div>` : emptyBlock("Phiếu chưa có dòng thiết bị."));
    showModal("Chi tiết phiếu mượn", body);
  } else showModal("Chi tiết thiết bị", detailBody(record));
}

async function openMaintenanceDetail(id) {
  const [record, history] = await Promise.all([
    api.get(`/maintenance/${encodeURIComponent(id)}`),
    api.get(`/maintenance/${encodeURIComponent(id)}/history`),
  ]);
  const timeline = history.length ? `<div class="timeline">${history.map((item) => `<div class="timeline-item"><strong>${esc(statusVi[item.status] || item.status)}</strong><div class="muted" style="margin-top:5px">${esc(item.note || "Không có ghi chú")} · ${fmtDate(item.created_at)}</div></div>`).join("")}</div>` : emptyBlock("Chưa có cập nhật tiến độ.");
  showModal("Hồ sơ bảo trì", detailBody(record, ["id"]) + `<h3 class="panel-title" style="margin-top:20px">Lịch sử bảo trì</h3>${timeline}`);
}

async function reportDamageForm() {
  const result = await api.get("/devices?page=1&page_size=100");
  const options = (result.items || []).filter((x) => !["RETIRED", "MAINTENANCE"].includes(x.status)).map((x) => [x.id, `${x.asset_tag} — ${x.name}`]);
  showModal("Báo thiết bị hỏng", `<form id="maintenance-report-form">${fieldControl(["device_id", "Thiết bị", "select:device", true], "", options)}${fieldControl(["description", "Mô tả lỗi", "textarea", true])}</form>`,
    `<button class="btn btn-outline" data-action="close-modal">Hủy</button><button class="btn btn-primary" type="submit" form="maintenance-report-form">Gửi báo cáo</button>`);
}

function settingForm(record = null) {
  const key = record?.key || "";
  const value = JSON.stringify(record?.value || {}, null, 2);
  const body = `<form id="setting-form" data-key="${esc(key)}"><div class="field"><label for="setting-key">Khóa</label><input id="setting-key" name="key" value="${esc(key)}" ${record ? "readonly" : ""} required maxlength="120"></div><div class="field"><label for="setting-value">Giá trị (JSON object)</label><textarea id="setting-value" name="value" required>${esc(value)}</textarea></div><div class="field"><label for="setting-description">Mô tả</label><textarea id="setting-description" name="description">${esc(record?.description || "")}</textarea></div></form>`;
  showModal(record ? "Sửa cấu hình" : "Thêm cấu hình", body, `<button class="btn btn-outline" data-action="close-modal">Hủy</button><button class="btn btn-primary" type="submit" form="setting-form">Lưu</button>`);
}

function printLabel(record) {
  const qr = createQrSvg(record.id);
  showModal("QR định danh thiết bị", `<div class="printable-label"><div><div class="eyebrow">LABEQUIP · THIẾT BỊ PHÒNG THỰC HÀNH</div><div class="tag">${esc(record.asset_tag)}</div><strong>${esc(record.name)}</strong><div class="id">ID: ${esc(record.id)}</div></div><div class="qr">${qr}</div></div><p class="muted" style="margin:14px 0 0">QR được tạo trong trình duyệt và chứa mã định danh thiết bị.</p>`,
    `<button class="btn btn-outline" data-action="close-modal">Đóng</button><button class="btn btn-primary" data-action="print-current">In nhãn</button>`);
}

async function updateMaintenance(id, target) {
  if (target === "complete") {
    const body = `<form id="maintenance-update-form" data-id="${esc(id)}"><input type="hidden" name="status" value="COMPLETED"><div class="field"><label for="repair-note">Ghi chú tiến độ / kết quả sửa chữa</label><textarea id="repair-note" name="progress_note" required minlength="3"></textarea></div><div class="field"><label class="field-check"><input name="inspection_passed" type="checkbox" required> Đã kiểm tra, thiết bị hoạt động tốt</label></div></form>`;
    showModal("Hoàn tất bảo trì", body, `<button class="btn btn-outline" data-action="close-modal">Hủy</button><button class="btn btn-primary" type="submit" form="maintenance-update-form">Xác nhận hoàn tất</button>`);
    return;
  }
  const note = target === "ACCEPTED" ? "Đã tiếp nhận yêu cầu bảo trì." : "Bắt đầu sửa chữa.";
  await api.patch(`/maintenance/${encodeURIComponent(id)}`, { status: target, progress_note: note });
  toast(target === "ACCEPTED" ? "Đã tiếp nhận yêu cầu." : "Đã chuyển sang đang sửa chữa.");
  await renderPage();
}

async function performLoanTransition(id, transition) {
  if (transition === "reject") {
    const body = `<form id="loan-decision-form" data-id="${esc(id)}"><div class="field"><label>Lý do từ chối (bắt buộc)</label><textarea name="reason" required minlength="3" maxlength="2000"></textarea></div></form>`;
    showModal("Từ chối yêu cầu mượn", body, `<button class="btn btn-outline" data-action="close-modal">Quay lại</button><button class="btn btn-danger" type="submit" form="loan-decision-form">Từ chối yêu cầu</button>`);
    return;
  }
  const labels = { approve: "duyệt yêu cầu", checkout: "xác nhận bàn giao", return: "xác nhận đã nhận trả", cancel: "hủy phiếu mượn" };
  if (!window.confirm(`Bạn có chắc muốn ${labels[transition]} này?`)) return;
  await api.post(`/loan-requests/${encodeURIComponent(id)}/${transition}`, {});
  toast(`Đã ${labels[transition]}.`);
  await renderPage();
}

function printDeviceAction(id) {
  const record = state.lastRows.find((item) => item.id === id);
  if (record) printLabel(record);
}

function formValues(form) {
  const data = {};
  const dateTimeParts = {};
  for (const [key, value] of new FormData(form).entries()) {
    const dateTimeMatch = key.match(/^(starts_at|ends_at|due_at)_(date|time)$/);
    if (dateTimeMatch) {
      dateTimeParts[dateTimeMatch[1]] = dateTimeParts[dateTimeMatch[1]] || {};
      dateTimeParts[dateTimeMatch[1]][dateTimeMatch[2]] = value;
    } else if (key === "starts_at" || key === "ends_at") data[key] = new Date(value).toISOString();
    else if (key === "quantity" || key === "capacity" || key === "quantity_total") data[key] = Number(value);
    else if (value !== "") data[key] = value;
  }
  for (const [key, parts] of Object.entries(dateTimeParts)) {
    if (parts.date && parts.time) data[key] = new Date(`${parts.date}T${parts.time}`).toISOString();
  }
  for (const checkbox of form.querySelectorAll('input[type="checkbox"]')) data[checkbox.name] = checkbox.checked;
  return data;
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    if (form.id === "login-form") {
      const data = new FormData(form);
      await signIn(data.get("email"), data.get("password"));
      return;
    }
    if (form.id === "register-form") {
      const data = new FormData(form);
      const password = data.get("password");
      if (password !== data.get("password_confirm")) throw new Error("Mật khẩu nhập lại không khớp.");
      const account = {
        full_name: data.get("full_name"),
        email: data.get("email"),
        password,
        student_or_staff_id: data.get("student_or_staff_id") || null,
      };
      await api.post("/auth/register", account);
      toast("Tạo tài khoản thành công. Đang đăng nhập...");
      await signIn(account.email, account.password);
      return;
    }
    if (form.id === "entity-form") {
      const key = form.dataset.key;
      const id = form.dataset.id;
      const payload = formValues(form);
      const cfg = entityConfig[key];
      if (key === "schedules" && new Date(payload.ends_at) <= new Date(payload.starts_at)) {
        throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
      }
      if (key === "users" && !id) {
        await api.post("/auth/register", payload);
        closeModal(); toast("Đã tạo tài khoản BORROWER."); await renderPage(); return;
      }
      for (const [name, , type, required] of cfg.fields) {
        if (!required && type !== "checkbox" && form.elements[name]?.value === "") payload[name] = null;
      }
      if (key === "rooms" && !id) payload.is_active = true;
      if (id) await api.patch(`${cfg.endpoint}/${encodeURIComponent(id)}`, payload);
      else await api.post(cfg.endpoint, payload);
      closeModal(); toast("Đã lưu thay đổi."); await renderPage(); return;
    }
    if (form.id === "loan-create-form") {
      const base = formValues(form);
      const startsAt = new Date(base.starts_at);
      const dueAt = new Date(base.due_at);
      if (startsAt <= new Date()) throw new Error("Thời gian bắt đầu phải ở tương lai.");
      if (dueAt <= startsAt) throw new Error("Thời gian dự kiến trả phải sau thời gian bắt đầu.");
      const rows = [...form.querySelectorAll(".loan-line")].map((row) => ({
        device_id: row.querySelector('[name="device_id"]').value,
        quantity: Number(row.querySelector('[name="quantity"]').value),
      }));
      const reason = form.elements.reason.value.trim();
      await api.post("/loan-requests", {
        room_id: base.room_id,
        starts_at: new Date(base.starts_at).toISOString(),
        due_at: new Date(base.due_at).toISOString(),
        reason: reason || null,
        details: rows,
      });
      toast("Đã gửi yêu cầu mượn."); location.hash = "#loans"; return;
    }
    if (form.id === "maintenance-report-form") {
      await api.post("/maintenance", formValues(form));
      closeModal(); toast("Đã ghi nhận báo hỏng và thông báo kỹ thuật viên."); await renderPage(); return;
    }
    if (form.id === "maintenance-update-form") {
      const body = formValues(form);
      body.inspection_passed = form.elements.inspection_passed.checked;
      await api.patch(`/maintenance/${encodeURIComponent(form.dataset.id)}`, body);
      closeModal(); toast("Đã hoàn tất cập nhật bảo trì."); await renderPage(); return;
    }
    if (form.id === "loan-decision-form") {
      await api.post(`/loan-requests/${encodeURIComponent(form.dataset.id)}/reject`, { reason: form.elements.reason.value.trim() });
      closeModal(); toast("Đã từ chối yêu cầu mượn."); await renderPage(); return;
    }
    if (form.id === "setting-form") {
      const payload = formValues(form);
      let value;
      try { value = JSON.parse(form.elements.value.value); } catch { throw new Error("Giá trị cấu hình phải là JSON hợp lệ."); }
      if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Giá trị cấu hình phải là JSON object.");
      const key = payload.key;
      const body = { key, value, description: payload.description || null };
      if (form.dataset.key) await api.put(`/settings/${encodeURIComponent(key)}`, body);
      else await api.put(`/settings/${encodeURIComponent(key)}`, body);
      closeModal(); toast("Đã lưu cấu hình."); await renderPage(); return;
    }
  } catch (error) {
    toast(userErrorMessage(error), true);
  } finally {
    if (submit?.isConnected) submit.disabled = false;
  }
}

async function handleAction(button) {
  const { action, id, key } = button.dataset;
  try {
    if (action === "show-register") { showRegister(); return; }
    if (action === "show-login") { showLogin(); return; }
    if (action === "fill-demo-login") {
      document.querySelector("#login-email").value = button.dataset.email;
      document.querySelector("#login-password").value = button.dataset.password;
      document.querySelector("#login-email").focus();
      return;
    }
    if (action === "logout") { api.logout(); state.user = null; showLogin(); return; }
    if (action === "toggle-menu") {
      state.menuOpen = !state.menuOpen;
      document.querySelector("#sidebar")?.classList.toggle("open", state.menuOpen);
      document.querySelector(".mobile-overlay")?.classList.toggle("show", state.menuOpen);
      return;
    }
    if (action === "close-menu") { state.menuOpen = false; document.querySelector("#sidebar")?.classList.remove("open"); document.querySelector(".mobile-overlay")?.classList.remove("show"); return; }
    if (action === "close-modal") { closeModal(); return; }
    if (action === "reload") { await renderPage(); return; }
    if (action === "page") { state.page = Number(button.dataset.page); await renderPage(); return; }
    if (action === "create-entity") { await openEntityForm(key); return; }
    if (action === "edit-entity") { const record = state.lastRows.find((x) => x.id === id); await openEntityForm(key, record); return; }
    if (action === "detail") { await openDetail(button.dataset.key, id); return; }
    if (action === "maintenance-detail") { await openMaintenanceDetail(id); return; }
    if (action === "report-damage") { await reportDamageForm(); return; }
    if (action === "loan-transition") { await performLoanTransition(id, button.dataset.transition); return; }
    if (action === "maintenance-update") { await updateMaintenance(id, button.dataset.state); return; }
    if (action === "add-loan-line") {
      const firstSelect = document.querySelector("#loan-lines select");
      const options = firstSelect?.innerHTML || '<option value="">Chọn thiết bị</option>';
      const index = document.querySelectorAll("#loan-lines .loan-line").length;
      document.querySelector("#loan-lines")?.insertAdjacentHTML("beforeend", loanLine(options, index));
      return;
    }
    if (action === "mark-read") { await api.post(`/notifications/${encodeURIComponent(id)}/read`, {}); toast("Đã đánh dấu đã đọc."); await renderPage(); return; }
    if (action === "delete-entity") {
      const message = key === "categories" ? "Xóa danh mục này? Danh mục đang có thiết bị sẽ bị backend từ chối." : "Ngừng kích hoạt bản ghi này?";
      if (!window.confirm(message)) return;
      await api.delete(`${entityConfig[key].endpoint}/${encodeURIComponent(id)}`);
      toast("Đã cập nhật dữ liệu."); await renderPage(); return;
    }
    if (action === "retire-device") {
      if (!window.confirm("Ngừng sử dụng thiết bị này? Backend chỉ cho phép nếu không còn hàng đang mượn hoặc bảo trì.")) return;
      await api.delete(`/devices/${encodeURIComponent(id)}`); toast("Đã ngừng sử dụng thiết bị."); await renderPage(); return;
    }
    if (action === "print-label") { printDeviceAction(id); return; }
    if (action === "print-current") { window.print(); return; }
    if (action === "create-setting") { settingForm(); return; }
    if (action === "edit-setting") {
      const result = await api.get("/settings");
      const record = (result.items || []).find((x) => x.key === button.dataset.key);
      if (!record) throw new Error("Không tìm thấy cấu hình.");
      settingForm(record); return;
    }
    if (action === "delete-setting") {
      if (!window.confirm(`Xóa cấu hình "${button.dataset.key}"?`)) return;
      await api.delete(`/settings/${encodeURIComponent(button.dataset.key)}`); toast("Đã xóa cấu hình."); await renderPage(); return;
    }
  } catch (error) { toast(userErrorMessage(error), true); }
}

async function handleFilter(element) {
  if (element.dataset.filter === "q") {
    state.q = element.value.trim();
    state.page = 1;
    await renderPage();
  } else if (element.dataset.filter === "status") {
    state.status = element.value;
    state.page = 1;
    await renderPage();
  }
}

function localizedValidationMessage(control) {
  const label = (control.labels?.[0]?.textContent || control.getAttribute("aria-label") || "Trường này").trim().replace(/\s*\([^)]*\)\s*$/, "");
  const validity = control.validity;
  if (validity.valueMissing) {
    if (control.type === "checkbox") return `Vui lòng xác nhận ${label.toLowerCase()}.`;
    if (control.tagName === "SELECT") return `Vui lòng chọn ${label.toLowerCase()}.`;
    return `Vui lòng nhập ${label.toLowerCase()}.`;
  }
  if (validity.typeMismatch && control.type === "email") return "Vui lòng nhập địa chỉ email hợp lệ.";
  if (validity.tooShort) return `${label} cần có ít nhất ${control.minLength} ký tự.`;
  if (validity.tooLong) return `${label} không được vượt quá ${control.maxLength} ký tự.`;
  if (validity.rangeUnderflow) return `${label} phải lớn hơn hoặc bằng ${control.min}.`;
  if (validity.rangeOverflow) return `${label} phải nhỏ hơn hoặc bằng ${control.max}.`;
  if (validity.stepMismatch) return `Vui lòng chọn giá trị hợp lệ cho ${label.toLowerCase()}.`;
  if (validity.patternMismatch && control.name.endsWith("_time")) return "Nhập giờ theo định dạng 24 giờ HH:MM, ví dụ 14:30.";
  if (validity.badInput || validity.patternMismatch) return `${label} chưa hợp lệ.`;
  return `${label} chưa hợp lệ.`;
}

function handleInvalid(event) {
  const control = event.target;
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
    control.setCustomValidity(localizedValidationMessage(control));
  }
}
function clearCustomValidity(event) {
  const control = event.target;
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
    control.setCustomValidity("");
  }
}

root.addEventListener("submit", handleSubmit);
modalRoot.addEventListener("submit", handleSubmit);
for (const container of [root, modalRoot]) {
  container.addEventListener("invalid", handleInvalid, true);
  container.addEventListener("input", clearCustomValidity, true);
  container.addEventListener("change", clearCustomValidity, true);
}
root.addEventListener("click", async (event) => {
  const routeLink = event.target.closest("[data-route]");
  if (routeLink) { location.hash = `#${routeLink.dataset.route}`; return; }
  const button = event.target.closest("[data-action]");
  if (button) await handleAction(button);
});
modalRoot.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (button) await handleAction(button);
  if (event.target.classList.contains("modal-backdrop")) closeModal();
});
root.addEventListener("change", (event) => {
  if (event.target.matches("[data-filter]")) handleFilter(event.target);
});
root.addEventListener("keydown", (event) => {
  if (event.target.matches('[data-filter="q"]') && event.key === "Enter") handleFilter(event.target);
});
window.addEventListener("hashchange", loadRoute);
window.addEventListener("auth:expired", () => { state.user = null; showLogin("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."); });

async function boot() {
  if (!getAccessToken()) return showLogin();
  try {
    state.user = await api.get("/auth/me");
    await loadRoute();
  } catch (error) {
    api.logout();
    showLogin(userErrorMessage(error));
  }
}
boot();

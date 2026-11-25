const ACCESS_KEY = "labequip_access_token";
const REFRESH_KEY = "labequip_refresh_token";
const API_BASE_KEY = "labequip_api_base";

export function getApiBase() {
  return (localStorage.getItem(API_BASE_KEY) || "http://localhost:8000/api/v1").replace(/\/+$/, "");
}

export function setApiBase(value) {
  const clean = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+(?:\/.*)?$/i.test(clean)) {
    throw new Error("Địa chỉ API phải là URL http(s) hợp lệ.");
  }
  localStorage.setItem(API_BASE_KEY, clean);
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
    throw new Error(`Không thể kết nối API (${getApiBase()}). Kiểm tra Backend và CORS.`);
  }
  if (response.status === 401 && retry && sessionStorage.getItem(REFRESH_KEY)) {
    const form = new URLSearchParams({ refresh_token: sessionStorage.getItem(REFRESH_KEY) });
    const refreshed = await fetch(`${getApiBase()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (refreshed.ok) {
      saveTokens(await refreshed.json());
      return request(path, options, false);
    }
    clearTokens();
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
  if (!response.ok) {
    let message = `API trả về lỗi ${response.status}`;
    try {
      const { detail } = await response.json();
      message = Array.isArray(detail)
        ? detail.map((item) => `${item.loc?.slice(-1)[0] || "Dữ liệu"}: ${item.msg}`).join(" · ")
        : (typeof detail === "string" ? detail : message);
    } catch { /* Response may have no JSON body. */ }
    throw new Error(message);
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
      throw new Error(`Không thể kết nối API (${getApiBase()}). Kiểm tra Backend và CORS.`);
    }
    if (!response.ok) {
      let detail = "Đăng nhập thất bại.";
      try { detail = (await response.json()).detail || detail; } catch { /* Keep explicit generic error. */ }
      throw new Error(detail);
    }
    saveTokens(await response.json());
    return api.get("/auth/me");
  },
  oidc: async (idToken, nonce) => {
    const tokens = await request("/auth/oidc", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken, nonce }),
    }, false);
    saveTokens(tokens);
    return api.get("/auth/me");
  },
  logout: clearTokens,
};

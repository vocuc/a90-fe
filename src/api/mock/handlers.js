import * as db from './data';
import { tokenStorage, UNAUTHORIZED_EVENT } from '../tokenStorage';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

const paginate = (items, page = 1, limit = 20) => ({
  items: items.slice((page - 1) * limit, page * limit),
  total: items.length,
  page,
  lastPage: Math.max(1, Math.ceil(items.length / limit)),
  limit,
});

const httpError = (status, message) => Object.assign(new Error(message), { status });

// ---- Kho tài khoản giả lập (lưu localStorage để tài khoản đăng ký còn sau khi F5) ----
const USERS_KEY = 'ai90_mock_users';
const WELCOME_CREDITS = 0; // backend tạo ví với số dư 0

const registeredUsers = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    // dữ liệu hỏng hoặc localStorage bị chặn -> chỉ còn tài khoản demo
    return [];
  }
})();

const saveRegisteredUser = (user) => {
  registeredUsers.push(user);
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(registeredUsers));
  } catch {
    // bỏ qua: tài khoản chỉ tồn tại tới khi tải lại trang
  }
};

const allUsers = () => [{ ...db.me, password: db.demoAccount.password }, ...registeredUsers];

const tokenFor = (user) => `mock-token-${user.id}`;
const publicUser = ({ password, ...user }) => user;
const normalizeEmail = (email) => email?.trim().toLowerCase() ?? '';

const requireUser = () => {
  const token = tokenStorage.get();
  const user = token && allUsers().find((u) => tokenFor(u) === token);
  if (!user) {
    // giống interceptor của axios: token sai/hết hạn -> báo cho AuthProvider đăng xuất
    if (token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw httpError(401, 'Phiên đăng nhập đã hết hạn.');
  }
  return user;
};

export const mock = {
  async login({ email, password }) {
    await delay(600);
    const user = allUsers().find((u) => u.email === normalizeEmail(email));
    if (!user || user.password !== password) {
      throw httpError(401, 'Email hoặc mật khẩu không đúng.');
    }
    return { token: tokenFor(user), user: publicUser(user) };
  },
  async register({ name, email, password }) {
    await delay(800);
    const normalized = normalizeEmail(email);
    if (allUsers().some((u) => u.email === normalized)) {
      throw httpError(409, 'Email này đã được đăng ký.');
    }
    const user = {
      id: `u_${Date.now()}`,
      name: name.trim(),
      email: normalized,
      avatarUrl: null,
      credits: WELCOME_CREDITS,
      password,
    };
    saveRegisteredUser(user);
    return { token: tokenFor(user), user: publicUser(user) };
  },
  // Giả lập Google: luôn là một tài khoản Google cố định, lần đầu thì tạo mới
  async googleLogin() {
    await delay(600);
    const email = 'google.demo@gmail.com';
    let user = allUsers().find((u) => u.email === email);
    if (!user) {
      user = { id: 'u_google', name: 'Người dùng Google', email, avatarUrl: null, credits: WELCOME_CREDITS };
      saveRegisteredUser(user);
    }
    return { token: tokenFor(user), user: publicUser(user) };
  },
  async logout() {
    await delay(200);
    return { success: true };
  },
  async getMe() {
    await delay();
    return publicUser(requireUser());
  },
  async getUnreadCount() {
    await delay(200);
    const user = requireUser();
    return { count: user.id === db.me.id ? db.unreadNotifications : 0 };
  },
  async getBanners() {
    await delay();
    return [];
  },

  async getCategories() {
    await delay();
    return db.categories;
  },
  // Lọc/sắp xếp giống MarketplaceController@creatives của backend
  async getCreatives({ q, category, sort = 'newest', page = 1, limit = 20 } = {}) {
    await delay();
    // Phần tử sau trong mảng coi như đăng sau
    let items = [...db.creatives].reverse();
    if (category) items = items.filter((c) => c.category.slug === category);
    if (q) {
      const kw = q.toLowerCase();
      items = items.filter((c) => c.title.toLowerCase().includes(kw));
    }
    if (sort === 'popular') items.sort((a, b) => b.usageCount - a.usageCount);
    if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
    return paginate(items, page, limit);
  },
  async getCreative(id) {
    await delay();
    const found = db.creatives.find((c) => c.id === id);
    if (!found) throw Object.assign(new Error('Không tìm thấy AI Creative'), { status: 404 });
    return found;
  },
};

const ONE_YEAR = 60 * 60 * 24 * 365;

export function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const found = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
}

export function setCookie(name, value, maxAge = ONE_YEAR) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

// Đọc object JSON đã lưu, chỉ nhận các khoá có trong defaults và cùng kiểu dữ liệu
export function readJsonCookie(name, defaults) {
  try {
    const saved = JSON.parse(getCookie(name) ?? '{}');
    return Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [k, typeof saved?.[k] === typeof v ? saved[k] : v]),
    );
  } catch {
    return defaults;
  }
}

export const writeJsonCookie = (name, value) => setCookie(name, JSON.stringify(value));

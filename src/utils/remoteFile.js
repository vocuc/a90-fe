// Khi dev, ảnh trên disk local đi qua proxy /media của Vite (cùng origin, chữ ký là tương đối nên vẫn hợp lệ)
export const toFetchUrl = (url) => {
  const u = new URL(url, window.location.href);
  return import.meta.env.DEV && u.pathname.startsWith('/media/') ? u.pathname + u.search : url;
};


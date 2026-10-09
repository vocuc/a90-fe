import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_NAME = 'A51';
const DEFAULT_TITLE = 'A51 - Tạo hình ảnh chuyên nghiệp bằng AI';
const DEFAULT_DESCRIPTION =
  'A51 giúp biến ảnh sản phẩm thành ảnh quảng cáo chuyên nghiệp bằng AI. Khám phá hàng trăm mẫu AI Creative từ các nhà sáng tạo, tạo ảnh chỉ trong vài giây.';
// URL gốc dùng cho canonical / og:url; không cấu hình thì lấy origin hiện tại
const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
const DEFAULT_IMAGE = import.meta.env.VITE_SEO_IMAGE || '/image/default-banner.png';

const absUrl = (url) => {
  if (!url) return '';
  try {
    return new URL(url, SITE_URL).href;
  } catch {
    return '';
  }
};

// Tạo/cập nhật thẻ trong <head>; content rỗng thì gỡ thẻ
const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setCanonical = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const setJsonLd = (data) => {
  let el = document.head.querySelector('script[data-seo="jsonld"]');
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.seo = 'jsonld';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
};

const apply = ({ title, description, image, type, noindex, path, jsonLd }) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const desc = (description || DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').trim().slice(0, 160);
  const url = absUrl(path);
  const img = absUrl(image || DEFAULT_IMAGE);

  document.title = fullTitle;
  setMeta('name', 'description', desc);
  setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
  setCanonical(url);

  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:locale', 'vi_VN');
  setMeta('property', 'og:type', type || 'website');
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', img);

  setMeta('name', 'twitter:card', img ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', img);

  setJsonLd(jsonLd);
};

/**
 * Đặt title + meta SEO cho trang hiện tại, trả về mặc định khi rời trang.
 * canonical: đường dẫn chuẩn (mặc định là pathname, bỏ query để tránh trùng lặp nội dung)
 */
export default function useSeo({ title, description, image, type, noindex = false, canonical, jsonLd } = {}) {
  const { pathname } = useLocation();
  const path = canonical ?? pathname;
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    apply({ title, description, image, type, noindex, path, jsonLd });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, image, type, noindex, path, jsonLdKey]);

  useEffect(() => () => apply({ path: window.location.pathname }), []);
}

export { absUrl as seoAbsUrl };

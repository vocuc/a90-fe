import { useState } from 'react';

// Ảnh mặc định khi Creative chưa có ảnh đại diện (đăng bán không bắt buộc ảnh) hoặc link ký số đã hết hạn
export const DEFAULT_COVER = '/image/default-creative.svg';

export default function CoverImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  const url = !src || failed ? DEFAULT_COVER : src;

  return <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

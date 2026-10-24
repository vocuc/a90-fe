import { useState } from 'react';

export default function Avatar({ src, name = '', className = 'size-6' }) {
  // Link ảnh có thể hết hạn (vd. avatar TikTok là link CDN có ký hạn) -> lỗi tải thì hiện chữ cái đầu
  const [failedSrc, setFailedSrc] = useState(null);

  if (!src || failedSrc === src) {
    return (
      <div
        className={`${className} rounded-full bg-surface-container text-primary flex items-center justify-center text-[10px] font-bold`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      className={`${className} rounded-full object-cover`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
}

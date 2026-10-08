import { useState } from 'react';
import Icon from './Icon';

// Ảnh bìa Creative; Creative chưa có ảnh hoặc link ký số đã hết hạn -> hiện khung trống
export default function CoverImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-container text-outline ${className}`}>
        <Icon name="image" className="text-4xl" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

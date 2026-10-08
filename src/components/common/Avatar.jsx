export default function Avatar({ src, name = '', className = 'size-6' }) {
  if (!src) {
    return (
      <div
        className={`${className} rounded-full bg-surface-container text-primary flex items-center justify-center text-[10px] font-bold`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return <img src={src} alt={name} className={`${className} rounded-full object-cover`} loading="lazy" />;
}

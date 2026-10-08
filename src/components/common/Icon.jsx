export default function Icon({ name, fill = false, className = '' }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${fill ? 'icon-fill' : ''} ${className}`}>
      {name}
    </span>
  );
}

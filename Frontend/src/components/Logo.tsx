export function Logo({ size = 'large' }: { size?: 'large' | 'small' }) {
  return (
    <span className={`logo logo--${size}`}>
      <img className="logo__img" src="/Logo.png" alt="YoUSAC" />
    </span>
  );
}

export function Logo({ size = 'large' }: { size?: 'large' | 'small' }) {
  return (
    <span className={`logo logo--${size}`}>
      Yo
      <svg className="logo__heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-6.7-4.35-9.33-8.11C.9 10.28 1.64 6.5 4.72 5.05 6.9 4 9.6 4.8 12 7.2c2.4-2.4 5.1-3.2 7.28-2.15 3.08 1.45 3.82 5.23 2.05 7.84C18.7 16.65 12 21 12 21z" />
      </svg>
      USAC
    </span>
  );
}

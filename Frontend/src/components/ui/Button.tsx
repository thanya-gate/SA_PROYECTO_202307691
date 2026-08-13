import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'oauth' | 'danger';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, disabled, children, className, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} ${className ?? ''}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

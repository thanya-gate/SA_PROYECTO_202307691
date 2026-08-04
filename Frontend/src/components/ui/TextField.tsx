import { forwardRef, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, id, className, ...rest },
  ref,
) {
  return (
    <label className={`text-field ${className ?? ''}`} htmlFor={id}>
      <span className="text-field__label">{label}</span>
      <input ref={ref} className="text-field__input" id={id} {...rest} />
    </label>
  );
});

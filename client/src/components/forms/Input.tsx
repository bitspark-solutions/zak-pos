'use client';

import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';
import styles from './Input.module.css';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  rightAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, required, fullWidth = false, id, rightAdornment, ...props }, ref) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;
    const hasError = !!error;

    return (
      <div className={`${styles.inputWrapper} ${fullWidth ? styles.fullWidth : ''}`}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}
        {(() => {
          const { value, defaultValue, onChange, ...restProps } = props;
          const isControlled = value !== undefined;

          return (
            <div className={styles.inputInner}>
              <input
                ref={ref}
                id={inputId}
                className={`${styles.input} ${hasError ? styles.error : ''}`}
                aria-invalid={hasError}
                aria-describedby={hasError ? `${inputId}-error` : undefined}
                value={isControlled ? ((value as string) ?? '') : undefined}
                defaultValue={!isControlled ? defaultValue : undefined}
                onChange={onChange}
                {...restProps}
              />
              {rightAdornment && (
                <div className={styles.adornment}>{rightAdornment}</div>
              )}
            </div>
          );
        })()}
        {error && (
          <span id={`${inputId}-error`} className={styles.errorMessage} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

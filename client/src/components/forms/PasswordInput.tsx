'use client';

import { useState, forwardRef, InputHTMLAttributes } from 'react';
import { Input } from './Input';
import styles from './PasswordInput.module.css';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  showStrengthIndicator?: boolean;
  showRequirements?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, required, fullWidth, showStrengthIndicator = false, showRequirements = false, value, onChange, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

    const calculateStrength = (password: string): 'weak' | 'medium' | 'strong' => {
      if (password.length < 8) return 'weak';

      let strength = 0;
      if (password.length >= 8) strength++;
      if (/[a-z]/.test(password)) strength++;
      if (/[A-Z]/.test(password)) strength++;
      if (/\d/.test(password)) strength++;
      if (/[^a-zA-Z\d]/.test(password)) strength++;

      if (strength <= 2) return 'weak';
      if (strength <= 4) return 'medium';
      return 'strong';
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (showStrengthIndicator && e.target.value) {
        setPasswordStrength(calculateStrength(e.target.value));
      } else if (!e.target.value) {
        setPasswordStrength(null);
      }
      onChange?.(e);
    };

    const requirements = [
      { text: 'At least 8 characters', met: typeof value === 'string' && value.length >= 8 },
      { text: 'One uppercase letter', met: typeof value === 'string' && /[A-Z]/.test(value) },
      { text: 'One lowercase letter', met: typeof value === 'string' && /[a-z]/.test(value) },
      { text: 'One number', met: typeof value === 'string' && /\d/.test(value) },
    ];

    // const allRequirementsMet = requirements.every(req => req.met); // Reserved for future use

    const { defaultValue, ...restProps } = props;
    const inputValue = typeof value === 'string' ? value : '';

    return (
      <div className={styles.passwordWrapper}>
          <Input
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            label={label}
            error={error}
            required={required}
            fullWidth={fullWidth}
            value={inputValue}
            onChange={handleChange}
            rightAdornment={(
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            )}
            {...restProps}
          />

        {showStrengthIndicator && passwordStrength && (
          <div className={styles.strengthIndicator}>
            <div className={styles.strengthBar}>
              <div
                className={`${styles.strengthFill} ${styles[passwordStrength]}`}
                style={{
                  width: passwordStrength === 'weak' ? '33%' : passwordStrength === 'medium' ? '66%' : '100%',
                }}
              />
            </div>
            <span className={styles.strengthText}>
              Strength: <strong className={styles[passwordStrength]}>{passwordStrength}</strong>
            </span>
          </div>
        )}

        {showRequirements && (
          <div className={styles.requirements}>
            <p className={styles.requirementsTitle}>Password requirements:</p>
            <ul className={styles.requirementsList}>
              {requirements.map((req, index) => (
                <li
                  key={index}
                  className={`${styles.requirement} ${req.met ? styles.met : ''}`}
                >
                  {req.met ? '✓' : '○'} {req.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

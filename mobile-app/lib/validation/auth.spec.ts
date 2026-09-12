import {
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
} from './auth';

describe('mobile-app auth validation', () => {
  describe('validateEmail', () => {
    it('should validate valid email addresses', () => {
      expect(validateEmail('test@zakpos.com').isValid).toBe(true);
      expect(validateEmail('user.name@example.co.uk').isValid).toBe(true);
    });

    it('should reject empty or invalid email addresses', () => {
      expect(validateEmail('').isValid).toBe(false);
      expect(validateEmail('notanemail').isValid).toBe(false);
      expect(validateEmail('user@').isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate passwords with 8 or more characters', () => {
      expect(validatePassword('StrongPass123!').isValid).toBe(true);
      expect(validatePassword('12345678').isValid).toBe(true);
    });

    it('should reject passwords shorter than 8 characters or empty', () => {
      expect(validatePassword('').isValid).toBe(false);
      expect(validatePassword('short').isValid).toBe(false);
    });
  });

  describe('validateName', () => {
    it('should validate names with 2 or more characters', () => {
      expect(validateName('Mohsin').isValid).toBe(true);
      expect(validateName('Al').isValid).toBe(true);
    });

    it('should reject names shorter than 2 characters or empty', () => {
      expect(validateName('').isValid).toBe(false);
      expect(validateName('A').isValid).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should allow optional empty phone', () => {
      expect(validatePhone('').isValid).toBe(true);
      expect(validatePhone(undefined).isValid).toBe(true);
    });

    it('should validate valid phone format', () => {
      expect(validatePhone('+1234567890').isValid).toBe(true);
      expect(validatePhone('01712345678').isValid).toBe(true);
    });

    it('should reject invalid phone format', () => {
      expect(validatePhone('abc').isValid).toBe(false);
    });
  });
});

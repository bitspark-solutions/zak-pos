// Type declarations for the custom Jest matchers registered in test/setup.ts
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJWT(): R;
      toBeValidEmail(): R;
    }
  }
}

export {};

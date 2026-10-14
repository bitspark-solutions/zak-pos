/**
 * Fail-fast environment helpers.
 *
 * There are deliberately NO secret fallbacks in this codebase: a missing
 * JWT signing secret or Auth0 session secret is a boot error, never a silent
 * default to a guessable key. Set the values in the environment (compose
 * injects them from server/.env — generate one with scripts/gen-or-copy-env.sh).
 */

/**
 * Read a required environment variable, throwing a clear boot error when it
 * is unset or empty. Called at module-import / DI time, so the process dies
 * before it ever serves traffic with a weak key.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[env] ${name} is required but not set. Refusing to boot with a ` +
        `fallback secret. Copy server/.env.example to server/.env (or run ` +
        `scripts/gen-or-copy-env.sh at the repo root) and set ${name}.`,
    );
  }
  return value;
}

/** The single JWT signing secret shared by staff and customer strategies. */
export function getJwtSecret(): string {
  return requireEnv('JWT_SECRET');
}

/**
 * Auth0 is optional: with AUTH0_DOMAIN/AUTH0_CLIENT_ID unset the app runs
 * local-auth-only. But if the domain+client ARE configured, the session
 * secret must be a real value — no shipped default.
 */
export function getAuth0SessionSecret(): string {
  const auth0Configured = Boolean(
    process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID,
  );
  if (!auth0Configured) {
    // Auth0 disabled: nothing encrypts cookie sessions with this value.
    return process.env.AUTH0_SECRET ?? '';
  }
  if (!process.env.AUTH0_SECRET || process.env.AUTH0_SECRET.trim() === '') {
    throw new Error(
      '[env] AUTH0_DOMAIN and AUTH0_CLIENT_ID are set but AUTH0_SECRET is ' +
        'missing — refusing to boot with a fallback session secret. Set ' +
        'AUTH0_SECRET (a long random string) in server/.env, or unset the ' +
        'AUTH0_* variables to disable Auth0 login.',
    );
  }
  return process.env.AUTH0_SECRET;
}

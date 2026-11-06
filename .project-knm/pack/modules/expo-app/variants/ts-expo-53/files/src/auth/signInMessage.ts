import { ApiError } from '../api/client';

/** What to tell the user: wrong credentials, no connection, or the server's own answer. */
export function signInMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 401) return 'Wrong email or password.';
  if (e instanceof ApiError && e.status > 0) return `Sign-in failed: ${e.message}`;
  return 'Could not sign in. Check your connection and try again.';
}

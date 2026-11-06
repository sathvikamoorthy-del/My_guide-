// Pure rule: where the user must be, given the session state and the current route group. The layout only follows the answer.
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

/** A path to go to, or null to stay. `segments` come from Expo Router's useSegments(). */
export function gateRedirect(status: AuthStatus, segments: readonly string[]): string | null {
  if (status === 'loading') return null;
  const inAuth = segments[0] === '(auth)';
  if (status === 'signedOut' && !inAuth) return '/sign-in';
  if (status === 'signedIn' && inAuth) return '/';
  return null;
}

import { gateRedirect } from '../../files/src/auth/authGate';
describe('auth gate contract', () => {
    it('never redirects while the session is loading', () => {
        expect(gateRedirect('loading', ['(tabs)'])).toBeNull();
        expect(gateRedirect('loading', ['(auth)', 'sign-in'])).toBeNull();
    });
    it('sends a signed-out user to sign-in, from anywhere outside the auth group', () => {
        expect(gateRedirect('signedOut', ['(tabs)'])).toBe('/sign-in');
        expect(gateRedirect('signedOut', [])).toBe('/sign-in');
        expect(gateRedirect('signedOut', ['(auth)', 'sign-in'])).toBeNull();
    });
    it('sends a signed-in user away from the auth group, and leaves the rest alone', () => {
        expect(gateRedirect('signedIn', ['(auth)', 'sign-in'])).toBe('/');
        expect(gateRedirect('signedIn', ['(tabs)', 'settings'])).toBeNull();
    });
});

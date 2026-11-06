import { SignJWT } from 'jose';
import { AuthConfigError, secretKey, signToken, verifyToken } from '../../files/src/auth/jwt';
const SECRET = 'a-test-secret-that-is-long-enough-123456';
describe('jwt contract', () => {
    it('signs and verifies, carrying user, tenant and roles', async () => {
        const t = await signToken({ userId: 'u1', tenantId: 'acme', roles: ['admin'] }, { secret: SECRET });
        const c = await verifyToken(t, { secret: SECRET });
        expect(c).toMatchObject({ userId: 'u1', tenantId: 'acme', roles: ['admin'] });
        expect(typeof c.claims.exp).toBe('number');
    });
    it('refuses a wrong secret, a tampered token and garbage', async () => {
        const t = await signToken({ userId: 'u1' }, { secret: SECRET });
        await expect(verifyToken(t, { secret: SECRET + 'x' })).rejects.toThrow();
        const [h, p, s] = t.split('.');
        const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url');
        await expect(verifyToken(`${h}.${forged}.${s}`, { secret: SECRET })).rejects.toThrow();
        await expect(verifyToken('not-a-token', { secret: SECRET })).rejects.toThrow();
        void p;
    });
    it('refuses an expired token and the "none" algorithm', async () => {
        const expired = await signToken({ userId: 'u1' }, { secret: SECRET, expiresIn: -10 });
        await expect(verifyToken(expired, { secret: SECRET })).rejects.toThrow(/exp/i);
        const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"u1","exp":9999999999}').toString('base64url')}.`;
        await expect(verifyToken(none, { secret: SECRET })).rejects.toThrow();
    });
    it('only HS256 is accepted (another algorithm with the same secret is refused)', async () => {
        const hs512 = await new SignJWT({}).setProtectedHeader({ alg: 'HS512' }).setSubject('u1').setExpirationTime('1h').sign(secretKey(SECRET));
        await expect(verifyToken(hs512, { secret: SECRET })).rejects.toThrow();
    });
    it('enforces issuer and audience when they are given', async () => {
        const t = await signToken({ userId: 'u1' }, { secret: SECRET, issuer: 'knm', audience: 'api' });
        await expect(verifyToken(t, { secret: SECRET, issuer: 'knm', audience: 'api' })).resolves.toMatchObject({ userId: 'u1' });
        await expect(verifyToken(t, { secret: SECRET, issuer: 'other' })).rejects.toThrow();
        await expect(verifyToken(t, { secret: SECRET, audience: 'web' })).rejects.toThrow();
    });
    it('a token needs a user; a missing, short or env-less secret is a configuration error', async () => {
        await expect(signToken({ userId: '' }, { secret: SECRET })).rejects.toThrow(/userId/);
        expect(() => secretKey('short')).toThrow(AuthConfigError);
        const prev = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        try {
            expect(() => secretKey()).toThrow(/JWT_SECRET/);
            process.env.JWT_SECRET = SECRET;
            expect(secretKey()).toBeInstanceOf(Uint8Array);
        }
        finally {
            if (prev === undefined)
                delete process.env.JWT_SECRET;
            else
                process.env.JWT_SECRET = prev;
        }
    });
    it('ignores a roles claim that is not a list of strings, and a non-string tenant', async () => {
        const t = await new SignJWT({ roles: 'admin', tenantId: 7 }).setProtectedHeader({ alg: 'HS256' }).setSubject('u1').setExpirationTime('1h').sign(secretKey(SECRET));
        const c = await verifyToken(t, { secret: SECRET });
        expect(c.roles).toBeUndefined();
        expect(c.tenantId).toBeUndefined();
    });
});

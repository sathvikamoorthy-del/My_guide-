// Signed access tokens (HS256) with `jose`. The secret comes from JWT_SECRET (at least 32 characters) and nowhere else.
import { SignJWT, jwtVerify } from 'jose';
export class AuthConfigError extends Error {
}
export function secretKey(secret = process.env.JWT_SECRET) {
    if (!secret || secret.length < 32)
        throw new AuthConfigError('JWT_SECRET must be set to a random string of at least 32 characters');
    return new TextEncoder().encode(secret);
}
export async function signToken(c, o = {}) {
    if (!c.userId)
        throw new Error('a token needs a userId');
    const jwt = new SignJWT({ ...(c.tenantId ? { tenantId: c.tenantId } : {}), ...(c.roles ? { roles: c.roles } : {}) })
        .setProtectedHeader({ alg: 'HS256' }).setSubject(c.userId).setIssuedAt().setExpirationTime(o.expiresIn ?? '1h');
    if (o.issuer)
        jwt.setIssuer(o.issuer);
    if (o.audience)
        jwt.setAudience(o.audience);
    return jwt.sign(secretKey(o.secret));
}
// Only HS256 is accepted (never "none" or another algorithm); expiry is enforced; issuer/audience when given.
export async function verifyToken(token, o = {}) {
    const { payload } = await jwtVerify(token, secretKey(o.secret), { algorithms: ['HS256'], issuer: o.issuer, audience: o.audience });
    if (typeof payload.sub !== 'string' || !payload.sub)
        throw new Error('token has no subject');
    const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : undefined;
    const roles = Array.isArray(payload.roles) ? payload.roles.filter((r) => typeof r === 'string') : undefined;
    return { userId: payload.sub, ...(tenantId ? { tenantId } : {}), ...(roles ? { roles } : {}), claims: payload };
}

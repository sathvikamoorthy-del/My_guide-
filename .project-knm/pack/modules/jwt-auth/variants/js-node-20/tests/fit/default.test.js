// Fit test: the app chooses where the secret comes from (JWT_SECRET); adapt when injected.
import { authenticate } from '../../files/src/auth/authMiddleware';
it('the registered middleware is a handler and anonymous requests pass', async () => {
    expect(typeof authenticate).toBe('function');
    const next = jest.fn();
    await authenticate({ headers: {} }, {}, next);
    expect(next).toHaveBeenCalledWith();
});

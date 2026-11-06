import { mockReq, mockRes, withEnv } from '../../files/src/testing/testUtils';
describe('test utils contract', () => {
    it('mockRes records status, body and headers and chains', () => {
        const res = mockRes();
        expect(res.status(201).set('X-Id', '7').json({ a: 1 })).toBe(res);
        expect(res.statusCode).toBe(201);
        expect(res.body).toEqual({ a: 1 });
        expect(res.headers['x-id']).toBe('7');
        expect(res.finished).toBe(true);
    });
    it('mockRes emits "finish" when the response is sent', () => {
        const res = mockRes();
        const done = jest.fn();
        res.on('finish', done);
        expect(done).not.toHaveBeenCalled();
        res.send('ok');
        expect(done).toHaveBeenCalledTimes(1);
        expect(res.body).toBe('ok');
    });
    it('mockReq has sane defaults and accepts overrides', () => {
        expect(mockReq()).toMatchObject({ method: 'GET', path: '/', headers: {} });
        expect(mockReq({ method: 'POST', body: { x: 1 } })).toMatchObject({ method: 'POST', body: { x: 1 } });
    });
    it('withEnv sets variables, returns the result and restores them (also on error)', async () => {
        process.env.KNM_A = 'orig';
        delete process.env.KNM_B;
        const seen = await withEnv({ KNM_A: 'temp', KNM_B: 'new' }, () => `${process.env.KNM_A}/${process.env.KNM_B}`);
        expect(seen).toBe('temp/new');
        expect(process.env.KNM_A).toBe('orig');
        expect(process.env.KNM_B).toBeUndefined();
        await expect(withEnv({ KNM_A: undefined }, async () => { expect(process.env.KNM_A).toBeUndefined(); throw new Error('boom'); })).rejects.toThrow('boom');
        expect(process.env.KNM_A).toBe('orig');
        delete process.env.KNM_A;
    });
});

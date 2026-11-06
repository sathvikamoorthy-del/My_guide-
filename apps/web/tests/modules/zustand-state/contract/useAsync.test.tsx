/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAsync } from '../../../../src/state/useAsync';

const deferred = <T,>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

describe('useAsync contract', () => {
  it('goes loading -> success with the data', async () => {
    const { result } = renderHook(() => useAsync(async () => 42, []));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect((result.current as any).data).toBe(42);
  });

  it('an error becomes a message only', async () => {
    const { result } = renderHook(() => useAsync(async () => { throw new Error('boom'); }, []));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect((result.current as any).error).toBe('boom');
    const str = renderHook(() => useAsync(() => Promise.reject('plain'), []));
    await waitFor(() => expect(str.result.current.status).toBe('error'));
    expect((str.result.current as any).error).toBe('plain');
  });

  it('a slow older call never overwrites a newer one', async () => {
    const slow = deferred<string>(); const fast = deferred<string>();
    const { result, rerender } = renderHook(({ id }) => useAsync(() => (id === 1 ? slow.promise : fast.promise), [id]), { initialProps: { id: 1 } });
    rerender({ id: 2 });
    await act(async () => { fast.resolve('new'); });
    await waitFor(() => expect((result.current as any).data).toBe('new'));
    await act(async () => { slow.resolve('old'); });
    expect((result.current as any).data).toBe('new');
  });

  it('reload runs it again, and nothing is set after unmount', async () => {
    let n = 0; const d = deferred<number>();
    const { result, unmount } = renderHook(() => useAsync(async () => ++n, []));
    await waitFor(() => expect((result.current as any).data).toBe(1));
    act(() => result.current.reload());
    await waitFor(() => expect((result.current as any).data).toBe(2));
    const gone = renderHook(() => useAsync(() => d.promise, []));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    gone.unmount(); await act(async () => { d.resolve(1); });
    expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); unmount();
  });
});

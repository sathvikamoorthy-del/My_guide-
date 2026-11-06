import { useCallback, useEffect, useRef, useState } from 'react';
// Runs an async function when `deps` change and exposes its state. A slower, older call can never overwrite a newer one, and
// nothing is set after unmount. The error is a message only (no stack, no object).
export function useAsync(fn, deps = []) {
    const [state, setState] = useState({ status: 'loading' });
    const [tick, setTick] = useState(0);
    const latest = useRef(0);
    useEffect(() => {
        const call = ++latest.current;
        setState({ status: 'loading' });
        fn().then((data) => { if (call === latest.current)
            setState({ status: 'success', data }); }, (e) => { if (call === latest.current)
            setState({ status: 'error', error: e instanceof Error ? e.message : String(e) }); });
        return () => { latest.current++; };
    }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
    const reload = useCallback(() => setTick((n) => n + 1), []);
    return { ...state, reload };
}

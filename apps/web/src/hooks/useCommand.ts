import { useEffect, useState } from "preact/hooks";
import { call } from "../api.ts";

/** Run a query command and re-run it whenever `deps` change. */
export function useCommand<T>(
  name: string,
  input: unknown,
  deps: unknown[],
): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const key = JSON.stringify(input);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    call<T>(name, input)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch(
        (error: Error) =>
          !cancelled && setState({ data: null, error: error.message, loading: false }),
      );
    return () => {
      cancelled = true;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [name, key, ...deps]);
  return state;
}

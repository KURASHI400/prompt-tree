import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
export function useData<T>(path: string | null, loader: () => Promise<T>) {
  const load = useRef(loader);
  load.current = loader;
  const [result, setResult] = useState<{
    path: string | null;
    data?: T;
    error: string;
  }>({ path, error: "" });
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!path) return;
    const request = ++sequence.current;
    try {
      const data = await load.current();
      if (request === sequence.current) setResult({ path, data, error: "" });
    } catch (e) {
      if (request === sequence.current)
        setResult((previous) => ({
          path,
          data: previous.path === path ? previous.data : undefined,
          error: (e as Error).message,
        }));
    }
  }, [path]);
  useEffect(() => {
    void refresh();
    window.addEventListener("data-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      sequence.current++;
      window.removeEventListener("data-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  const setData = useCallback(
    (next: SetStateAction<T | undefined>) => {
      setResult((previous) => ({
        path,
        error: "",
        data:
          typeof next === "function"
            ? (next as (old: T | undefined) => T | undefined)(
                previous.path === path ? previous.data : undefined,
              )
            : next,
      }));
    },
    [path],
  );
  return {
    data: result.path === path ? result.data : undefined,
    setData,
    error: result.path === path ? result.error : "",
    refresh,
  };
}
export function changed() {
  window.dispatchEvent(new Event("data-changed"));
}

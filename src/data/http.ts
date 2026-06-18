// Tiny fetch wrapper for the data clients. Network failures, non-2xx, and slow
// (hanging) sources all collapse to a typed `Degraded` result so the hot path
// never blocks and callers can record which source failed (design-001 reliability).

export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface ReqInit {
  signal?: AbortSignal;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export type FetchFn = (url: string, init?: ReqInit) => Promise<HttpResponse>;

export interface HttpOpts {
  fetchFn?: FetchFn;
  timeoutMs?: number;
}

export type Degraded = { ok: false; source: string; reason: string };
export type Result<T> = { ok: true; data: T } | Degraded;

const DEFAULT_TIMEOUT_MS = 8000;

export async function request<T>(
  url: string,
  source: string,
  init: ReqInit = {},
  opts: HttpOpts = {},
): Promise<Result<T>> {
  const fetchFn = opts.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return { ok: false, source, reason: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    const err = e as Error;
    const reason = err?.name === "AbortError" ? "timeout" : (err?.message ?? "error");
    return { ok: false, source, reason };
  } finally {
    clearTimeout(timer);
  }
}

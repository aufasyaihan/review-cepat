/**
 * Fluent HTTP client for the domain API layer. All networking goes through this
 * object (constitution III): never call fetch from components or hooks.
 *
 * Usage:
 *   const data = await api.get<Device[]>('/api/device').send();
 *   const res = await api.post('/api/device/claim').setBody({ claimCode }).send();
 *   const q = await api.get('/api/destination/places').setQuery({ query }).send();
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export class ApiRequestBuilder<T> {
  private headers: Record<string, string> = {};
  private query: Record<string, string> = {};
  private body: unknown;

  constructor(
    private readonly method: HttpMethod,
    private readonly path: string,
  ) {}

  setHeader(name: string, value: string): this {
    this.headers[name] = value;
    return this;
  }

  setQuery(params: Record<string, string | number | undefined>): this {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) this.query[key] = String(value);
    }
    return this;
  }

  setBody(body: unknown): this {
    this.body = body;
    return this;
  }

  private url(): string {
    const qs = new URLSearchParams(this.query).toString();
    return qs ? `${this.path}?${qs}` : this.path;
  }

  async send(): Promise<T> {
    const res = await fetch(this.url(), {
      method: this.method,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: this.body === undefined ? undefined : JSON.stringify(this.body),
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  }
}

export class HttpApi {
  get<T>(path: string): ApiRequestBuilder<T> {
    return new ApiRequestBuilder<T>('GET', path);
  }

  post<T>(path: string): ApiRequestBuilder<T> {
    return new ApiRequestBuilder<T>('POST', path);
  }

  put<T>(path: string): ApiRequestBuilder<T> {
    return new ApiRequestBuilder<T>('PUT', path);
  }

  delete<T>(path: string): ApiRequestBuilder<T> {
    return new ApiRequestBuilder<T>('DELETE', path);
  }
}

export const api = new HttpApi();

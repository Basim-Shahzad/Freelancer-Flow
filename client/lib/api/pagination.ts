/** Query params shared by list endpoints (`skip`/`limit` + optional `search`). */
export interface ListParams {
  skip?: number;
  limit?: number;
  search?: string;
}

/** Normalised list response: the API's `{ <items>, total }` with the items key unwrapped. */
export interface ListResult<T> {
  items: T[];
  total: number;
}

export const DEFAULT_PAGE_SIZE = 20;

export const pageToSkip = (page: number, limit = DEFAULT_PAGE_SIZE): number => Math.max(0, page - 1) * limit;

export const hasMore = (loaded: number, total: number): boolean => loaded < total;

/** `getNextPageParam` for `useInfiniteQuery` where the page param is the `skip` offset. */
export function nextSkip(lastPage: ListResult<unknown>, allPages: ListResult<unknown>[]): number | undefined {
  const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
  return lastPage.items.length > 0 && hasMore(loaded, lastPage.total) ? loaded : undefined;
}

/** Drops undefined/null/empty-string values so they are not sent as `?search=`. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Partial<T>;
}

/** Wraps a raw `{ <itemsKey>: T[], total }` body into a `ListResult`. */
export function toListResult<T, K extends string>(body: Record<K, T[]> & { total: number }, itemsKey: K): ListResult<T> {
  return { items: body[itemsKey] ?? [], total: body.total ?? 0 };
}

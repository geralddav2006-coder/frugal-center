// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Queryable {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  /** Run `fn` inside a single database transaction (all-or-nothing). */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

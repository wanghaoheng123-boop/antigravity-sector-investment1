/** Node.js built-in SQLite (v22.5+) — @types/node may lag behind runtime. */
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string | URL | Buffer, options?: { timeout?: number })
    prepare(sql: string): {
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
      all(...params: unknown[]): unknown[]
    }
    exec(sql: string): void
    close(): void
  }
}

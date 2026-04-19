/** Minimal typings — official @types package was empty in this environment. */
declare module 'better-sqlite3' {
  interface RunResult {
    changes: number
    lastInsertRowid: number | bigint
  }

  interface Statement {
    run(...params: unknown[]): RunResult
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
  }

  interface DatabaseOptions {
    readonly?: boolean
    fileMustExist?: boolean
  }

  class Database {
    constructor(path: string, options?: DatabaseOptions)
    prepare(source: string): Statement
    exec(source: string): void
    transaction<T extends (...args: never[]) => unknown>(fn: T): T
    close(): void
  }

  export default Database
}

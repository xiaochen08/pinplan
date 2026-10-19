import Database from '@tauri-apps/plugin-sql'

/** 单例 SQLite 连接（数据文件位于 %APPDATA%\com.pinplan.desktop\pinplan.db）。 */
let handle: Database | null = null
let loading: Promise<Database> | null = null

export async function getDb(): Promise<Database> {
  if (handle) return handle
  if (!loading) {
    loading = Database.load('sqlite:pinplan.db').then((db) => {
      handle = db
      return db
    })
  }
  return loading
}

export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb()
  return db.select<T[]>(sql, params)
}

export async function execute(sql: string, params: unknown[] = []) {
  const db = await getDb()
  return db.execute(sql, params)
}

/** 取单行。 */
export async function one<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await select<T>(sql, params)
  return rows.length > 0 ? rows[0] : null
}

export function nowIso(): string {
  return new Date().toISOString()
}

// Integration test: real repository + real revamp store, with an isolated SQLite database.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'

const db = new DatabaseSync(':memory:')
for (const migration of ['0001_init.sql', '0002_attachment.sql']) {
  db.exec(await readFile(new URL(`../src-tauri/migrations/${migration}`, import.meta.url), 'utf8'))
}
let failNextWrite = false
globalThis.__pinplanTestDb = {
  select: async (sql, params = []) => db.prepare(sql).all(...params),
  execute: async (sql, params = []) => {
    if (failNextWrite) { failNextWrite = false; throw new Error('simulated write failure') }
    await delay(1)
    const result = db.prepare(sql).run(...params)
    return { lastInsertId: Number(result.lastInsertRowid), rowsAffected: Number(result.changes) }
  },
}
const events = []
globalThis.__pinplanTestEmit = async (name, payload) => { events.push({ name, payload }) }
const server = await createServer({
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: ['@tauri-apps/plugin-sql', '@tauri-apps/api'] },
  plugins: [{
    name: 'isolated-tauri-test',
    enforce: 'pre',
    resolveId(id) {
      if (id === '@tauri-apps/plugin-sql') return '\0test:sql'
      if (id === '@tauri-apps/api/event') return '\0test:event'
      if (id === '@/lib/window' || id.replaceAll('\\', '/').endsWith('/src/lib/window')) return '\0test:window'
    },
    load(id) {
      if (id === '\0test:sql') return 'export default { load: async () => globalThis.__pinplanTestDb }'
      if (id === '\0test:event') return 'export const emit = globalThis.__pinplanTestEmit; export const listen = async () => () => {}'
      if (id === '\0test:window') return 'export const setDockVisible = async () => {}'
    },
  }],
})

try {
  const repo = await server.ssrLoadModule('/src/lib/repo.ts')
  const store = await server.ssrLoadModule('/src/revamp/lib/store.ts')
  const waitFor = async (predicate) => {
    for (let i = 0; i < 300; i++) { if (predicate()) return; await delay(10) }
    assert.fail('Timed out waiting for persisted state')
  }
  const before = db.prepare('SELECT COUNT(*) AS n FROM plan').get().n
  const project = await repo.createProject('Existing project')
  const oldId = await repo.createPlan('Existing plan', { project_id: project })
  await repo.updatePlan(oldId, { tags: '["existing"]', pinned: 1, refs: '["preserve"]' })
  await store.initStore()
  assert.equal(store.getState().ready, true)
  assert.equal(store.getState().error, null)
  assert.equal(store.getState().plans.length, before + 1)
  assert.deepEqual(store.getState().plans.find((p) => p.id === oldId).tags, ['existing'])
  assert.equal(store.getState().plans.find((p) => p.id === oldId).pinned, true)
  console.log('PASS existing SQLite data loads without demo replacement')

  store.setUI({ project })
  const planId = await store.createPlan('中文新计划 ! #回归')
  assert.ok(planId > oldId)
  assert.equal((await repo.getPlan(planId)).priority, 2)
  assert.equal((await repo.getPlan(planId)).project_id, project)
  assert.deepEqual(JSON.parse((await repo.getPlan(planId)).tags), ['回归'])
  store.updatePlan(planId, { detail: '中' })
  store.updatePlan(planId, { detail: '中文' })
  store.updatePlan(planId, { detail: '中文连续编辑' })
  await waitFor(() => db.prepare('SELECT detail FROM plan WHERE id=?').get(planId).detail === '中文连续编辑')
  await delay(30)
  assert.equal(store.getState().plans.find((p) => p.id === planId).detail, '中文连续编辑')
  assert.equal((await repo.getPlan(oldId)).refs, '["preserve"]')
  console.log('PASS create, tags, project and ordered autosave preserve legacy fields')

  store.setPlanStatus(planId, 'doing')
  await waitFor(() => db.prepare('SELECT status FROM plan WHERE id=?').get(planId).status === 'doing')
  store.setPlanStatus(planId, 'done')
  await waitFor(() => db.prepare('SELECT status FROM plan WHERE id=?').get(planId).status === 'done')
  await waitFor(() => db.prepare("SELECT COUNT(*) AS n FROM event WHERE entity='plan' AND entity_id=? AND kind='status'").get(planId).n === 2)
  assert.ok((await repo.getPlan(planId)).finished_at)
  assert.equal((await repo.listEvents('plan', planId)).filter((e) => e.kind === 'status').length, 2)
  store.setPlanStatus(oldId, 'dropped')
  await waitFor(() => Boolean(db.prepare('SELECT finished_at FROM plan WHERE id=?').get(oldId).finished_at))
  const bugId = await store.createBug('中文 BUG', 'blocker')
  store.updateBug(bugId, { plan_id: planId, fix_note: '修复说明' })
  store.setBugStatus(bugId, 'fixed')
  await waitFor(() => db.prepare('SELECT status FROM bug WHERE id=?').get(bugId).status === 'fixed')
  assert.equal((await repo.getBug(bugId)).plan_id, planId)
  assert.equal((await repo.getBug(bugId)).severity, 'blocker')
  assert.ok((await repo.getBug(bugId)).fixed_at)
  console.log('PASS status transitions, timestamps, linked BUG and event history')

  await delay(40)
  failNextWrite = true
  assert.equal(await store.createPlan('Must not be saved'), null)
  assert.equal(db.prepare('SELECT count(*) AS n FROM plan WHERE title=?').get('Must not be saved').n, 0)
  assert.match(store.getState().toast.message, /保存失败/)
  failNextWrite = true
  store.updatePlan(planId, { detail: 'Must roll back' })
  await waitFor(() => store.getState().plans.find((p) => p.id === planId).detail === '中文连续编辑')
  console.log('PASS failed writes show failure and restore persisted state')

  store.updateSettings({ checkinInterval: 0, edgePin: false, alwaysOnTop: false })
  await waitFor(() => db.prepare('SELECT value FROM setting WHERE key=?').get('checkin_interval')?.value === '0')
  await delay(40)
  const settings = await repo.loadSettings()
  assert.equal(settings.checkin_interval, 0)
  assert.equal(settings.dock_enabled, false)
  assert.equal(settings.always_on_top, false)
  assert.ok(events.some((e) => e.name === 'pinplan://settings-changed'))
  failNextWrite = true
  store.updateSettings({ alwaysOnTop: true })
  await waitFor(() => store.getState().settings.alwaysOnTop === false)
  console.log('PASS settings persist and notify independent desktop windows')

  store.pomodoroStart()
  assert.equal(store.getState().pomodoro.running, true)
  store.pomodoroSkip()
  assert.equal(store.getState().pomodoro.phase, 'break')
  store.pomodoroPause()
  assert.equal(store.getState().pomodoro.running, false)
  await delay(40)
  store.deleteBug(bugId)
  await waitFor(() => !db.prepare('SELECT id FROM bug WHERE id=?').get(bugId))
  await delay(40)
  assert.ok(await repo.getPlan(oldId))
  console.log('PASS pomodoro and scoped deletion leave existing records intact')
  console.log('6 integration scenarios passed (isolated in-memory SQLite).')
} finally {
  await server.close()
  db.close()
  delete globalThis.__pinplanTestDb
  delete globalThis.__pinplanTestEmit
}

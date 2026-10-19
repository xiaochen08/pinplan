import { Download, FileJson, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { clearAll, getState, setUI, toast, updateSettings, useStore } from '@/revamp/lib/store'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { download, toJSON, toMarkdown } from '@/revamp/lib/export'
import { dayKey } from '@/revamp/lib/time'
import { Btn, IconBtn, Kbd, Label, Segmented, cx } from './ui'

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div>
        <div className="text-[13px] font-medium">{title}</div>
        {hint && <div className="mt-0.5 text-[11.5px] text-ink-3">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cx('relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full transition-colors', on ? 'bg-ink' : 'bg-rule-strong')}
    >
      <motion.span
        className="absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-sheet shadow"
        animate={{ x: on ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
      />
    </button>
  )
}

function Stepper({ value, min, max, onChange, unit }: { value: number; min: number; max: number; onChange: (v: number) => void; unit: string }) {
  return (
    <div className="flex h-7 items-center rounded-[6px] shadow-[inset_0_0_0_1px_var(--rule-strong)]">
      <button type="button" className="h-full w-7 cursor-pointer text-ink-3 hover:text-ink" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span className="w-12 text-center font-mono text-[12px] tnum">
        {value}
        <span className="text-ink-4">{unit}</span>
      </span>
      <button type="button" className="h-full w-7 cursor-pointer text-ink-3 hover:text-ink" onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  )
}

const SHORTCUTS: [string, string][] = [
  ['Alt Space', '显示 / 隐藏主窗'],
  ['Alt N', '快速记一条计划'],
  ['Alt B', '快速记一个 BUG'],
  ['Alt M', '切换主窗 / 小窗'],
  ['/', '搜索'],
  ['Esc', '关闭详情 / 弹窗'],
]

export function SettingsDialog() {
  const open = useStore((s) => s.ui.settingsOpen)
  const s = useStore((st) => st.settings)
  const [armed, setArmed] = useState(false)
  const [autostart, setAutostart] = useState(false)
  useEffect(() => {
    if (open) { setArmed(false); void isEnabled().then(setAutostart).catch(console.error) }
  }, [open])
  const toggleAutostart = async (value: boolean) => {
    try { await (value ? enable() : disable()); setAutostart(value) }
    catch (error) { toast(`开机启动设置失败：${String(error)}`) }
  }
  const close = () => setUI({ settingsOpen: false })
  const stamp = dayKey(new Date().toISOString())

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-ink/20 p-6 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div
            initial={{ y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="scroll max-h-full w-[560px] max-w-full rounded-[14px] bg-sheet shadow-pop"
          >
            <div className="sticky top-0 z-10 flex items-center border-b border-rule bg-sheet px-6 py-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-ink-4">SETTINGS</div>
                <h2 className="font-cn text-[20px] font-semibold">设置</h2>
              </div>
              <IconBtn icon={X} label="关闭" className="ml-auto" onClick={close} />
            </div>
            <div className="divide-y divide-rule px-6">
              <section className="py-2">
                <Label className="pt-3">外观</Label>
                <Row title="主题" hint="纸面适合白天，夜读适合深夜。">
                  <Segmented value={s.theme} onChange={(v) => updateSettings({ theme: v })} options={[{ value: 'paper', label: '纸面' }, { value: 'night', label: '夜读' }]} />
                </Row>
                <Row title="边缘小钉" hint="贴在屏幕右边缘的呼吸细条，单击显隐主窗。">
                  <Toggle on={s.edgePin} onChange={(v) => updateSettings({ edgePin: v })} />
                </Row>
                <Row title="窗口置顶"><Toggle on={s.alwaysOnTop} onChange={(v) => updateSettings({ alwaysOnTop: v })} /></Row>
                <Row title="开机启动"><Toggle on={autostart} onChange={(v) => void toggleAutostart(v)} /></Row>
              </section>
              <section className="py-2">
                <Label className="pt-3">番茄钟</Label>
                <Row title="专注时长">
                  <Stepper value={s.pomodoroWork} min={1} max={90} unit="′" onChange={(v) => updateSettings({ pomodoroWork: v })} />
                </Row>
                <Row title="休息时长" hint="专注结束进入休息时，会顺便发起一次巡检。">
                  <Stepper value={s.pomodoroBreak} min={1} max={30} unit="′" onChange={(v) => updateSettings({ pomodoroBreak: v })} />
                </Row>
              </section>
              <section className="py-2">
                <Label className="pt-3">巡检</Label>
                <Row title="免打扰时段" hint="定时巡检和番茄钟巡检会避开此时段。">
                  <div className="flex items-center gap-2 text-[12px]">
                    <input aria-label="免打扰开始" type="time" value={s.quietStart} onChange={(e) => updateSettings({ quietStart: e.target.value })} className="w-24 bg-sheet-2 px-1" />
                    <span>至</span>
                    <input aria-label="免打扰结束" type="time" value={s.quietEnd} onChange={(e) => updateSettings({ quietEnd: e.target.value })} className="w-24 bg-sheet-2 px-1" />
                  </div>
                </Row>
                <Row title="定时追问" hint="「这条还在推进吗？」——防止计划悄悄腐烂。">
                  <Toggle on={s.checkinEnabled} onChange={(v) => updateSettings({ checkinEnabled: v })} />
                </Row>
                <Row title="独立间隔" hint="不开番茄钟也会按时追问。">
                  <Segmented
                    size="sm"
                    value={s.checkinInterval}
                    onChange={(v) => updateSettings({ checkinInterval: v })}
                    options={[0, 30, 45, 60, 90].map((m) => ({ value: m, label: m ? `${m}′` : '仅番茄' }))}
                  />
                </Row>
              </section>
              <section className="py-2">
                <Label className="pt-3">数据</Label>
                <p className="pt-2 text-[11.5px] leading-relaxed text-ink-3">数据保存在本机 SQLite，沿用原桌面版数据库。导出文件保存到「文档 / PinPlan」。源码上传 GitHub 不包含你的计划、BUG 或图片数据。</p>
                <div className="flex flex-wrap gap-2 py-3">
                  <Btn size="sm" icon={Download} onClick={() => download(`pinplan-${stamp}.md`, toMarkdown(getState()), 'text/markdown')}>导出 Markdown</Btn>
                  <Btn size="sm" icon={FileJson} onClick={() => download(`pinplan-${stamp}.json`, toJSON(getState()), 'application/json')}>导出 JSON</Btn>
                </div>
                <div className="flex flex-wrap gap-2 pb-3">
                  <Btn size="sm" variant="ghost" icon={Trash2} tone="var(--s-failed)" onClick={() => { if (armed) { clearAll(); setArmed(false) } else setArmed(true) }}>{armed ? '确认永久清空计划和 BUG' : '清空全部'}</Btn>
                  {armed && <Btn size="sm" onClick={() => setArmed(false)}>取消</Btn>}
                  {armed && <p className="w-full text-[11.5px] text-failed">这会永久删除所有计划、BUG 和时间线，请先导出需要保留的内容。</p>}
                </div>
              </section>
              <section className="py-2 pb-5">
                <Label className="pt-3 pb-2">快捷键</Label>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {SHORTCUTS.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-[12px] text-ink-2">
                      {v}
                      <Kbd>{k}</Kbd>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getVersion } from '@tauri-apps/api/app'
import { appConfigDir } from '@tauri-apps/api/path'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { useStore } from '@/store/useStore'
import type { AccentName, GlassMode, ThemeName } from '@/lib/repo'
import { GLASS_LABEL, setGlassMode } from '@/lib/glass'
import { openPath, saveExport, toJson, toMarkdown } from '@/lib/export'
import { quitApp } from '@/lib/app'
import { Icon } from '@/components/ui/Icon'
import { Button, IconButton, Switch } from '@/components/ui/primitives'
import { spring } from '@/components/ui/motion'

const ACCENTS: { name: AccentName; color: string; label: string }[] = [
  { name: 'indigo', color: '#6366f1', label: '靛蓝' },
  { name: 'cyan', color: '#22d3ee', label: '青色' },
  { name: 'amber', color: '#fb923c', label: '橙色' },
  { name: 'violet', color: '#a855f7', label: '紫色' },
  { name: 'signal', color: '#c8102e', label: '信号红（Swiss）' },
]

const THEME_LABEL: Record<ThemeName, string> = {
  glass: '深色玻璃',
  swiss: 'Swiss 纸面',
}

function Row({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-ink-100">{title}</div>
        {desc && <div className="mt-0.5 text-[11px] leading-snug text-ink-500">{desc}</div>}
      </div>
      <div className="no-drag shrink-0">{children}</div>
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
  suffix = '分钟',
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-1 rounded-[10px] border border-tint-8 bg-tint-4 p-0.5">
      <IconButton
        icon="x"
        label="减少"
        size={11}
        className="h-6 w-6 rotate-45"
        onClick={() => onChange(Math.max(min, value - 5))}
      />
      <span className="tnum w-[52px] text-center text-[12px] text-ink-100">
        {value}
        <span className="ml-0.5 text-[10.5px] text-ink-500">{suffix}</span>
      </span>
      <IconButton
        icon="plus"
        label="增加"
        size={12}
        className="h-6 w-6"
        onClick={() => onChange(Math.min(max, value + 5))}
      />
    </div>
  )
}

export function SettingsPanel() {
  const open = useStore((s) => s.settingsOpen)
  const openSettings = useStore((s) => s.openSettings)
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const plans = useStore((s) => s.plans)
  const bugs = useStore((s) => s.bugs)
  const notify = useStore((s) => s.notify)

  const [autostart, setAutostart] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void getVersion().then(setVersion).catch(() => undefined)
  }, [])
  const [dataDir, setDataDir] = useState('')

  useEffect(() => {
    if (!open) return
    void isEnabled().then(setAutostart).catch(() => undefined)
    void appConfigDir().then(setDataDir).catch(() => undefined)
  }, [open])

  const toggleAutostart = async (v: boolean) => {
    try {
      if (v) await enable()
      else await disable()
      setAutostart(v)
      await update({ autostart: v })
      notify(v ? '已设为开机自启' : '已关闭开机自启', 'ok')
    } catch {
      notify('设置开机自启失败', 'bad')
    }
  }

  const toggleTop = async (v: boolean) => {
    await getCurrentWindow().setAlwaysOnTop(v)
    await update({ always_on_top: v })
  }

  const exportMd = async () => {
    try {
      const path = await saveExport(
        `pinplan-${new Date().toISOString().slice(0, 10)}.md`,
        toMarkdown(plans, bugs),
      )
      notify('已导出 Markdown', 'ok')
      void path
    } catch {
      notify('导出失败', 'bad')
    }
  }

  const exportJson = async () => {
    try {
      await saveExport(
        `pinplan-backup-${new Date().toISOString().slice(0, 10)}.json`,
        toJson(plans, bugs, []),
      )
      notify('已导出 JSON 备份', 'ok')
    } catch {
      notify('导出失败', 'bad')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          onClick={() => openSettings(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99, transition: { duration: 0.16 } }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
            className="glass glass-blur glass-solid absolute inset-x-2 top-2 bottom-2 flex flex-col"
            style={{ borderRadius: 16 }}
          >
            <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
              <div className="drag flex flex-1 items-center gap-2 self-stretch">
                <Icon name="settings" size={14} className="text-ink-300" />
                <span className="text-[13px] font-semibold">设置</span>
              </div>
              <IconButton icon="x" label="关闭" onClick={() => openSettings(false)} />
            </div>

            <div className="scroll flex-1 px-3.5 pb-4">
              {/* 外观 */}
              <Section title="外观">
                <Row
                  title="主题"
                  desc="Swiss 纸面：米白底、发丝分隔线、零圆角、无阴影，靠字号建立层级"
                >
                  <div className="flex items-center gap-1">
                    {(['glass', 'swiss'] as ThemeName[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => void update({ theme: t })}
                        className={clsx(
                          'h-7 rounded-[9px] border px-2.5 text-[11.5px] transition-colors duration-150',
                          settings.theme === t
                            ? 'border-tint-20 bg-tint-12 text-ink-100'
                            : 'border-tint-7 text-ink-400 hover:bg-tint-6',
                        )}
                      >
                        {THEME_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="强调色" desc="影响进度环、按钮和高亮">
                  <div className="flex items-center gap-1.5">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.name}
                        type="button"
                        title={a.label}
                        onClick={() => void update({ accent: a.name })}
                        className={clsx(
                          'relative h-6 w-6 rounded-full transition-transform duration-150',
                          settings.accent === a.name ? 'scale-110' : 'hover:scale-105',
                        )}
                        style={{ background: a.color }}
                      >
                        {settings.accent === a.name && (
                          <motion.span
                            layoutId="accent-ring"
                            transition={spring}
                            className="absolute -inset-[3px] rounded-full border-2 border-tint-70"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="边缘小钉" desc="贴边收起的状态指示小图标，单击显隐主窗">
                  <Switch
                    checked={settings.dock_enabled}
                    onChange={(v) => void update({ dock_enabled: v })}
                    label="边缘小钉"
                  />
                </Row>
                <Row
                  title="窗口玻璃"
                  desc="亚克力最好看但拖动最费合成；老显卡 / 远程桌面 / 虚拟显示器建议用「模糊」或「关闭」"
                >
                  <div className="flex items-center gap-1">
                    {(['acrylic', 'blur', 'none'] as GlassMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          void update({ glass: m })
                          void setGlassMode(m)
                        }}
                        className={clsx(
                          'h-7 rounded-[9px] border px-2.5 text-[11.5px] transition-colors duration-150',
                          settings.glass === m
                            ? 'border-tint-20 bg-tint-12 text-ink-100'
                            : 'border-tint-7 text-ink-400 hover:bg-tint-6',
                        )}
                      >
                        {GLASS_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </Row>
              </Section>

              {/* 番茄钟 */}
              <Section title="番茄钟">
                <Row title="专注时长" desc="一个番茄 = 专注 + 休息">
                  <Stepper
                    value={settings.pomodoro_work}
                    min={5}
                    max={120}
                    onChange={(v) => void update({ pomodoro_work: v })}
                  />
                </Row>
                <Row title="休息时长" desc="休息开始时弹出巡检追问">
                  <Stepper
                    value={settings.pomodoro_break}
                    min={1}
                    max={60}
                    onChange={(v) => void update({ pomodoro_break: v })}
                  />
                </Row>
              </Section>

              {/* 巡检 */}
              <Section title="巡检追问">
                <Row title="启用定时追问" desc="每个番茄结束时问一次">
                  <Switch
                    checked={settings.checkin_enabled}
                    onChange={(v) => void update({ checkin_enabled: v })}
                    label="启用定时追问"
                  />
                </Row>
                <Row title="预览追问弹窗" desc="立刻在右下角弹一次，看看长什么样">
                  <Button
                    icon="zap"
                    size="sm"
                    onClick={() => void useStore.getState().triggerCheckin(true)}
                  >
                    试一下
                  </Button>
                </Row>
                <Row title="免打扰时段" desc="这段时间内不会弹窗">
                  <div className="flex items-center gap-1.5">
                    <TimeBox
                      value={settings.quiet_start}
                      onChange={(v) => void update({ quiet_start: v })}
                    />
                    <span className="text-[11px] text-ink-500">→</span>
                    <TimeBox
                      value={settings.quiet_end}
                      onChange={(v) => void update({ quiet_end: v })}
                    />
                  </div>
                </Row>
              </Section>

              {/* 系统 */}
              <Section title="系统">
                <Row title="开机自启" desc="登录后自动把 PinPlan 钉回屏幕">
                  <Switch checked={autostart} onChange={(v) => void toggleAutostart(v)} />
                </Row>
                <Row title="窗口置顶" desc="始终显示在其它窗口之上">
                  <Switch
                    checked={settings.always_on_top}
                    onChange={(v) => void toggleTop(v)}
                  />
                </Row>
                <Row title="退出 PinPlan" desc="也可以右键托盘图标退出">
                  <Button icon="x" size="sm" onClick={() => void quitApp()}>
                    退出
                  </Button>
                </Row>
              </Section>

              {/* 数据 */}
              <Section title="数据">
                <Row title="导出 Markdown" desc="按状态分组的开发日志，可贴进周报">
                  <Button icon="edit" size="sm" onClick={() => void exportMd()}>
                    导出
                  </Button>
                </Row>
                <Row title="导出 JSON 备份" desc="全量数据，可用于迁移">
                  <Button icon="history" size="sm" onClick={() => void exportJson()}>
                    导出
                  </Button>
                </Row>
                <Row title="数据文件夹" desc={dataDir || '本地 SQLite，不上传任何数据'}>
                  <Button
                    icon="link"
                    size="sm"
                    onClick={() => dataDir && void openPath(dataDir)}
                  >
                    打开
                  </Button>
                </Row>
              </Section>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] text-ink-600">
                <Icon name="pin" size={10} />
                PinPlan {version ? `v${version.split('.').slice(0, 2).join('.')}` : ''} · 完全本地，无账号无网络
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-0.5 text-[10.5px] font-medium tracking-wide text-ink-500">{title}</div>
      <div className="divide-y divide-tint-5">{children}</div>
    </div>
  )
}

function TimeBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value || '00:00')}
      className="tnum h-7 rounded-[9px] border border-tint-8 bg-tint-4 px-2 text-[11.5px] text-ink-200"
    />
  )
}

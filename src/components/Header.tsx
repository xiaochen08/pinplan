import { getCurrentWindow } from '@tauri-apps/api/window'
import { useStore } from '@/store/useStore'
import { Icon } from '@/components/ui/Icon'
import { IconButton, ProgressRing } from '@/components/ui/primitives'

/**
 * 顶部标题栏。
 *
 * 左半条连成一片拖动区（logo、分隔线、统计数字之间不留空隙，否则拖到缝隙里
 * 会"抓不住"窗口）；右侧按钮必须留在拖动区外面作为兄弟节点 ——
 * 放进拖动区再靠 no-drag 抵消是不可靠的。
 */
export function Header() {
  const stats = useStore((s) => s.stats)
  const openSettings = useStore((s) => s.openSettings)

  const decided = stats.done + stats.failed
  const ratio = decided > 0 ? stats.done / decided : 0

  return (
    <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
      <div className="drag flex min-w-0 flex-1 items-center gap-3 self-stretch">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[var(--color-accent)]/18 text-[var(--color-accent-soft)]">
            <Icon name="pin" size={14} />
          </span>
          <div>
            <div className="text-[13.5px] font-semibold tracking-tight">PinPlan</div>
            <div className="text-[10.5px] text-ink-500">钉子计划 · 本地</div>
          </div>
        </div>

        <div className="mx-1 h-6 w-px bg-tint-8" />

        <div className="flex items-center gap-3 text-[11.5px] text-ink-400">
          <span className="tnum">
            <span className="text-[var(--color-doing)]">{stats.doing}</span> 进行
          </span>
          <span className="tnum">
            <span className="text-[var(--color-done)]">{stats.done}</span> 成功
          </span>
          <span className="tnum">
            <span className="text-[var(--color-failed)]">{stats.failed}</span> 失败
          </span>
          <span className="tnum">
            <span className="text-[var(--color-bug)]">{stats.bugsOpen}</span> 待修 BUG
          </span>
        </div>
      </div>

      {/* 右侧按钮组。
          注意顺序：进度环放在最右边，而不是紧贴窗口右缘放按钮。
          贴边约 30px 处有个东西会吃掉点击（缩放边框只有 7px，解释不了），
          实测同样一行里距边 30px 的按钮点不动、60px 的能点 —— 所以把
          按钮整体挪进可用区，让环去占最右边那一格。 */}
      <div className="flex items-center gap-1 pr-1">
        <div className="flex items-center gap-0.5">
          <IconButton icon="settings" label="设置" onClick={() => openSettings(true)} />
          <IconButton
            icon="x"
            label="关闭窗口（小钉和托盘还在）"
            onClick={() => void getCurrentWindow().hide()}
          />
        </div>
        <ProgressRing value={ratio} size={28} stroke={3} gradientId="wide-ring">
          <span className="tnum text-[9.5px] font-semibold text-ink-200">
            {Math.round(ratio * 100)}
          </span>
        </ProgressRing>
      </div>
    </div>
  )
}

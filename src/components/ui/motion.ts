import type { Transition, Variants } from 'motion/react'

/* ==================================================================
   PinPlan 动效令牌 —— 克制风格
   ------------------------------------------------------------------
   核心：按下和松开用**不同曲线**。
   按下要快而干脆（无回弹），松开用弹簧收尾（几乎不过冲）。
   全部只跑 transform / opacity / 颜色，不碰 layout 属性。
   ================================================================== */

/** 按下：90ms，干脆利落 */
export const press: Transition = { duration: 0.09, ease: [0.4, 0, 1, 1] }
/** 松开 / 回弹：快，几乎不过冲 */
export const release: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 30,
  mass: 0.7,
}
/** 内容入场 */
export const enter: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 34,
  mass: 0.8,
}
/** 布局补位（列表增删、跨列移动） */
export const layout: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 38,
  mass: 0.8,
}

/** 兼容旧引用 */
export const spring = release
export const soft: Transition = { type: 'spring', stiffness: 300, damping: 30 }
export const snappy = press

/* ------------------------------------------------------------------
   组合动效
   ------------------------------------------------------------------ */

/** 列表项进出：只跑 transform + opacity */
export const listItem: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: enter },
  exit: {
    opacity: 0,
    scale: 0.985,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
  },
}

/** 内容淡入（展开详情、切换视图） */
export const fade: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: soft },
  exit: { opacity: 0, y: -4, transition: { duration: 0.13 } },
}

/** 从右侧滑入的面板 */
export const slideIn: Variants = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0, transition: enter },
  exit: {
    opacity: 0,
    x: 10,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
  },
}

/** 从底部上浮的弹窗（进出不对称，退出更快更轻） */
export const popup: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: enter },
  exit: {
    opacity: 0,
    y: 6,
    scale: 0.99,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
}

/**
 * 方向性切换（Tab 左右滑）。
 * custom 传 +1（向右）或 -1（向左）。
 */
export const slideDir: Variants = {
  enter: (d: number) => ({ x: d * 22, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: enter },
  exit: (d: number) => ({
    x: d * -22,
    opacity: 0,
    transition: { duration: 0.11, ease: [0.4, 0, 1, 1] },
  }),
}

/* ------------------------------------------------------------------
   交互反馈
   ------------------------------------------------------------------ */

/** 点击：轻微下沉，配 press 曲线 */
export const tap = { scale: 0.97, transition: press }
/** 悬停：轻微抬起 */
export const hoverLift = { y: -1, transition: { duration: 0.12 } }
export const hover = { scale: 1.03, transition: release }

/** 列表错峰入场：每项递增 30ms，最多累计 240ms */
export const stagger = (i: number, step = 0.03): Transition => ({
  delay: Math.min(i * step, 0.24),
})

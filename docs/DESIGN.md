# PinPlan · 钉子计划

> 一个钉在屏幕上的本地开发计划 / 方案复盘 / BUG 追踪小工具。
> 100% 本地、无账号、无网络。核心气质：**安静地待在角落，但一直在提醒你事情的真实状态。**

---

## 一、产品定位

开发过程中真正会丢的东西不是代码，是**「我本来打算做什么、做到哪了、为什么放弃」**。

PinPlan 解决三件事：

1. **钉住计划** —— 方案随手记，状态一目了然（做没做、成没成）。
2. **定时追问** —— 每隔一段时间弹一张小卡片问一句：「这条还在推进吗？」
   防止「计划悄悄腐烂」——它最大的价值是**逼你承认某件事已经死了**。
3. **收容 BUG** —— 记下缺陷，修好后点一下标记，留痕可回溯。

### 设计原则

| 原则 | 含义 |
| --- | --- |
| 不打扰但存在 | 常驻置顶小窗，默认只占 320px 宽；弹窗可一键静音 |
| 状态诚实 | 失败和放弃是**一等公民**，和成功同等醒目 |
| 一键即达 | 新增/改状态/标记修复，都不超过一次点击 |
| 数据自主 | SQLite 单文件，随时导出 Markdown / JSON |
| 动效克制 | 每个动画都表达「发生了什么」，不做无意义炫技 |

---

## 二、信息架构

四类对象，互相弱关联：

```
Project（项目/仓库）
 ├── Plan（开发计划 / 方案）     状态机：draft → doing → done | failed | parked | dropped
 └── Bug（缺陷）                状态机：open → fixing → fixed → verified | wontfix

Event（时间线）   —— 所有状态变更自动留痕，形成开发日志
Checkin（巡检）   —— 定时提问 + 你的回答
```

### Plan 状态机

```
        ┌─────────┐  开始   ┌─────────┐  成功  ┌──────┐
        │  draft  │ ──────> │  doing  │ ─────> │ done │
        │  草案   │         │ 进行中  │        │ 成功 │
        └─────────┘         └────┬────┘        └──────┘
             │                   │ 失败  ┌────────┐
             │                   └─────> │ failed │
             │                           │ 失败   │
             │ 搁置  ┌────────┐          └────────┘
             └─────> │ parked │  ← 可复活回 doing
                     │ 搁置   │
                     └────────┘
             │ 废弃  ┌─────────┐
             └─────> │ dropped │
                     │ 已放弃  │
                     └─────────┘
```

字段设计上刻意区分 **预期（expect）** 与 **实际（result）** 与 **复盘（lesson）**：
- 成功 → 记「为什么成，能不能复用」
- 失败 → 记「死在哪一步，下次怎么绕开」

这是这个工具区别于普通 todo 的地方。

### Bug 状态机

```
open ──> fixing ──> fixed ──> verified
  │                    │          │
  └────────────────────┴──────────┴──> wontfix / 重新打开 open
```

「标记已修复」是一次点击的动作，同时写入 `fixed_at`，可选关联 commit hash。

---

## 三、窗口形态

### 形态 A：钉子小窗（默认，常驻）

```
┌──────────────────────────────┐
│ ● 8月14日   ╭───╮            │  ← 日期 + 今日进度环（成功/进行/失败）
│             │68%│   ▸ 展开   │
│             ╰───╯            │
├──────────────────────────────┤
│ [ 计划 3 ] [ BUG 1 ]         │  ← 分段控件，带下划线滑动动画
├──────────────────────────────┤
│ ◉ 接入 WebView2 缓存预热     │  ← 进行中：左侧蓝色脉动条
│   ▸ doing · 高                │
├──────────────────────────────┤
│ ✓ 换掉旧版图标库             │  ← 成功：绿色勾 + 划线渐入
│   done · 2h 前                │
├──────────────────────────────┤
│ ✕ 试了自研虚拟滚动，卡顿       │  ← 失败：红色，附一句结论
│   failed · 为什么：帧率掉到 40 │
├──────────────────────────────┤
│ ＋ 记一条计划…            ⌘N │  ← 快速输入，Enter 提交
└──────────────────────────────┘
```

- 尺寸 320×420，无边框、圆角、置顶、不进任务栏
- 按住空白处拖动；拖到屏幕边缘 12px 内自动吸附，并记住位置（多显示器按显示器分别记忆）
- 滚轮滚列表，列表到头再滚 → 自动淡出收起（可选，默认关）
- 双击标题栏空白 → 展开为主窗；`Esc` 收回

### 形态 B：主窗（展开）

点击「展开」时不是打开新窗口，而是**同一个窗口用共享布局动画变形**（`layout` + `AnimatePresence`），圆角从 18 过渡到 14，内容交叉淡入。

```
┌──────────┬────────────────────────────┬──────────────┐
│ 项目      │  视图切换：列表 / 看板      │  详情面板     │
│ ▸ 全部    │  ┌──────┬──────┬──────┐   │  标题         │
│ ▸ 客户端  │  │草案 2│进行 3│成功 8│   │  预期 / 实际  │
│ ▸ 服务端  │  ├──────┼──────┼──────┤   │  复盘         │
│           │  │卡片… │卡片… │卡片… │   │  ──────────  │
│ 标签      │  │      │      │      │   │  时间线       │
│ #性能     │  └──────┴──────┴──────┘   │  09:12 创建   │
│ #重构     │  ← 卡片可拖拽跨列，落地有  │  11:40 开始   │
│           │    弹簧回弹 + 列高亮       │  15:02 失败   │
└──────────┴────────────────────────────┴──────────────┘
```

- 尺寸 960×640，可调整，同样置顶可选
- 看板拖拽用 `Motion` 的 `layoutId` 让卡片「飞」到新列，不做生硬的删除+插入
- 详情面板右侧滑入，编辑即时保存（无需「保存」按钮）

### 形态 C：巡检弹窗（定时追问）

从屏幕右下角滑入的小卡片，宽 300，不抢焦点（`focus: false`），8 秒后自动收起进通知中心。

```
┌────────────────────────────────┐
│  ⏱  这条还在推进吗？            │
│                                │
│  接入 WebView2 缓存预热         │
│  已进行 1h 20m                 │
│                                │
│  [ 还在做 ]  [ 卡住了 ]         │
│  [ 已完成 ]  [ 放弃 ]           │
│  ──────────────────────────    │
│  补一句…（可选）            ↵   │
└────────────────────────────────┘
```

回答直接回写状态，**不需要打开主窗**。这是整个工具最高频的交互，必须一秒钟完成。

- 触发策略：见第七节
- 全屏应用 / 会议 / 游戏时自动静默（检测前台进程或全屏窗口）
- 免打扰时段（如 12:00–13:30、23:00–09:00）
- 同一条计划连续 3 次巡检都答「还在做」→ 卡片文案变成「要不要先搁置它？」（温和地戳你）

---

### 形态 D：边缘小钉（Edge Pin）

主窗可以彻底关掉，桌面上只留这一层——存在感最低，但一直告诉你现在什么状况。

```
收起态（贴右边）                    悬停展开
                                    ┌──────────────────┐ ┌────┐
    桌面内容          ▐        🔵   │ 3 条进行中        │ │ ◉  │
                      ▐             │ 接入 WebView2…   │ └────┘
                      ▐             └──────────────────┘
   14px 细条，颜色 = 状态
   鼠标碰上去平移滑出
```

**状态色（优先级 红 > 蓝 > 绿 > 灰）**

| 色 | 触发条件 |
| --- | --- |
| 🔴 红 | 有阻塞/高危 BUG 待修，或有 `failed` 且复盘为空 |
| 🔵 蓝 | 有 `doing` 条目，或番茄钟在跑 |
| 🟢 绿 | 没有待办，且今日有成功/已修 |
| ⚪ 灰 | 完全没有数据 |

**交互**

| 动作 | 结果 |
| --- | --- |
| 悬停 | 细条**平移滑出**成 42px 圆图标（无缩放、无淡入）；停留 400ms 后冒状态气泡（路过不打扰） |
| 单击 | 显隐主窗 |
| 右键 | 菜单：显隐主窗 / 记一条计划 / 记一个 BUG / 设置 / 退出（鼠标移开即收起） |
| 拖动 | 离边缘 ≤90px 吸附到左/右/上；拖到屏幕中间则自由悬浮，不吸附 |
| 空闲 4.2s | 自动缩回细条（自由悬浮时不缩回，因为没有边可收） |
| 巡检到点 | 图标轻微弹一下 + 气泡「该巡检了」 |
| 番茄钟在跑 | 图标外圈画 `strokeDashoffset` 进度环 |

**动效原则：只做位移和透明度，不做缩放/回弹；没有任何无限循环动画。** 状态靠颜色表达（静态），状态翻转时一次性过渡，其余一律 160ms 缓动 `[0.2, 0.8, 0.3, 1]`。循环动画会让渲染进程在拖窗时持续产帧，是拖动卡顿的根因。

**实现要点**

- 独立窗口 `dock`，窗口本身在三种尺寸间切换：细条 `14×44`、图标 `56×56`、气泡 `270×56`
- 几何全部由 Rust 命令 `dock_place(edge, offset, mode)` 计算并应用（能拿到 `monitor.work_area()`，避免压住任务栏）；前端只负责一次性过渡动画
- **刻意不用系统亚克力**：窗口尺寸频繁变化，亚克力会把整块窗口矩形染色露出暗块，所以质感由 Web 层自绘（实底 + 描边 + 静态光晕）
- 气泡区域需要真实空间，所以用「窗口临时变宽」而不是浮层——代价是那 2.6 秒会挡住下层点击
- 拖拽用 `startDragging()`，靠 `onMoved` 事件 260ms 防抖判定「拖完了」，再算最近边缘
- 番茄钟状态由主窗每秒广播 `pinplan://pomodoro` 给小钉（小钉是独立窗口，读不到主窗的 store）

---

## 四、视觉与动效规范

### 材质与配色

| 元素 | 规格 |
| --- | --- |
| 背景 | Win11 Mica（`apply_mica`，暗色）或亚克力；退化方案为 `#16171B` + `blur(24px)` |
| 卡片 | `rgba(255,255,255,0.04)` 填充 + `1px solid rgba(255,255,255,0.08)` 内描边 |
| 圆角 | 小窗 18px / 主窗 14px / 卡片 12px / 按钮 10px |
| 阴影 | 小窗 `0 24px 60px -12px rgba(0,0,0,.55)`；卡片悬浮时再叠一层柔和光晕 |
| 间距 | 严格 4 的倍数，常用 8 / 12 / 16 / 24 |
| 字体 | 中文 HarmonyOS Sans / 思源黑体；数字 `tabular-nums` 等宽，避免跳动 |

### 状态色

| 状态 | 色值 | 动效 |
| --- | --- | --- |
| 草案 draft | `#8B8D98` 灰 | 静态 |
| 进行中 doing | `#6366F1` 靛蓝 | 左侧竖条（静态高亮） |
| 成功 done | `#34D399` 绿 | 勾号 `pathLength` 0→1 描边动画（一次性） |
| 失败 failed | `#F87171` 红 | 轻微横向抖动一次（6px，衰减） |
| 搁置 parked | `#FBBF24` 琥珀 | 卡片整体降透明度到 .6 |
| BUG 未修 | `#FB7185` 玫红 | 角标（静态） |
| BUG 已修 | `#34D399` 绿 | 标题划线 `scaleX` 0→1 从左展开 |

强调色可切换：靛蓝 / 青 / 橙 / 紫。

### 动效清单（全部用 Motion，弹簧参数统一）

```ts
// 统一弹簧：快、有回弹、不飘
const spring = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }
const soft   = { type: 'spring', stiffness: 260, damping: 28 }
```

| 场景 | 动效 |
| --- | --- |
| 列表项新增 | 高度 0→auto + 透明度 + y 8px 上浮，spring |
| 列表项删除 | 高度→0 + 透明度→0，180ms，其余项 `layout` 平滑补位 |
| 状态切换 | 卡片在列间移动用共享 `layoutId`，落地时目标列短暂高亮 |
| 进度环 | `strokeDashoffset` 600ms 缓动 + 数字 `useSpring` 滚动 |
| 按钮点击 | `scale: 0.96` → 回弹，60ms |
| 悬浮卡片 | `y: -2` + 光晕跟随鼠标（radial-gradient 用 CSS 变量驱动） |
| 弹窗进入 | y 12px 上浮 + 透明度 + `blur(8px)`→0，260ms spring |
| 弹窗退出 | 更快更轻，180ms ease-out（进出不对称才不拖沓） |
| 展开/收起 | 窗口尺寸变化用共享布局过渡，内容交叉淡入 |
| 尊重系统设置 | `prefers-reduced-motion` 时全部退化为淡入淡出 |

**关键取舍**：动画只跑 `transform` 和 `opacity`（GPU 合成），避免动 `width/height/top/left`。列表项高度变化交给 Motion 的 `layout`，它内部用 transform 实现，不掉帧。

---

## 五、技术选型

### 推荐：Tauri 2 + React 19 + TypeScript + Vite + Tailwind v4 + Motion + SQLite

| 维度 | Tauri 2 | Electron |
| --- | --- | --- |
| 安装包体积 | **~10 MB** | ~150 MB |
| 常驻内存 | **~70–110 MB** | ~220–320 MB |
| 动画流畅度 | WebView2（Chromium 内核，GPU 合成）**同级** | Chromium，同级 |
| 置顶/无边框/透明/穿透 | 原生支持，一行配置 | 支持，需手写 |
| 托盘 / 全局快捷键 / 自启 | 官方插件 | 需第三方 |
| 数据存储 | `tauri-plugin-sql`（SQLite，纯本地） | 需打包 better-sqlite3 原生模块 |
| 代价 | **需装 Rust 工具链**（rustup + MSVC Build Tools，约 20 分钟，一次性） | 无需额外安装 |

> 对一个**全天常驻、钉在屏幕上**的小工具，内存和体积的差距是体验级的。
> 但前端代码 100% 可复用——先写前端，后端壳随时能换。

### 前端依赖清单

```
react 19 · typescript · vite
@tauri-apps/api · @tauri-apps/plugin-sql · @tauri-apps/plugin-global-shortcut
@tauri-apps/plugin-autostart · @tauri-apps/plugin-notification
tailwindcss v4 · motion（即 Framer Motion 11+）
@dnd-kit/core（看板拖拽）· zustand（状态）· zod（校验）· date-fns
```

### Tauri 窗口配置要点

```jsonc
{
  "alwaysOnTop": true,        // 置顶
  "decorations": false,       // 无边框
  "transparent": false,       // Mica 与 transparent 互斥，选 Mica 更稳
  "skipTaskbar": true,        // 不进任务栏
  "resizable": true,
  "width": 320, "height": 420,
  "minWidth": 300, "minHeight": 320
}
```

- 圆角：Win11 用 Mica 自带系统圆角；Win10 退化为 CSS 圆角 + `transparent: true`
- 拖动：`data-tauri-drag-region` 属性即可，无需手写鼠标事件
- 位置记忆：监听 `move` 事件（节流 500ms）写入 SQLite，启动时恢复

---

## 六、数据模型（SQLite）

```sql
CREATE TABLE project (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT,
  sort       INTEGER DEFAULT 0,
  archived   INTEGER DEFAULT 0
);

CREATE TABLE plan (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER REFERENCES project(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  detail      TEXT DEFAULT '',      -- 方案描述
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft|doing|done|failed|parked|dropped
  priority    INTEGER DEFAULT 1,    -- 0低 1中 2高 3紧急
  expect      TEXT DEFAULT '',      -- 预期结果
  result      TEXT DEFAULT '',      -- 实际结果
  lesson      TEXT DEFAULT '',      -- 复盘结论
  tags        TEXT DEFAULT '[]',    -- JSON array
  refs        TEXT DEFAULT '[]',    -- JSON array: 文件路径 / commit / 链接
  pinned      INTEGER DEFAULT 0,
  sort        INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  started_at  TEXT,
  finished_at TEXT
);

CREATE TABLE bug (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER REFERENCES project(id) ON DELETE SET NULL,
  plan_id     INTEGER REFERENCES plan(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  repro       TEXT DEFAULT '',      -- 复现步骤
  severity    TEXT DEFAULT 'normal',-- low|normal|high|blocker
  status      TEXT DEFAULT 'open',  -- open|fixing|fixed|verified|wontfix
  fix_note    TEXT DEFAULT '',
  fix_commit  TEXT DEFAULT '',
  fixed_at    TEXT,
  tags        TEXT DEFAULT '[]',
  refs        TEXT DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE event (            -- 时间线，只增不改
  id         INTEGER PRIMARY KEY,
  entity     TEXT NOT NULL,     -- plan|bug
  entity_id  INTEGER NOT NULL,
  kind       TEXT NOT NULL,     -- create|status|comment|checkin|fix
  from_value TEXT,
  to_value   TEXT,
  note       TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE checkin (
  id          INTEGER PRIMARY KEY,
  entity      TEXT,
  entity_id   INTEGER,
  question    TEXT,
  answer      TEXT,
  answered_at TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE INDEX idx_plan_status ON plan(status);
CREATE INDEX idx_bug_status  ON bug(status);
CREATE INDEX idx_event_ref   ON event(entity, entity_id, created_at);
```

- 数据库位置：`%APPDATA%\PinPlan\pinplan.db`
- 每次写操作同时写 `event`，时间线天然完整
- 导出：Markdown（按项目/日期分组）+ JSON 全量备份
- 迁移：`user_version` pragma 递增，启动时顺序执行 migration 脚本

---

## 七、巡检调度

| 模式 | 说明 |
| --- | --- |
| 固定间隔 | 每 25 / 45 / 60 / 90 分钟问一次 |
| 番茄钟 | 25 分钟工作 → 5 分钟休息，休息时问「刚才那条推进了吗」 |
| 智能 | 只在有 `doing` 条目时才问；超过 2h 没动的条目优先问 |

规则：
- 同一时间只弹一个，队列化，避免轰炸
- 一轮内最多问 3 条（按 `updated_at` 最久优先）
- 连续答「还在做」≥3 次 → 文案升级为「要不要先搁置它？」
- 连续答「卡住了」≥2 次 → 建议记一条 Bug 或拆成子任务
- 免打扰时段 / 全屏应用 / 电池低电量 → 静默，攒到下次唤醒时合并成一条汇总

调度实现：Rust 侧 `tokio::time::interval` + `app.emit("checkin:due", payload)`，前端只负责渲染。这样即使前端窗口被隐藏，计时依然准确。

---

## 八、里程碑

| 阶段 | 交付物 | 验收标准 |
| --- | --- | --- |
| **M1 骨架** | Tauri 窗口（置顶/无边框/拖动/位置记忆/托盘）+ 玻璃质感 UI 壳 | 能钉在桌面角落，重启后回到原位 |
| **M2 数据层** | SQLite schema + migration + CRUD + 状态机 + 事件写入 | 所有操作持久化，时间线正确 |
| **M3 钉子小窗** | 列表、快速新增、状态切换、进度环 | 新增一条计划 < 2 秒，动画不丢帧 |
| **M4 巡检弹窗** | 调度器、免打扰、快捷回答回写 | 到点弹窗，点一下即改状态 |
| **M5 主窗** | 看板拖拽、详情编辑、时间线、搜索过滤 | 拖拽跨列丝滑，编辑即时保存 |
| **M6 打磨** | 主题切换、导出、开机自启、全局快捷键 | 全套动效统一，`prefers-reduced-motion` 生效 |

**全局快捷键**（可改）：
- `Alt+Space` 呼出/隐藏小窗
- `Alt+N` 快速新增计划
- `Alt+B` 快速记 Bug

---

## 九、后续可扩展

- Git 联动：从最近 commit 自动提取「修了什么」，一键转成计划/复盘
- 周报导出：本周成功 / 失败 / 放弃各多少，失败原因聚类
- 计划依赖：A 未完成则 B 变灰
- 本地 LLM（Ollama）辅助生成复盘文案（纯本地，可选开关）
- 番茄钟白噪音、专注时长热力图

mod winstate;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:pinplan.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init schema",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "image attachments",
            sql: include_str!("../migrations/0002_attachment.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

fn toggle_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "显示 / 隐藏", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick", "快速记一条计划", true, None::<&str>)?;
    let bug = MenuItem::with_id(app, "bug", "快速记一个 BUG", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出 PinPlan", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &quick, &bug, &sep, &quit])?;

    TrayIconBuilder::with_id("pinplan-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("PinPlan · 钉子计划")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_main(app),
            "quick" => {
                let _ = app.emit("pinplan://quick-add", "plan");
            }
            "bug" => {
                let _ = app.emit("pinplan://quick-add", "bug");
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// 把导出内容写到「我的文档 / PinPlan」，返回绝对路径。
#[tauri::command]
fn save_export(app: AppHandle, filename: String, content: String) -> Result<String, String> {
    let dir = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("PinPlan");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let safe: String = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || "._-".contains(*c))
        .collect();
    let name = if safe.is_empty() {
        "pinplan-export.md".to_string()
    } else {
        safe
    };

    let path = dir.join(name);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 在资源管理器里打开某个路径。
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
    }
    Ok(())
}

/// 返回当前窗口所在显示器的工作区（排除任务栏），用于把弹窗贴到真正的右下角。
#[tauri::command]
fn monitor_work_area(window: tauri::Window) -> Result<serde_json::Value, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let area = monitor.work_area();
    Ok(serde_json::json!({
        "x": area.position.x,
        "y": area.position.y,
        "w": area.size.width,
        "h": area.size.height,
    }))
}

/// 退出应用（托盘菜单之外的另一个可发现入口）。
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/* ==================================================================
   边缘小钉（Edge Pin）
   窗口本身会随状态改变尺寸：收起时是一条贴边细条，展开时是圆形图标，
   冒气泡时窗口临时变宽以容纳提示文字。
   ================================================================== */

/// 展开后的图标窗口边长（逻辑像素）
const DOCK_ICON: i32 = 56;
/// 收起后贴边细条的厚度
const DOCK_TUCK_THICK: i32 = 18;
/// 收起后贴边细条的长度
const DOCK_TUCK_LEN: i32 = 52;
/// 气泡区域长度
const DOCK_BUBBLE_LEN: i32 = 214;
/// 右键菜单内容宽 / 高
const DOCK_MENU_W: i32 = 168;
const DOCK_MENU_H: i32 = 156;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct DockState {
    /// left | right | top | free
    edge: String,
    /// 贴边时是沿边偏移；自由模式未使用
    offset: i32,
    mode: String,
    /// 自由悬浮时图标左上角坐标
    #[serde(default)]
    x: i32,
    #[serde(default)]
    y: i32,
}

impl Default for DockState {
    fn default() -> Self {
        Self {
            edge: "right".to_string(),
            offset: -1,
            mode: "tucked".to_string(),
            x: 0,
            y: 0,
        }
    }
}

fn dock_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("dock.json"))
}

fn save_dock(app: &AppHandle, st: &DockState) {
    let Some(path) = dock_path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string_pretty(st) {
        let _ = std::fs::write(path, json);
    }
}

/// 读取上次记住的边缘与位置。
#[tauri::command]
fn dock_load(app: AppHandle) -> DockState {
    dock_path(&app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|t| serde_json::from_str::<DockState>(&t).ok())
        .unwrap_or_default()
}

/// 按「边缘 + 偏移 + 形态」重新计算并应用窗口的尺寸与位置。
#[tauri::command]
fn dock_place(
    app: AppHandle,
    window: tauri::Window,
    edge: String,
    offset: i32,
    mode: String,
) -> Result<serde_json::Value, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let area = monitor.work_area();
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let px = |v: i32| -> i32 { (v as f64 * scale).round() as i32 };

    // 菜单窗口必须完全覆盖气泡窗口的范围：
    // 否则从「气泡」切到「菜单」时窗口会缩窄，鼠标瞬间落到窗口外触发 mouseleave，菜单立刻被关掉。
    let menu_w_side = (DOCK_ICON + DOCK_MENU_W + 24).max(DOCK_ICON + DOCK_BUBBLE_LEN);
    let menu_w_top = (DOCK_MENU_W + 16).max(DOCK_ICON + DOCK_BUBBLE_LEN);

    let (w, h) = match (edge.as_str(), mode.as_str()) {
        ("top", "tucked") => (px(DOCK_TUCK_LEN), px(DOCK_TUCK_THICK)),
        (_, "tucked") => (px(DOCK_TUCK_THICK), px(DOCK_TUCK_LEN)),
        (_, "bubble") => (px(DOCK_ICON + DOCK_BUBBLE_LEN), px(DOCK_ICON)),
        ("top", "menu") => (px(menu_w_top), px(DOCK_ICON + DOCK_MENU_H)),
        (_, "menu") => (px(menu_w_side), px(DOCK_MENU_H)),
        (_, _) => (px(DOCK_ICON), px(DOCK_ICON)),
    };

    // 窗口左上角相对「图标锚点」的偏移：保证切换形态时图标在屏幕上不动。
    // 顶边菜单靠左对齐（图标在左上），这样窗口向右扩，能盖住气泡区域。
    let (ax, ay) = match (edge.as_str(), mode.as_str()) {
        ("top", "menu") => (0, 0),
        (_, "menu") => (0, -(px(DOCK_MENU_H) - px(DOCK_ICON)) / 2),
        _ => (0, 0),
    };

    let wx = area.position.x;
    let wy = area.position.y;
    let ww = area.size.width as i32;
    let wh = area.size.height as i32;
    let pad = px(6);

    // 锚点 = 图标沿边方向的左上角坐标（-1 表示居中）
    let anchor = if offset < 0 {
        if edge == "top" {
            wx + (ww - px(DOCK_ICON)) / 2
        } else {
            wy + (wh - px(DOCK_ICON)) / 2
        }
    } else {
        offset
    };

    let (x, y, saved) = match edge.as_str() {
        "left" => {
            let min = wy + pad;
            let max = (wy + wh - h - pad).max(min);
            let y = (anchor + ay).clamp(min, max);
            (wx, y, y - ay)
        }
        "top" => {
            let min = wx + pad;
            let max = (wx + ww - w - pad).max(min);
            let x = (anchor + ax).clamp(min, max);
            (x, wy, x - ax)
        }
        _ => {
            let min = wy + pad;
            let max = (wy + wh - h - pad).max(min);
            let y = (anchor + ay).clamp(min, max);
            (wx + ww - w, y, y - ay)
        }
    };

    let _ = window.set_size(tauri::PhysicalSize::new(w as u32, h as u32));
    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));

    let st = DockState {
        edge: edge.clone(),
        offset: saved,
        mode: mode.clone(),
        x: 0,
        y: 0,
    };
    save_dock(&app, &st);

    Ok(serde_json::json!({
        "edge": edge,
        "offset": saved,
        "mode": mode,
        "x": x,
        "y": y,
        "w": w,
        "h": h,
        "scale": scale,
        "side": "right",
    }))
}

/// 自由悬浮：图标停在用户放下的位置，不贴边。
///
/// 气泡/菜单优先向右展开，右边放不下就向左。
#[tauri::command]
fn dock_place_free(
    app: AppHandle,
    window: tauri::Window,
    x: i32,
    y: i32,
    mode: String,
) -> Result<serde_json::Value, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let area = monitor.work_area();
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let px = |v: i32| -> i32 { (v as f64 * scale).round() as i32 };

    let icon = px(DOCK_ICON);
    let (w, h) = match mode.as_str() {
        "bubble" => (px(DOCK_ICON + DOCK_BUBBLE_LEN + 24), icon),
        "menu" => (px(DOCK_ICON + DOCK_MENU_W + 24), px(DOCK_MENU_H)),
        _ => (icon, icon),
    };

    let wx = area.position.x;
    let wy = area.position.y;
    let ww = area.size.width as i32;
    let wh = area.size.height as i32;

    // 图标左上角就是用户放下的位置（夹进工作区）
    let icon_x = x.clamp(wx, (wx + ww - icon).max(wx));
    let icon_y = y.clamp(wy, (wy + wh - icon).max(wy));

    let side = if w > icon && icon_x + w > wx + ww {
        "left"
    } else {
        "right"
    };
    let want_x = if side == "left" {
        icon_x + icon - w
    } else {
        icon_x
    };

    let win_x = want_x.clamp(wx, (wx + ww - w).max(wx));
    let win_y = icon_y.clamp(wy, (wy + wh - h).max(wy));

    let _ = window.set_size(tauri::PhysicalSize::new(w as u32, h as u32));
    let _ = window.set_position(tauri::PhysicalPosition::new(win_x, win_y));

    let st = DockState {
        edge: "free".to_string(),
        offset: 0,
        mode: mode.clone(),
        x: icon_x,
        y: icon_y,
    };
    save_dock(&app, &st);

    Ok(serde_json::json!({
        "edge": "free",
        "offset": 0,
        "mode": mode,
        "x": win_x,
        "y": win_y,
        "w": w,
        "h": h,
        "scale": scale,
        "side": side,
        "iconX": icon_x,
        "iconY": icon_y,
    }))
}

/// 给窗口上「玻璃底」。
///
/// 亚克力（acrylic）观感最好，但每帧都要让 DWM 重新模糊窗口背后的桌面，
/// 实测比无玻璃多约 1 帧合成时间；在虚拟显示 / 远程桌面驱动上会被进一步放大。
/// 所以做成可切换：acrylic / blur / none。
#[cfg(target_os = "windows")]
fn apply_glass(win: &tauri::WebviewWindow, mode: &str, tint: (u8, u8, u8, u8)) {
    let _ = window_vibrancy::clear_acrylic(win);
    let _ = window_vibrancy::clear_blur(win);
    match mode {
        "none" => {}
        "blur" => {
            let _ = window_vibrancy::apply_blur(win, Some(tint));
        }
        _ => {
            let _ = window_vibrancy::apply_acrylic(win, Some(tint));
        }
    }
}

#[cfg(target_os = "windows")]
fn glass_mode_from_env() -> String {
    std::env::var("PINPLAN_GLASS").unwrap_or_else(|_| "acrylic".to_string())
}

/// 运行时切换玻璃效果（设置面板调用）。
#[tauri::command]
fn set_glass_mode(app: AppHandle, mode: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(win) = app.get_webview_window("main") {
            apply_glass(&win, &mode, (16, 17, 21, 190));
        }
        if let Some(win) = app.get_webview_window("popup") {
            apply_glass(&win, &mode, (16, 17, 21, 205));
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, mode);
    }
    Ok(())
}

pub fn run() {
    let app = tauri::Builder::default()
        // 单实例必须最先注册：再次启动时只把已有窗口叫到前面，不再开第二套托盘和小钉
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            save_export,
            open_path,
            monitor_work_area,
            quit_app,
            dock_load,
            dock_place,
            dock_place_free,
            set_glass_mode
        ])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    match shortcut.to_string().to_lowercase().as_str() {
                        "alt+space" => toggle_main(app),
                        "alt+n" => {
                            let _ = app.emit("pinplan://quick-add", "plan");
                        }
                        "alt+b" => {
                            let _ = app.emit("pinplan://quick-add", "bug");
                        }
                        _ => {}
                    }
                })
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();

            if let Some(win) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                {
                    // 启动先用默认值，前端读到设置后会立刻校正
                    apply_glass(&win, &glass_mode_from_env(), (16, 17, 21, 190));
                }
                winstate::restore(&win);
                let _ = win.show();
            }

            if let Some(popup) = app.get_webview_window("popup") {
                #[cfg(target_os = "windows")]
                {
                    apply_glass(&popup, &glass_mode_from_env(), (16, 17, 21, 205));
                }
            }

            // 小钉刻意不套用系统亚克力：窗口会在贴边细条/图标/气泡之间变尺寸，
            // 亚克力会把整块窗口矩形都染上色，露出多余的暗块。
            // 它的质感由 Web 层自己画（实底 + 描边 + 呼吸光晕）。

            let gs = app.global_shortcut();
            for s in ["Alt+Space", "Alt+N", "Alt+B"] {
                let _ = gs.register(s);
            }

            build_tray(&handle)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if matches!(
                    event,
                    tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_)
                ) {
                    if let Some(win) = window.get_webview_window(window.label()) {
                        winstate::schedule_save(&win);
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building PinPlan");

    app.run(|_handle, event| {
        // 退出兜底：托盘 / 全局快捷键 / WebView2 的 teardown 在某些时序下可能拖住
        // 事件循环的收尾，这里在事件循环结束后直接结束进程，保证不留半死进程。
        if let tauri::RunEvent::Exit = event {
            std::process::exit(0);
        }
    });
}

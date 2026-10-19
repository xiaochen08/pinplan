//! 主窗位置 / 尺寸的本地记忆。
//!
//! 拖动和缩放事件触发非常密集，这里做两件事：
//! 1. 事件线程只递增一个计数器（极轻量），**不做任何窗口查询**；
//! 2. 后台线程等到连续 500ms 没有新事件才真正读取几何并落盘。

use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct WinState {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
}

/// 移动/缩放事件的序号，用来判断“还在动”还是“停下来了”。
static GEN: AtomicU64 = AtomicU64::new(0);
static WORKER: AtomicBool = AtomicBool::new(false);

fn state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("window.json"))
}

fn read(win: &WebviewWindow) -> Option<WinState> {
    let pos = win.outer_position().ok()?;
    let size = win.outer_size().ok()?;
    Some(WinState {
        x: pos.x,
        y: pos.y,
        w: size.width,
        h: size.height,
    })
}

fn write(app: &AppHandle, st: &WinState) {
    let Some(path) = state_path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string_pretty(st) {
        let _ = std::fs::write(path, json);
    }
}

/// 启动时恢复上次的位置和尺寸；若已跑到屏幕外则拉回主显示器。
pub fn restore(win: &WebviewWindow) {
    let app = win.app_handle();
    let Some(path) = state_path(app) else { return };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return;
    };
    let Ok(st) = serde_json::from_str::<WinState>(&text) else {
        return;
    };

    let on_screen = win
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .any(|m| {
            let mp = m.position();
            let ms = m.size();
            st.x + st.w as i32 > mp.x
                && st.x < mp.x + ms.width as i32
                && st.y + 40 > mp.y
                && st.y < mp.y + ms.height as i32
        });

    if on_screen {
        let _ = win.set_position(PhysicalPosition::new(st.x, st.y));
    } else if let Ok(Some(m)) = win.primary_monitor() {
        let ms = m.size();
        let _ = win.set_position(PhysicalPosition::new(
            ms.width as i32 - st.w as i32 - 48,
            96,
        ));
    }

    if st.w >= 300 && st.h >= 320 {
        let _ = win.set_size(PhysicalSize::new(st.w, st.h));
    }
}

/// 事件线程调用的轻量入口：只计数，不查询。
pub fn schedule_save(win: &WebviewWindow) {
    GEN.fetch_add(1, Ordering::SeqCst);
    if WORKER.swap(true, Ordering::SeqCst) {
        return;
    }

    let win = win.clone();
    thread::spawn(move || {
        let mut seen = GEN.load(Ordering::SeqCst);
        loop {
            thread::sleep(Duration::from_millis(500));
            let now = GEN.load(Ordering::SeqCst);
            if now != seen {
                seen = now;
                continue; // 还在动，再等一轮
            }
            break; // 连续 500ms 静止，可以落盘了
        }

        if let Some(st) = read(&win) {
            write(&win.app_handle().clone(), &st);
        }
        WORKER.store(false, Ordering::SeqCst);
    });
}

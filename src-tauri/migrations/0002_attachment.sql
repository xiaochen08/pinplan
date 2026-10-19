-- 图片附件
-- 版本 2：详情面板里粘贴的截图
--
-- 为什么用 data URL 存在库里，而不是存文件 + asset 协议：
-- 省掉文件协议的作用域配置和权限，备份/导出也天然带上图。
-- 代价是库会变大，所以前端会先把图等比压到长边 1600、WebP 0.82，
-- 一张截图通常 150–350 KB，不会失控。

CREATE TABLE IF NOT EXISTS attachment (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT    NOT NULL,          -- 'plan' | 'bug'
  entity_id  INTEGER NOT NULL,
  name       TEXT    DEFAULT '',
  mime       TEXT    NOT NULL,
  width      INTEGER DEFAULT 0,
  height     INTEGER DEFAULT 0,
  bytes      INTEGER DEFAULT 0,
  data       TEXT    NOT NULL,          -- data:image/webp;base64,...
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachment_ref ON attachment(entity, entity_id, created_at);

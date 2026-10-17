-- D1 数据库初始化脚本
-- 在 Cloudflare Dashboard 中运行此脚本创建表

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  value INTEGER NOT NULL DEFAULT 3,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  code TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 3,
  time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 插入默认管理员密码
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pwd', 'cyber888');

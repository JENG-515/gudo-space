-- ===================================================================
-- GUDO Space — Supabase 資料庫 Schema
-- 用法：Supabase 專案 → SQL Editor → 貼上執行
-- 後端以 service_role key 存取（繞過 RLS）；啟用 RLS 但不開公開政策，
-- 確保只有後端能讀寫（前台皆透過後端 API）。
-- ===================================================================

-- 1) 網站內容（單一 jsonb 文件，對應原本的 content.json）
create table if not exists app_content (
  id   int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into app_content (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- 2) 最新消息（部落格）
create table if not exists posts (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  title      text not null default '未命名',
  date       date not null default current_date,
  category   text default '',
  cover      text default '',
  excerpt    text default '',
  body       text default '',
  published  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists posts_pub_date_idx on posts (published, date desc);

-- 3) 活動紀實
create table if not exists chronicles (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  title      text not null default '未命名',
  date       date not null default current_date,
  location   text default '',
  cover      text default '',
  gallery    jsonb not null default '[]'::jsonb,
  excerpt    text default '',
  body       text default '',
  published  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists chronicles_pub_date_idx on chronicles (published, date desc);

-- 4) 預約收單
create table if not exists submissions (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status     text not null default 'new',   -- new / contacted / done
  name       text not null,
  phone      text not null,
  email      text default '',
  line       text default '',
  interest   jsonb not null default '[]'::jsonb,
  timeline   jsonb not null default '[]'::jsonb,
  identity   jsonb not null default '[]'::jsonb,
  visit      jsonb not null default '[]'::jsonb,
  slot       text default '',
  note       text default '',
  ip         text default ''
);
create index if not exists submissions_created_idx on submissions (created_at desc);

-- 5) 後台帳號（密碼雜湊沿用 werkzeug pbkdf2）
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  name          text default '',
  role          text not null default 'editor',  -- owner / editor
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- 6) 啟用 RLS（不建立公開政策；service_role 會繞過 RLS）
alter table app_content enable row level security;
alter table posts       enable row level security;
alter table chronicles  enable row level security;
alter table submissions enable row level security;
alter table app_users   enable row level security;

-- ===================================================================
-- Storage：到 Supabase → Storage 建立一個 public bucket，命名為「media」
--   （圖庫照片、封面、logo 都放這裡；前台以公開網址讀取）
-- ===================================================================

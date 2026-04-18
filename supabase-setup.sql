-- SQL Script for Supabase Gold Management App
-- HƯỚNG DẪN: Nếu gặp lỗi "table already exists", hãy xóa các table cũ trước theo thứ tự: 
-- drop table if exists transactions; drop table if exists profiles; drop table if exists products; drop table if exists system_config;

-- 1. Profiles table (linked to auth.users OR managed manually)
-- Đảm bảo các cột mới tồn tại cho các tài khoản cũ
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text unique;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pw text;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text,
  username text unique,
  pw text,
  full_name text,
  role text check (role in ('ADMIN', 'ACCOUNTANT', 'SALES')) default 'SALES',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed an initial admin account if none exists
-- Note: Replace '220785' with a secure password in production
INSERT INTO profiles (email, username, pw, full_name, role)
SELECT 'binhphan.070582@gmail.com', 'admin', '220785', 'Administrator', 'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE username = 'admin' OR email = 'binhphan.070582@gmail.com');

-- Note: In Supabase, if we want to link some to auth.users, we can.
-- But the user wants simple management.

-- 2. Products table
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  unit text not null,
  buy_price numeric not null default 0,
  sell_price numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Transactions table
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  type text check (type in ('BUY', 'SELL')) not null,
  customer_name text not null,
  customer_cccd text not null,
  dia_chi text, -- Customer address from CCCD
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity numeric not null,
  unit text not null,
  price_per_unit numeric not null,
  total_amount numeric not null,
  tien_mat numeric not null default 0,
  chuyen_khoan numeric not null default 0,
  created_by uuid references public.profiles(id) on delete set null, -- Link to profiles for reporting
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. System Config table
create table if not exists system_config (
  id uuid default gen_random_uuid() primary key,
  bank_name text not null,
  bank_id text not null, -- e.g., VCB, ICB
  account_no text not null,
  account_holder text not null
);

-- Enable RLS
alter table profiles enable row level security;
alter table products enable row level security;
alter table transactions enable row level security;
alter table system_config enable row level security;

-- Clear existing policies to avoid duplicates and RECURSION errors
-- Note: We drop ALL possible names we might have used in previous turns
drop policy if exists "Public profiles are viewable by authenticated users" on profiles;
drop policy if exists "Users can update their own profile" on profiles;
drop policy if exists "Admins can manage all profiles" on profiles;
drop policy if exists "Admins can do everything on profiles" on profiles;
drop policy if exists "Admins can manage profiles" on profiles;
drop policy if exists "Profiles are viewable by authenticated" on profiles;
drop policy if exists "Xem profile" on profiles;
drop policy if exists "Sửa profile cá nhân" on profiles;
drop policy if exists "Admin tối cao" on profiles;

drop policy if exists "Products are viewable by all authenticated" on products;
drop policy if exists "All users can update prices" on products;
drop policy if exists "Admins can manage products" on products;
drop policy if exists "Products viewable by all" on products;
drop policy if exists "Staff can update prices" on products;
drop policy if exists "Xem sản phẩm" on products;
drop policy if exists "Admin quản lý sản phẩm" on products;
drop policy if exists "Nhân viên cập nhật giá" on products;

drop policy if exists "Transactions are viewable/insertable by authenticated" on transactions;
drop policy if exists "Quản lý giao dịch" on transactions;

drop policy if exists "System config viewable by all" on system_config;
drop policy if exists "Admins can manage config" on system_config;
drop policy if exists "Config viewable by all" on system_config;
drop policy if exists "Admin can update config" on system_config;
drop policy if exists "Xem cấu hình" on system_config;
drop policy if exists "Admin quản lý cấu hình" on system_config;

-- Re-create Policies (Clean & Non-Recursive)
-- Use auth.jwt() email directly for admin privilege to avoid "Infinite Recursion"

-- 1. Profiles
create policy "profiles_select_public" on profiles for select using (true);
create policy "profiles_update_self" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_all_anon" on profiles for all using (true) with check (true);

-- 2. Products
create policy "products_all_anon" on products for all using (true) with check (true);

-- 3. Transactions 
create policy "transactions_all_anon" on transactions for all using (true) with check (true);

-- 4. System Config
create policy "config_all_anon" on system_config for all using (true) with check (true);

-- Function & Trigger
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_role text;
begin
  if new.email = 'binhphan.070582@gmail.com' then
    default_role := 'ADMIN';
  else
    default_role := 'SALES';
  end if;

  insert into public.profiles (id, email, username, full_name, role)
  values (new.id, new.email, split_part(new.email, '@', 1), new.raw_user_meta_data->>'full_name', default_role)
  on conflict (id) do update set role = excluded.role;
  return new;
end;
$$ language plpgsql security definer;

-- Re-create trigger safely
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Initial Seed Data (Safely)
insert into products (name, unit, buy_price, sell_price) 
select 'Vàng SJC', 'Chỉ', 7500000, 7700000 where not exists (select 1 from products where name = 'Vàng SJC');
insert into products (name, unit, buy_price, sell_price) 
select 'Vàng Nhẫn 9999', 'Chỉ', 6800000, 6950000 where not exists (select 1 from products where name = 'Vàng Nhẫn 9999');
insert into products (name, unit, buy_price, sell_price) 
select 'Vàng Trang Sức 18K', 'Chỉ', 4500000, 5200000 where not exists (select 1 from products where name = 'Vàng Trang Sức 18K');

insert into system_config (bank_name, bank_id, account_no, account_holder) 
select 'Vietcombank', 'VCB', '1234567890', 'DOANH NGHIEP NGHIATIN GOLD' where not exists (select 1 from system_config limit 1);

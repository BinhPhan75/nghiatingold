-- SQL Script for Supabase Gold Management App
-- HƯỚNG DẪN: Nếu gặp lỗi "table already exists", hãy xóa các table cũ trước theo thứ tự: 
-- drop table if exists transactions; drop table if exists profiles; drop table if exists products; drop table if exists system_config;

-- 1. Profiles table (linked to auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text check (role in ('ADMIN', 'ACCOUNTANT', 'SALES')) default 'SALES',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

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
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity numeric not null,
  unit text not null,
  price_per_unit numeric not null,
  total_amount numeric not null,
  created_by uuid references auth.users(id) on delete set null,
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

-- Clear existing policies to avoid duplicates
drop policy if exists "Public profiles are viewable by authenticated users" on profiles;
drop policy if exists "Users can update their own profile" on profiles;
drop policy if exists "Admins can manage all profiles" on profiles;
drop policy if exists "Products are viewable by all authenticated" on products;
drop policy if exists "All users can update prices" on products;
drop policy if exists "Admins can manage products" on products;
drop policy if exists "Transactions are viewable/insertable by authenticated" on transactions;
drop policy if exists "System config viewable by all" on system_config;
drop policy if exists "Admins can manage config" on system_config;

-- Re-create Policies
create policy "Public profiles are viewable by authenticated users" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

create policy "Admins can manage all profiles" on profiles
  for all using (
    (auth.jwt() ->> 'email' = 'binhphan.070582@gmail.com')
  );

create policy "Products are viewable by all authenticated" on products
  for select using (auth.role() = 'authenticated');

create policy "All users can update prices" on products
  for update using (auth.role() = 'authenticated');

create policy "Admins can manage products" on products
  for all using (
    (auth.jwt() ->> 'email' = 'binhphan.070582@gmail.com')
  );

create policy "Transactions are viewable/insertable by authenticated" on transactions
  using (auth.role() = 'authenticated');

create policy "System config viewable by all" on system_config
  for select using (auth.role() = 'authenticated');

create policy "Admins can manage config" on system_config
  for all using (
    (auth.jwt() ->> 'email' = 'binhphan.070582@gmail.com')
  );

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

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', default_role)
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

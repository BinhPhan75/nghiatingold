-- SQL Script for Supabase Gold Management App

-- 1. Profiles table (linked to auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text check (role in ('ADMIN', 'ACCOUNTANT', 'SALES')) default 'SALES',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Products table
create table products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  unit text not null,
  buy_price numeric not null default 0,
  sell_price numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Transactions table
create table transactions (
  id uuid default gen_random_uuid() primary key,
  type text check (type in ('BUY', 'SELL')) not null,
  customer_name text not null,
  customer_cccd text not null,
  product_id uuid references products(id),
  product_name text not null,
  quantity numeric not null,
  unit text not null,
  price_per_unit numeric not null,
  total_amount numeric not null,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. System Config table
create table system_config (
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

-- Policies
create policy "Public profiles are viewable by authenticated users" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update their own profile" on profiles
  for update using (auth.uid() = id);

create policy "Admins can do everything on profiles" on profiles
  using (exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN'));

create policy "Products are viewable by all authenticated" on products
  for select using (auth.role() = 'authenticated');

create policy "All users can update prices" on products
  for update using (auth.role() = 'authenticated');

create policy "Transactions are viewable/insertable by authenticated" on transactions
  using (auth.role() = 'authenticated');

create policy "System config viewable by all, editable by admin" on system_config
  for select using (auth.role() = 'authenticated');

create policy "Admin can update config" on system_config
  for update using (exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN'));

-- Trigger for profile on user signup
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
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', default_role);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Initial Seed Data
insert into products (name, unit, buy_price, sell_price) values
('Vàng SJC', 'Chỉ', 7500000, 7700000),
('Vàng Nhẫn 9999', 'Chỉ', 6800000, 6950000),
('Vàng Trang Sức 18K', 'Chỉ', 4500000, 5200000);

insert into system_config (bank_name, bank_id, account_no, account_holder) values
('Vietcombank', 'VCB', '1234567890', 'DOANH NGHIEP NGHIATIN GOLD');

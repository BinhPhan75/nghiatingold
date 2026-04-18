export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'SALES';

export interface Profile {
  id: string;
  email: string;
  username?: string;
  pw?: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  unit: string; // e.g., Chỉ, Lượng, Gram
  buy_price: number;
  sell_price: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL';
  customer_name: string;
  customer_cccd: string;
  dia_chi?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_amount: number;
  tien_mat: number;
  chuyen_khoan: number;
  created_at: string;
  created_by: string;
  salesperson?: {
    email: string;
    full_name: string;
  };
}

export interface SystemConfig {
  id: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  bank_id: string; // e.g., ICB for VietinBank, VCB for Vietcombank
}

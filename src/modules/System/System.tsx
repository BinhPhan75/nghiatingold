import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, SystemConfig, Profile, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Save, UserPlus, Users, Tag, Building2, ShieldCheck, Download, Upload, Plus, Trash2, X } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

const System: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'prices' | 'users' | 'bank' | 'backup'>('prices');

  const tabs = [
    { id: 'prices', label: 'Giá Vàng', roles: ['ADMIN', 'SALES'] },
    { id: 'users', label: 'Nhân Viên', roles: ['ADMIN'] },
    { id: 'bank', label: 'Ngân Hàng', roles: ['ADMIN'] },
    { id: 'backup', label: 'Bảo Trì', roles: ['ADMIN'] },
  ];

  const filteredTabs = tabs.filter(t => t.roles.includes(profile?.role || ''));
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', unit: '', buy_price: 0, sell_price: 0 });

  useEffect(() => {
    fetchProducts();
    fetchConfig();
    if (isAdmin || activeTab === 'users') fetchProfiles();
  }, [activeTab]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const fetchConfig = async () => {
    const { data } = await supabase.from('system_config').select('*').single();
    if (data) setConfig(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('role');
    if (data) setProfiles(data);
  };

  const handleUpdatePrice = async (id: string, field: 'buy_price' | 'sell_price', value: number) => {
    const { error } = await supabase
      .from('products')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) fetchProducts();
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.unit) return;

    const { error } = await supabase
      .from('products')
      .insert([newProduct]);

    if (!error) {
      fetchProducts();
      setShowAddProduct(false);
      setNewProduct({ name: '', unit: '', buy_price: 0, sell_price: 0 });
    } else {
      alert("Lỗi khi thêm mặt hàng");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa mặt hàng này?")) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (!error) fetchProducts();
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    const { error } = await supabase
      .from('system_config')
      .update({
        bank_name: config.bank_name,
        account_no: config.account_no,
        account_holder: config.account_holder,
        bank_id: config.bank_id
      })
      .eq('id', config.id);

    if (!error) alert("Đã cập nhật cấu hình hệ thống");
  };

  const handleBackup = () => {
    const data = { products, config, profiles, transactions: [] }; // Mock backup
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nghiatin-gold-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-4xl text-ink">Hệ Thống</h1>
          <p className="text-[10px] uppercase font-black text-neutral-400 tracking-widest mt-2 px-1">Cấu hình & Quản trị</p>
        </div>
        <div className="flex bg-paper p-1 border border-neutral-100 rounded-sm shadow-sm overflow-x-auto">
          {filteredTabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`btn-toggle min-w-[120px] ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-paper p-8 rounded-sm shadow-sm border border-neutral-100 min-h-[500px]">
        {activeTab === 'prices' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <Tag className="text-gold-primary" />
                <h3 className="text-xl">Điều chỉnh giá niêm yết</h3>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setShowAddProduct(true)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase bg-ink text-paper py-2 px-4 hover:bg-gold-primary hover:text-ink transition-all"
                >
                  <Plus size={16} /> Thêm mặt hàng
                </button>
              )}
            </div>

            {showAddProduct && (
              <div className="bg-neutral-50 p-6 border border-neutral-200 mb-6 rounded-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-ink">Thêm mặt hàng mới</h4>
                  <button onClick={() => setShowAddProduct(false)}><X size={18} /></button>
                </div>
                <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="input-field">
                    <label>Tên mặt hàng</label>
                    <input 
                      type="text" 
                      placeholder="VD: Vàng 9999" 
                      value={newProduct.name}
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label>Đơn vị</label>
                    <input 
                      type="text" 
                      placeholder="VD: Chỉ" 
                      value={newProduct.unit}
                      onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label>Giá mua</label>
                    <input 
                      type="number" 
                      value={newProduct.buy_price}
                      onChange={e => setNewProduct({...newProduct, buy_price: Number(e.target.value)})}
                    />
                  </div>
                  <div className="input-field">
                    <label>Giá bán</label>
                    <input 
                      type="number" 
                      value={newProduct.sell_price}
                      onChange={e => setNewProduct({...newProduct, sell_price: Number(e.target.value)})}
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <button type="submit" className="bg-ink text-paper py-2 px-8 font-black uppercase text-[10px] tracking-widest hover:bg-gold-primary hover:text-ink transition-all">
                      Xác nhận thêm
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th className="py-4 font-black uppercase text-[10px] tracking-widest italic text-neutral-400">Mặt hàng</th>
                    <th className="py-4 font-black uppercase text-[10px] tracking-widest italic text-neutral-400">Đơn vị</th>
                    <th className="py-4 font-black uppercase text-[10px] tracking-widest italic text-neutral-400">Giá mua vào</th>
                    <th className="py-4 font-black uppercase text-[10px] tracking-widest italic text-neutral-400">Giá bán ra</th>
                    <th className="py-4 font-black uppercase text-[10px] tracking-widest italic text-neutral-400 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {products.map(p => (
                    <tr key={p.id}>
                      <td className="py-4 font-bold">{p.name}</td>
                      <td className="py-4 font-medium text-neutral-500">{p.unit}</td>
                      <td className="py-4">
                        <input 
                          type="number" 
                          className="w-full md:w-40 p-2 border border-neutral-100 font-mono font-bold text-sm bg-neutral-50 focus:bg-white focus:border-ink outline-none"
                          defaultValue={p.buy_price} 
                          onBlur={(e) => handleUpdatePrice(p.id, 'buy_price', Number(e.target.value))}
                        />
                      </td>
                      <td className="py-4">
                        <input 
                          type="number" 
                          className="w-full md:w-40 p-2 border border-neutral-100 font-mono font-bold text-sm bg-neutral-50 focus:bg-white focus:border-ink outline-none"
                          defaultValue={p.sell_price} 
                          onBlur={(e) => handleUpdatePrice(p.id, 'sell_price', Number(e.target.value))}
                        />
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[9px] font-mono text-neutral-400 block">
                            {new Date(p.updated_at).toLocaleString('vi-VN')}
                          </span>
                          {isAdmin && (
                            <button 
                              onClick={() => handleDeleteProduct(p.id)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="Xóa mặt hàng"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <Users className="text-gold-primary" />
                <h3 className="text-xl">Quản lý nhân sự</h3>
              </div>
              {isAdmin && (
                <button className="flex items-center gap-2 text-[10px] font-black uppercase bg-ink text-paper py-2 px-4 hover:bg-gold-primary hover:text-ink transition-all">
                  <UserPlus size={16} /> Thêm nhân viên
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles.map(p => (
                <div key={p.id} className="p-6 border border-neutral-100 rounded-sm relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rotate-45 opacity-10 transition-transform group-hover:scale-110 ${p.role === 'ADMIN' ? 'bg-red-500' : 'bg-gold-primary'}`}></div>
                  <div className="flex flex-col gap-1 mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{p.role === 'ADMIN' ? 'Quản trị viên' : p.role === 'ACCOUNTANT' ? 'Kế toán' : 'Bán hàng'}</span>
                    <h4 className="text-lg font-bold lowercase italic">{p.full_name}</h4>
                  </div>
                  <div className="text-xs font-medium text-neutral-500 mb-6">
                    <p>{p.email}</p>
                    <p className="mt-1">Tham gia: {new Date(p.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                  {isAdmin && (
                    <button className="text-[10px] font-black uppercase text-neutral-400 hover:text-ink transition-colors">Chỉnh sửa</button>
                  )}
                </div>
              ))}
            </div>
            
            {!isAdmin && (
              <div className="bg-neutral-50 p-4 border-l-4 border-blue-500 flex items-center gap-3 italic text-xs text-neutral-600">
                <ShieldCheck size={18} className="text-blue-500" />
                Chỉ quản trị viên mới có quyền tạo mới hoặc chỉnh sửa thông tin nhân viên.
              </div>
            )}
          </div>
        )}

        {activeTab === 'bank' && (
          <div className="flex flex-col gap-6 max-w-xl">
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-4 mb-4">
              <Building2 className="text-gold-primary" />
              <h3 className="text-xl">Tài khoản doanh nghiệp</h3>
            </div>

            {config && (
              <form onSubmit={handleUpdateConfig} className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="input-field">
                    <label>Ngân hàng</label>
                    <input 
                      type="text" 
                      value={config.bank_name} 
                      onChange={e => setConfig({...config, bank_name: e.target.value})}
                    />
                  </div>
                  <div className="input-field">
                    <label>Mã Bank (VietQR ID)</label>
                    <input 
                      type="text" 
                      value={config.bank_id} 
                      placeholder="VCB, ICB, etc."
                      onChange={e => setConfig({...config, bank_id: e.target.value})}
                    />
                  </div>
                </div>

                <div className="input-field">
                  <label>Số tài khoản</label>
                  <input 
                    type="text" 
                    value={config.account_no} 
                    onChange={e => setConfig({...config, account_no: e.target.value})}
                  />
                </div>

                <div className="input-field">
                  <label>Chủ tài khoản</label>
                  <input 
                    type="text" 
                    value={config.account_holder} 
                    onChange={e => setConfig({...config, account_holder: e.target.value})}
                  />
                </div>

                {isAdmin ? (
                  <button type="submit" className="vcb-btn flex items-center justify-center gap-2">
                    <Save size={18} /> Lưu cấu hình
                  </button>
                ) : (
                  <div className="bg-neutral-50 p-4 border-l-4 border-neutral-300 italic text-xs text-neutral-600">
                    Bạn không có quyền thay đổi thông tin tài khoản ngân hàng.
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="flex flex-col gap-8 items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              <Download className="mx-auto text-gold-primary mb-6" size={60} strokeWidth={1} />
              <h3 className="text-2xl mb-2 italic">Sao lưu & Phục hồi</h3>
              <p className="text-sm text-neutral-500 font-medium mb-8">Dữ liệu được lưu trữ an toàn trên Supabase. Tuy nhiên, bạn nên định kỳ sao lưu thủ công bản snapshot để dự phòng.</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={handleBackup}
                  className="flex-1 bg-ink text-paper py-4 px-6 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-gold-primary hover:text-ink transition-all"
                >
                  <Download size={20} /> Sao lưu dữ liệu
                </button>
                <button 
                  className="flex-1 border border-neutral-200 py-4 px-6 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:border-ink transition-all"
                >
                  <Upload size={20} /> Phục hồi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default System;

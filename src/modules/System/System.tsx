import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, SystemConfig, Profile, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Save, UserPlus, Users, Tag, Building2, ShieldCheck, Download, Upload, Plus, Trash2, X, XCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

const System: React.FC = () => {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'prices' | 'users' | 'bank' | 'backup' | 'diagnostics'>('prices');

  const tabs = [
    { id: 'prices', label: 'Giá Vàng', roles: ['ADMIN', 'SALES'] },
    { id: 'users', label: 'Nhân Viên', roles: ['ADMIN'] },
    { id: 'bank', label: 'Ngân Hàng', roles: ['ADMIN'] },
    { id: 'backup', label: 'Bảo Trì', roles: ['ADMIN'] },
    { id: 'diagnostics', label: 'Kiểm Tra Kết Nối', roles: ['ADMIN'] },
  ];

  const filteredTabs = tabs.filter(t => {
    if (isAdmin) return true; // Admins always see all tabs
    return t.roles.includes(profile?.role || '');
  });
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editingPrices, setEditingPrices] = useState<Record<string, { buy_price: number; sell_price: number }>>({});
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', unit: '', buy_price: 0, sell_price: 0 });
  const [newStaff, setNewStaff] = useState({ username: '', full_name: '', role: 'SALES' as UserRole, password: '' });
  const [restoring, setRestoring] = useState(false);
  const [showRoleUpdate, setShowRoleUpdate] = useState<string | null>(null);
  const [lastError, setLastError] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<{ loading: boolean; connected: boolean; message: string }>({ 
    loading: false, connected: false, message: 'Chưa thực hiện kiểm tra' 
  });

  useEffect(() => {
    setLastError(null);
    fetchProducts();
    fetchConfig();
    if (isAdmin || activeTab === 'users') fetchProfiles();
    if (activeTab === 'diagnostics') checkConnection();
  }, [activeTab, isAdmin]);

  const checkConnection = async () => {
    setDbStatus({ loading: true, connected: false, message: 'Đang kết nối tới database...' });
    try {
      const { data, error } = await supabase.from('products').select('count', { count: 'exact', head: true });
      if (error) throw error;
      setDbStatus({ loading: false, connected: true, message: 'Kết nối thành công! Database hoạt động bình thường.' });
    } catch (err: any) {
      console.error("Connection Check Error:", err);
      setDbStatus({ 
        loading: false, 
        connected: false, 
        message: `Lỗi kết nối: ${err.message || 'Không thể truy cập Supabase. Hãy kiểm tra lại URL/Key trong cấu hình dự án.'}` 
      });
      setLastError(err);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) {
      setProducts(data);
      const initialEditing: Record<string, { buy_price: number; sell_price: number }> = {};
      data.forEach(p => {
        initialEditing[p.id] = { buy_price: p.buy_price, sell_price: p.sell_price };
      });
      setEditingPrices(initialEditing);
    }
  };

  const fetchConfig = async () => {
    const { data } = await supabase.from('system_config').select('*').single();
    if (data) setConfig(data);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('role');
    if (data) setProfiles(data);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-20 italic text-neutral-400 font-bold">
        Đang xác thực quyền hạn...
      </div>
    );
  }

  const { user } = useAuth();
  const currentUserEmail = user?.email;

  const handleRowSave = async (id: string) => {
    const edited = editingPrices[id];
    if (!edited) return;

    const { error } = await supabase
      .from('products')
      .update({ 
        buy_price: edited.buy_price, 
        sell_price: edited.sell_price,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) {
      setLastError(error);
      console.error("Save Price Error:", error);
    } else {
      alert("Đã cập nhật giá thành công!");
      fetchProducts();
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      alert("Lỗi khi cập nhật quyền: " + error.message);
    } else {
      alert("Đã cập nhật quyền nhân viên thành công!");
      fetchProfiles();
      setShowRoleUpdate(null);
    }
  };

  const handleAddStaffProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.username || !newStaff.password) {
      alert("Vui lòng nhập đầy đủ Username và mật khẩu");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .insert([{
        username: newStaff.username,
        full_name: newStaff.full_name || newStaff.username,
        pw: newStaff.password,
        role: newStaff.role,
        email: `${newStaff.username}@store.local` // Synthetic email
      }]);

    if (!error) {
      alert("Đã thêm nhân viên thành công!");
      fetchProfiles();
      setNewStaff({ username: '', full_name: '', role: 'SALES', password: '' });
      setShowAddStaff(false);
    } else {
      alert("Lỗi khi thêm nhân viên: " + error.message);
    }
  };

  const handleDeleteStaff = async (id: string, email: string) => {
    if (email === 'binhphan.070582@gmail.com') {
      alert("Không thể xóa tài khoản Admin tối cao");
      return;
    }
    if (!window.confirm("Bạn có chắc muốn xóa nhân viên này?")) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (!error) fetchProfiles();
    else alert("Lỗi khi xóa: " + error.message);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.unit) return;

    const { error } = await supabase
      .from('products')
      .insert([newProduct]);

    if (!error) {
      alert("Đã thêm mặt hàng thành công!");
      fetchProducts();
      setShowAddProduct(false);
      setNewProduct({ name: '', unit: '', buy_price: 0, sell_price: 0 });
      setLastError(null);
    } else {
      setLastError(error);
      console.error("Add Product Error:", error);
      alert("Lỗi khi thêm mặt hàng: " + (error.message || "Kiểm tra quyền truy cập"));
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
    else alert("Lỗi khi lưu cấu hình: " + error.message);
  };

  const handleBackup = () => {
    const data = { products, config, profiles }; 
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nghiatin-gold-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Hành động này sẽ ghi đè dữ liệu hiện tại (Mặt hàng & Cấu hình). Bạn có chắc chắn muốn tiếp tục?")) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setRestoring(true);

        // 1. Restore Products
        if (data.products && Array.isArray(data.products)) {
          // Clear current products first if admin
          await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          const productsToInsert = data.products.map((p: any) => ({
            name: p.name,
            unit: p.unit,
            buy_price: p.buy_price,
            sell_price: p.sell_price,
            updated_at: p.updated_at
          }));
          await supabase.from('products').insert(productsToInsert);
        }

        // 2. Restore Config
        if (data.config) {
          await supabase.from('system_config').update({
            bank_name: data.config.bank_name,
            account_no: data.config.account_no,
            account_holder: data.config.account_holder,
            bank_id: data.config.bank_id
          }).eq('id', config?.id);
        }

        alert("Phục hồi dữ liệu thành công!");
        fetchProducts();
        fetchConfig();
      } catch (err) {
        console.error("Restore error:", err);
        alert("Lỗi khi đọc file backup. Vui lòng kiểm tra lại định dạng file.");
      } finally {
        setRestoring(false);
      }
    };
    reader.readAsText(file);
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

      {lastError && (
        <div className="bg-red-900/90 text-white p-6 rounded-sm text-xs font-mono mb-6 flex justify-between items-start backdrop-blur-sm border-l-4 border-red-500 shadow-xl">
          <div className="overflow-x-auto w-full">
            <p className="font-bold mb-3 text-sm flex items-center gap-2">
              <XCircle size={16} /> CẢNH BÁO LỖI HỆ THỐNG (SUPABASE ERROR):
            </p>
            <div className="bg-black/30 p-4 rounded mb-4 border border-white/10">
              <pre className="whitespace-pre-wrap">{JSON.stringify(lastError, null, 2)}</pre>
            </div>
            <div className="bg-white/10 p-4 rounded text-red-100">
              <p className="font-bold mb-2 uppercase text-[10px] tracking-widest">Hướng dẫn khắc phục:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Bước 1: Copy nội dung file <strong>supabase-setup.sql</strong> trong mã nguồn.</li>
                <li>Bước 2: Dán và chạy (Run) trong mục <strong>SQL Editor</strong> của Supabase Dashboard.</li>
                <li>Bước 3: Tải lại trang này (F5) và thử lại.</li>
              </ul>
              <p className="mt-4 italic text-[10px]">Tài khoản đang đăng nhập: <span className="font-bold text-white">{currentUserEmail}</span></p>
            </div>
          </div>
          <button onClick={() => setLastError(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors ml-4 focus:outline-none">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="bg-paper p-8 rounded-sm shadow-sm border border-neutral-100 min-h-[500px]">
        {activeTab === 'prices' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-neutral-100 pb-4 mb-4 gap-4">
              <div className="flex items-center gap-3">
                <Tag className="text-gold-primary" />
                <h3 className="text-xl">Điều chỉnh giá niêm yết</h3>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setShowAddProduct(true)}
                  className="flex items-center justify-center gap-2 text-[10px] font-black uppercase bg-ink text-paper py-3 px-6 hover:bg-gold-primary hover:text-ink transition-all w-full md:w-auto"
                >
                  <Plus size={16} /> Thêm mặt hàng
                </button>
              )}
            </div>

            {!isAdmin && (
              <div className="bg-amber-50 p-4 border-l-4 border-amber-400 flex items-center gap-3 italic text-[11px] text-amber-700">
                <ShieldCheck size={18} className="text-amber-400 shrink-0" />
                Lưu ý: Bạn đang ở quyền nhân viên (Sales/Accountant). Chỉ quyền ADMIN mới có thể Thêm/Xóa mặt hàng. Bạn hiện chỉ được phép điều chỉnh giá.
              </div>
            )}

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
                          className="w-full md:w-32 p-2 border border-neutral-100 font-mono font-bold text-sm bg-neutral-50 focus:bg-white focus:border-ink outline-none"
                          value={editingPrices[p.id]?.buy_price ?? p.buy_price} 
                          onChange={(e) => setEditingPrices(prev => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], buy_price: Number(e.target.value) }
                          }))}
                        />
                      </td>
                      <td className="py-4">
                        <input 
                          type="number" 
                          className="w-full md:w-32 p-2 border border-neutral-100 font-mono font-bold text-sm bg-neutral-50 focus:bg-white focus:border-ink outline-none"
                          value={editingPrices[p.id]?.sell_price ?? p.sell_price} 
                          onChange={(e) => setEditingPrices(prev => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], sell_price: Number(e.target.value) }
                          }))}
                        />
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleRowSave(p.id)}
                              className="bg-ink text-paper text-[9px] font-black uppercase px-3 py-1.5 hover:bg-gold-primary hover:text-ink transition-all flex items-center gap-1"
                              title="Lưu thay đổi"
                            >
                              <Save size={12} /> Lưu
                            </button>
                            {isAdmin && (
                              <button 
                                onClick={() => handleDeleteProduct(p.id)}
                                className="text-red-400 hover:text-red-600 transition-colors p-1"
                                title="Xóa mặt hàng"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          <span className="text-[9px] font-mono text-neutral-400 block">
                            Cập nhật: {new Date(p.updated_at).toLocaleString('vi-VN')}
                          </span>
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
            <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-neutral-100 pb-4 mb-4 gap-4">
              <div className="flex items-center gap-3">
                <Users className="text-gold-primary" />
                <h3 className="text-xl">Quản lý nhân sự</h3>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setShowAddStaff(true)}
                  className="flex items-center justify-center gap-2 text-[10px] font-black uppercase bg-ink text-paper py-3 px-6 hover:bg-gold-primary hover:text-ink transition-all w-full md:w-auto"
                >
                  <UserPlus size={16} /> Thêm nhân viên
                </button>
              )}
            </div>

            {showAddStaff && (
              <div className="bg-neutral-50 p-6 border border-neutral-200 mb-6 rounded-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-ink">Thêm nhân viên mới</h4>
                  <button onClick={() => setShowAddStaff(false)}><X size={18} /></button>
                </div>
                <form onSubmit={handleAddStaffProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="input-field">
                    <label>Tên đăng nhập (Username)</label>
                    <input 
                      type="text" 
                      placeholder="VD: nhanvien1" 
                      value={newStaff.username}
                      onChange={e => setNewStaff({...newStaff, username: e.target.value})}
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label>Mật khẩu</label>
                    <input 
                      type="text" 
                      placeholder="Nhập pass" 
                      value={newStaff.password}
                      onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label>Họ tên đầy đủ</label>
                    <input 
                      type="text" 
                      placeholder="VD: Nguyễn Văn A" 
                      value={newStaff.full_name}
                      onChange={e => setNewStaff({...newStaff, full_name: e.target.value})}
                    />
                  </div>
                  <div className="input-field">
                    <label>Phân quyền</label>
                    <select 
                      value={newStaff.role}
                      onChange={e => setNewStaff({...newStaff, role: e.target.value as UserRole})}
                    >
                      <option value="SALES">Bán hàng</option>
                      <option value="ACCOUNTANT">Kế toán</option>
                      <option value="ADMIN">Quản trị viên</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="submit" className="bg-ink text-paper py-3 px-10 font-black uppercase text-[10px] tracking-widest hover:bg-gold-primary hover:text-ink transition-all">
                      Xác nhận tạo
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles.map(p => (
                <div key={p.id} className="p-6 border border-neutral-100 rounded-sm relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rotate-45 opacity-10 transition-transform group-hover:scale-110 ${p.role === 'ADMIN' ? 'bg-red-500' : 'bg-gold-primary'}`}></div>
                  <div className="flex flex-col gap-1 mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      {p.role === 'ADMIN' ? 'Quản trị viên' : p.role === 'ACCOUNTANT' ? 'Kế toán' : 'Bán hàng'}
                    </span>
                    <h4 className="text-lg font-bold lowercase italic">{p.full_name || p.username || p.email.split('@')[0]}</h4>
                  </div>
                  <div className="text-xs font-medium text-neutral-500 mb-6 space-y-1">
                    {p.username && <p>User: <span className="font-bold text-ink">{p.username}</span></p>}
                    {p.pw && <p>Pass: <span className="font-mono bg-neutral-100 px-1">{p.pw}</span></p>}
                    <p className="text-[10px] text-neutral-400">ID: {p.id.substring(0, 8)}...</p>
                    <p className="text-[10px] text-neutral-400">Tham gia: {new Date(p.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                  {isAdmin && p.email !== 'binhphan.070582@gmail.com' && (
                    <div className="flex flex-col gap-2 relative z-10">
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => setShowRoleUpdate(showRoleUpdate === p.id ? null : p.id)}
                          className="text-[10px] font-black uppercase text-neutral-400 hover:text-ink transition-colors text-left"
                        >
                          {showRoleUpdate === p.id ? 'Hủy bỏ' : 'Thay đổi quyền'}
                        </button>
                        <button 
                          onClick={() => handleDeleteStaff(p.id, p.email)}
                          className="text-[10px] font-black uppercase text-red-400 hover:text-red-600 transition-colors"
                        >
                          Xóa tài khoản
                        </button>
                      </div>
                      {showRoleUpdate === p.id && (
                        <div className="flex gap-2 mt-2">
                          {(['ADMIN', 'ACCOUNTANT', 'SALES'] as UserRole[]).map(roleOption => (
                            <button
                              key={roleOption}
                              onClick={() => handleUpdateRole(p.id, roleOption)}
                              className={`text-[9px] px-2 py-1 border ${p.role === roleOption ? 'bg-ink text-paper border-ink' : 'border-neutral-200 text-neutral-500'} hover:border-ink transition-all font-black uppercase`}
                            >
                              {roleOption}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
                <div className="flex-1 relative">
                  <input 
                    type="file" 
                    accept=".json" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleRestore}
                    disabled={restoring}
                  />
                  <button 
                    className={`w-full border border-neutral-200 py-4 px-6 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:border-ink transition-all ${restoring ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Upload size={20} /> {restoring ? 'Đang phục hồi...' : 'Phục hồi'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'diagnostics' && (
          <div className="flex flex-col gap-8 max-w-2xl">
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-4 mb-4">
              <ShieldCheck className="text-gold-primary" />
              <h3 className="text-xl inline-flex items-center gap-4">
                Chẩn đoán kết nối Database
                {dbStatus.loading ? (
                  <span className="text-[10px] bg-neutral-100 px-2 py-1 italic animate-pulse">Checking...</span>
                ) : (
                  <span className={`text-[10px] px-2 py-1 font-black uppercase tracking-widest ${dbStatus.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {dbStatus.connected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                )}
              </h3>
            </div>

            <div className={`p-6 border-l-4 ${dbStatus.connected ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'} rounded-sm shadow-sm`}>
              <p className="font-bold mb-2">Trạng thái hiện tại:</p>
              <p className="text-sm italic">{dbStatus.message}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-sm">
                <p className="text-[10px] uppercase font-black text-neutral-400 mb-2">Cấu hình URL</p>
                <code className="text-[11px] block break-all font-mono">
                  {import.meta.env.VITE_SUPABASE_URL ? '✓ Đã thiết lập' : '✗ Thiếu VITE_SUPABASE_URL'}
                </code>
              </div>
              <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-sm">
                <p className="text-[10px] uppercase font-black text-neutral-400 mb-2">Cấu hình API Key</p>
                <code className="text-[11px] block break-all font-mono">
                  {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Đã thiết lập' : '✗ Thiếu VITE_SUPABASE_ANON_KEY'}
                </code>
              </div>
            </div>

            <div className="bg-amber-50 p-6 border border-amber-200 rounded-sm">
              <h4 className="font-bold text-amber-800 mb-4 flex items-center gap-2">
                <ShieldCheck size={18} /> Lưu ý quan trọng về Quyền hạn (RLS)
              </h4>
              <p className="text-sm text-amber-700 mb-4">
                Nếu bạn thấy trạng thái "ONLINE" nhưng vẫn không thể "Thêm mặt hàng", thì chắc chắn 100% là do **Row Level Security (RLS)** trên Supabase đang chặn yêu cầu của bạn.
              </p>
              <div className="bg-paper p-4 rounded border border-amber-100">
                <p className="font-bold text-xs uppercase mb-2">Cách khắc phục:</p>
                <ol className="text-xs list-decimal ml-4 space-y-2 text-neutral-600">
                  <li>Truy cập <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-500 underline">Supabase Dashboard</a>.</li>
                  <li>Mở mục <strong>SQL Editor</strong>.</li>
                  <li>Copy nội dung từ file <strong>supabase-setup.sql</strong> trong mã nguồn ứng dụng này.</li>
                  <li>Dán vào SQL Editor và nhấn <strong>Run</strong>.</li>
                  <li>Nếu thấy thông báo "Success", hãy quay lại đây và thử lại.</li>
                </ol>
              </div>
            </div>

            <button 
              onClick={checkConnection}
              className="bg-ink text-paper py-4 px-6 font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-gold-primary hover:text-ink transition-all shadow-lg"
            >
              Thử kết nối lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default System;

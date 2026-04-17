import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { TrendingUp, Plus, Edit2, Trash2, Clock, RefreshCw, Check, X as CloseIcon } from 'lucide-react';
import { format } from 'date-fns';

export function PriceManager() {
  const [prices, setPrices] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ buyPrice: 0, sellPrice: 0 });
  const [newPrice, setNewPrice] = useState({ type: 'Vàng 9999', buyPrice: '', sellPrice: '' });

  useEffect(() => {
    const q = query(collection(db, 'gold_prices'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPrices(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleSyncFromSJC = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/gold-prices/sjc');
      const data = await response.json();
      
      if (data.items) {
        for (const item of data.items) {
          // Find if we already have this type
          const existing = prices.find(p => p.type.toLowerCase() === item.type.toLowerCase());
          const buyVal = parseFloat(item.buy.replace(/,/g, '')) * 1000; // SJC prices often in 1000s or differently formatted
          const sellVal = parseFloat(item.sell.replace(/,/g, '')) * 1000;

          if (existing) {
            await updateDoc(doc(db, 'gold_prices', existing.id), {
              buyPrice: buyVal,
              sellPrice: sellVal,
              updatedAt: serverTimestamp()
            });
          } else {
            await addDoc(collection(db, 'gold_prices'), {
              type: item.type,
              buyPrice: buyVal,
              sellPrice: sellVal,
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleEditClick = (p: any) => {
    setEditingId(p.id);
    setEditForm({ buyPrice: p.buyPrice, sellPrice: p.sellPrice });
  };

  const handleUpdate = async (id: string) => {
    await updateDoc(doc(db, 'gold_prices', id), {
      buyPrice: editForm.buyPrice,
      sellPrice: editForm.sellPrice,
      updatedAt: serverTimestamp()
    });
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!newPrice.buyPrice || !newPrice.sellPrice) return;
    await addDoc(collection(db, 'gold_prices'), {
      ...newPrice,
      buyPrice: parseFloat(newPrice.buyPrice),
      sellPrice: parseFloat(newPrice.sellPrice),
      updatedAt: serverTimestamp()
    });
    setShowAdd(false);
    setNewPrice({ type: 'Vàng 9999', buyPrice: '', sellPrice: '' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Xóa mục giá này?")) {
      await deleteDoc(doc(db, 'gold_prices', id));
    }
  };

  return (
    <div className="space-y-12">
      <div className="hero-header border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-8xl font-black uppercase tracking-tighter">Bảng Giá<br/><span className="text-gold-primary">Niêm Yết</span></h1>
          <p className="text-white/20 uppercase tracking-[0.4em] font-black text-[10px] mt-4">Market Values & Pricing Strategy</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleSyncFromSJC}
            disabled={syncing}
            className="border border-white/10 px-8 py-4 rounded-none text-white/40 font-black hover:bg-white/5 transition-all uppercase tracking-widest text-sm flex items-center gap-2"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'SYNCING...' : 'SYNC SJC'}
          </button>
          <button 
            onClick={() => setShowAdd(true)}
            className="bg-gold-primary px-8 py-4 rounded-none text-ink font-black hover:brightness-110 transition-all uppercase tracking-widest text-sm"
          >
            THÊM MỚI
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {prices.map((p) => {
          const isEditing = editingId === p.id;
          return (
            <div key={p.id} className="price-card border-l-4 border-gold-primary bg-white/5 p-8 space-y-6">
              <div className="flex justify-between items-start">
                <h3 className="text-2xl font-black uppercase tracking-tighter">{p.type}</h3>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <>
                      <button onClick={() => handleEditClick(p)} className="text-white/10 hover:text-gold-primary transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-white/10 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleUpdate(p.id)} className="text-green-500 hover:scale-110 transition-transform">
                        <Check size={20} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-white/40 hover:text-white">
                        <CloseIcon size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="grid grid-cols-2 gap-4 border-y border-white/10 py-6">
                  <div className="input-field">
                    <label>MUA VÀO</label>
                    <input 
                      type="number"
                      value={editForm.buyPrice}
                      onChange={(e) => setEditForm({...editForm, buyPrice: parseFloat(e.target.value)})}
                      className="bg-white/10 text-xl p-2 w-full font-black italic"
                    />
                  </div>
                  <div className="input-field">
                    <label>BÁN RA</label>
                    <input 
                      type="number"
                      value={editForm.sellPrice}
                      onChange={(e) => setEditForm({...editForm, sellPrice: parseFloat(e.target.value)})}
                      className="bg-white/10 text-xl p-2 w-full font-black text-gold-primary italic"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-8 border-y border-white/10 py-6">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-black tracking-widest leading-none">MUA VÀO</label>
                    <p className="text-3xl font-black italic tracking-tighter leading-none">{(p.buyPrice || 0).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gold-primary uppercase font-black tracking-widest leading-none">BÁN RA</label>
                    <p className="text-3xl font-black text-gold-primary italic tracking-tighter leading-none">{(p.sellPrice || 0).toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                <Clock size={12} />
                <span>
                  LAST UPDATE: {p.updatedAt?.toDate ? format(p.updatedAt.toDate(), 'HH:mm • dd/MM') : 'PENDING'}
                </span>
              </div>
            </div>
          );
        })}
      </div>


      {showAdd && (
        <div className="fixed inset-0 bg-ink/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="transaction-pane max-w-lg w-full p-10 space-y-8">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
              <h3 className="text-2xl font-black uppercase tracking-tight text-ink">Niêm yết mặt hàng</h3>
              <button 
                onClick={() => setShowAdd(false)} 
                className="w-10 h-10 border border-neutral-100 flex items-center justify-center text-neutral-400 hover:text-ink hover:border-ink"
              >
                X
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="input-field">
                <label>Tên mặt hàng/loại vàng</label>
                <input 
                  type="text"
                  value={newPrice.type}
                  onChange={(e) => setNewPrice({...newPrice, type: e.target.value})}
                  placeholder="VÀNG SJC MIẾNG 1 LƯỢNG..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="input-field">
                  <label>Giá mua (VNĐ)</label>
                  <input 
                    type="number"
                    value={newPrice.buyPrice}
                    onChange={(e) => setNewPrice({...newPrice, buyPrice: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div className="input-field">
                  <label>Giá bán (VNĐ)</label>
                  <input 
                    type="number"
                    value={newPrice.sellPrice}
                    onChange={(e) => setNewPrice({...newPrice, sellPrice: e.target.value})}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={handleAdd} className="flex-1 bg-ink text-paper py-5 font-black uppercase tracking-widest hover:brightness-125 transition-all">PUBLISH PRICE</button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}

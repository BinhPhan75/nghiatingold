import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ShoppingCart, User, Weight, DollarSign, Calendar, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredTx = transactions.filter(tx => 
    tx.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.goldType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.customerID?.includes(searchTerm)
  );

  return (
    <div className="space-y-12">
      <div className="hero-header border-b border-white/10 pb-6">
        <h1 className="text-8xl font-black uppercase tracking-tighter">Sổ Cái<br/><span className="text-gold-primary">Giao Dịch</span></h1>
        <p className="text-white/20 uppercase tracking-[0.4em] font-black text-[10px] mt-4">Transaction Ledger & Audit Trail</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] uppercase font-black text-white/20 tracking-widest">Search Ledger</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="text"
              placeholder="QUÉT THEO TÊN, SỐ CCCD HOẶC LOẠI VÀNG..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-5 pl-12 font-black uppercase text-sm tracking-widest outline-none focus:border-gold-primary transition-all"
            />
          </div>
        </div>
        <div className="flex gap-2">
           <button className="px-6 py-5 border border-white/10 text-white/40 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all">CSV</button>
           <button className="px-6 py-5 border border-white/10 text-white/40 font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all">PDF</button>
        </div>
      </div>

      <div className="border border-white/10 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="p-5 text-[10px] font-black uppercase text-gold-primary tracking-widest">Thời gian</th>
              <th className="p-5 text-[10px] font-black uppercase text-gold-primary tracking-widest">Khách hàng</th>
              <th className="p-5 text-[10px] font-black uppercase text-gold-primary tracking-widest">Loại giao dịch</th>
              <th className="p-5 text-[10px] font-black uppercase text-gold-primary tracking-widest">Sản phẩm</th>
              <th className="p-5 text-[10px] font-black uppercase text-gold-primary tracking-widest">Khối lượng</th>
              <th className="p-5 text-right text-[10px] font-black uppercase text-gold-primary tracking-widest">Tổng tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredTx.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-20 text-center text-white/10 font-black uppercase tracking-[0.5em]">No Records Found</td>
              </tr>
            ) : filteredTx.map((tx: any) => (
              <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="p-5 text-xs font-bold text-white/40 uppercase">
                  {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'HH:mm • dd/MM') : 'PENDING'}
                </td>
                <td className="p-5">
                  <div className="font-black uppercase tracking-tight text-paper">{tx.customerName}</div>
                  <div className="text-[9px] text-white/20 font-black uppercase tracking-widest">{tx.customerID}</div>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border border-gold-primary/30 text-gold-primary`}>
                    {tx.type === 'sell' ? 'BÁN RA' : 'MUA VÀO'}
                  </span>
                </td>
                <td className="p-5 font-black uppercase text-xs tracking-tight">{tx.goldType}</td>
                <td className="p-5 font-black">{tx.weight} <span className="text-[10px] opacity-20 italic font-bold">{tx.unit}</span></td>
                <td className="p-5 text-right font-black text-lg">
                  {(tx.totalPrice || 0).toLocaleString()} <span className="text-[10px] opacity-20">VNĐ</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

  );
}

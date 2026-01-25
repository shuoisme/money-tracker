'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Plus, Home, PieChart, ArrowLeft, 
  Utensils, Bus, ShoppingBag, Gamepad2, Home as HomeIcon, MoreHorizontal,
  Briefcase, Banknote, Users, LogOut, Settings, Heart, Star, Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti'; // 引入撒花特效
import { motion, AnimatePresence } from 'framer-motion'; // 引入動畫庫

// --- Supabase 設定 ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- 圖片設定 (請在這裡換成你喜歡的史努比圖片連結！) ---
const IMAGES = {
  // 1. 首頁頂部裝飾 (趴著的柴犬)
  headerDecor: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnZ3cWx6aG55b3F0aG55b3F0aG55b3F0aG55b3F0aG55b3F0ZiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/QaMhVhqjvixyS4fyqn/giphy.gif",
  // 2. 收入時出現的動畫 (開心的柴犬)
  incomeGif: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaG55b3F0aG55b3F0aG55b3F0aG55b3F0aG55b3F0aG55b3F0ZiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/alH7TEnrp9C65qO3rC/giphy.gif",
  // 3. 支出時出現的動畫 (哭哭/委屈的柴犬)
  expenseGif: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaG55b3F0aG55b3F0aG55b3F0aG55b3F0aG55b3F0aG55b3F0ZiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/l378giAZgxPw3eO52/giphy.gif",
  // 4. 空狀態 (一隻蝴蝶飛過，或發呆的狗)
  emptyState: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaG55b3F0aG55b3F0aG55b3F0aG55b3F0aG55b3F0aG55b3F0ZiZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/xT1R9Z8f71t1v1K7gA/giphy.gif"
};

const CATEGORIES: any = {
  expense: [
    { id: 'food', name: '好吃的', icon: Utensils },
    { id: 'transport', name: '旅遊', icon: Bus },
    { id: 'shopping', name: '買買買', icon: ShoppingBag },
    { id: 'entertainment', name: '娛樂', icon: Gamepad2 },
    { id: 'housing', name: '生活用品', icon: HomeIcon },
    { id: 'other', name: '其他', icon: MoreHorizontal },
  ],
  income: [
    { id: 'salary', name: '薪水', icon: Briefcase },
    { id: 'bonus', name: '獎金', icon: Banknote },
    { id: 'invest', name: '錢滾錢', icon: Star },
    { id: 'other', name: '撿到錢', icon: Heart },
  ]
};

export default function MobileExpenseApp() {
  // --- 狀態管理 ---
  const [walletId, setWalletId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [viewState, setViewState] = useState<'home' | 'add' | 'settings'>('home');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState(['我', 'Snoopy']); 

  // 記帳表單狀態
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES.expense[0]);
  const [inputAmount, setInputAmount] = useState('');
  const [inputDate, setInputDate] = useState('');
  const [inputDesc, setInputDesc] = useState('');
  const [userName, setUserName] = useState('');

  // 動畫控制狀態
  const [showReward, setShowReward] = useState(false); // 控制是否顯示獎勵動畫
  const [rewardType, setRewardType] = useState<'income' | 'expense'>('expense');

  useEffect(() => {
    const savedWallet = localStorage.getItem('my_wallet_id');
    const savedMembers = localStorage.getItem('my_wallet_members');
    
    if (savedWallet) {
      setWalletId(savedWallet);
      setIsLoggedIn(true);
      if (savedMembers) setMembers(JSON.parse(savedMembers));
      fetchTransactions(savedWallet);
      setupRealtime(savedWallet);
    }
    setInputDate(new Date().toISOString().split('T')[0]);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletId.trim()) return;
    const cleanId = walletId.trim();
    localStorage.setItem('my_wallet_id', cleanId);
    setIsLoggedIn(true);
    fetchTransactions(cleanId);
    setupRealtime(cleanId);
  };

  const handleLogout = () => {
    if(!confirm('要離開這個狗窩了嗎？🐶')) return;
    localStorage.removeItem('my_wallet_id');
    setIsLoggedIn(false);
    setWalletId('');
    setTransactions([]);
  };

  const setupRealtime = (targetWalletId: string) => {
    const channel = supabase
      .channel(`realtime:${targetWalletId}`)
      .on('postgres_changes', { 
        event: '*', schema: 'public', table: 'transactions', filter: `wallet_id=eq.${targetWalletId}` 
      }, () => fetchTransactions(targetWalletId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  async function fetchTransactions(targetWalletId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', targetWalletId)
      .order('created_at', { ascending: false });
    if (!error) setTransactions(data || []);
    setLoading(false);
  }

  // --- 核心：新增記帳 + 觸發動畫 ---
  async function handleAdd() {
    if (!inputAmount) return;
    setLoading(true);
    
    let finalAmount = parseFloat(inputAmount);
    if (txType === 'expense') finalAmount = -Math.abs(finalAmount);
    else finalAmount = Math.abs(finalAmount);

    const finalDesc = inputDesc || selectedCategory.name;
    const finalUser = userName || members[0];

    const { error } = await supabase.from('transactions').insert([{ 
      wallet_id: walletId,
      desc_text: finalDesc, 
      amount: finalAmount,
      category: selectedCategory.name,
      date_text: inputDate,
      user_name: finalUser 
    }]);

    if (error) {
      alert('儲存失敗！' + error.message);
    } else {
      // 1. 觸發動畫
      triggerRewardAnimation(txType);
      
      // 2. 重置表單
      setInputAmount('');
      setInputDesc('');
      setViewState('home');
    }
    setLoading(false);
  }

  // --- 動畫邏輯 ---
  const triggerRewardAnimation = (type: 'income' | 'expense') => {
    setRewardType(type);
    setShowReward(true);

    if (type === 'income') {
      // 如果是收入，放煙火！
      const duration = 2000;
      const end = Date.now() + duration;

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#FFA500', '#ffffff'] // 金色系
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#FFA500', '#ffffff']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }

    // 2.5秒後自動關閉動畫
    setTimeout(() => {
      setShowReward(false);
    }, 2500);
  };

  async function handleDelete(id: any) {
    if(!confirm('要刪掉這筆紀錄嗎？')) return;
    await supabase.from('transactions').delete().eq('id', id);
  }

  const addMember = () => {
    const name = prompt('新朋友的名字：');
    if (name && !members.includes(name)) {
      const newMembers = [...members, name];
      setMembers(newMembers);
      localStorage.setItem('my_wallet_members', JSON.stringify(newMembers));
    }
  };

  const removeMember = (target: string) => {
    if (members.length <= 1) return alert('至少要留一個人在家喔');
    if (!confirm(`確定要移除 ${target} 嗎？`)) return;
    const newMembers = members.filter(m => m !== target);
    setMembers(newMembers);
    localStorage.setItem('my_wallet_members', JSON.stringify(newMembers));
  };

  const totalAssets = transactions.reduce((acc: number, cur: any) => acc + cur.amount, 0);

  // --- UI 元件 ---

  // 1. 全螢幕動畫層
  const RewardOverlay = () => (
    <AnimatePresence>
      {showReward && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowReward(false)}
        >
          <motion.div 
            initial={{ scale: 0.5, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center max-w-xs mx-4"
          >
            <img 
              src={rewardType === 'income' ? IMAGES.incomeGif : IMAGES.expenseGif} 
              alt="Animation" 
              className="w-48 h-48 object-contain mb-4"
            />
            <h3 className="text-xl font-bold text-slate-800">
              {rewardType === 'income' ? '太棒了！賺錢啦！🎉' : '紀錄完成！摸摸頭 🐶'}
            </h3>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // --- 登入頁 ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#FFFDF0] flex justify-center items-center font-sans p-6">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 border-4 border-slate-800 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300 rounded-full opacity-50"></div>
          <div className="text-center mb-8 relative z-10">
             {/* 登入頁圖示 */}
            <div className="w-24 h-24 mx-auto mb-4">
               <img src={IMAGES.headerDecor} className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 mb-2">好運記帳本</h1>
            <p className="text-slate-500 font-medium">輸入你的專屬狗屋 ID</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" 
              placeholder="例如: love2026" 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-4 focus:outline-none focus:border-slate-800 focus:ring-0 font-bold text-lg text-center transition-all"
              value={walletId}
              onChange={e => setWalletId(e.target.value)}
            />
            <button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-4 rounded-xl transition-all shadow-[0_4px_0_rgb(51,65,85)] active:translate-y-1 active:shadow-none border-2 border-slate-900">
              進入帳本
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- 記帳頁 ---
  if (viewState === 'add') {
    const currentCategories = CATEGORIES[txType];
    return (
      <div className="min-h-screen bg-[#FFFDF0] flex justify-center items-center font-sans">
        <RewardOverlay />
        <div className="w-full max-w-md bg-white min-h-screen relative flex flex-col">
          <div className="flex items-center p-4">
            <button onClick={() => setViewState('home')} className="text-slate-500 p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={28} /></button>
            <div className="flex-1 flex justify-center gap-4">
              <button onClick={() => setTxType('expense')} className={`px-6 py-2 rounded-full font-black border-2 transition-all ${txType === 'expense' ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-400 bg-white border-transparent'}`}>支出</button>
              <button onClick={() => setTxType('income')} className={`px-6 py-2 rounded-full font-black border-2 transition-all ${txType === 'income' ? 'bg-yellow-400 text-slate-900 border-yellow-400' : 'text-slate-400 bg-white border-transparent'}`}>收入</button>
            </div>
            <div className="w-10"></div>
          </div>
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="mb-8 text-center bg-slate-50 rounded-3xl p-6 border-2 border-dashed border-slate-200">
              <label className="block text-xs text-slate-400 mb-2 font-bold">MONEY</label>
              <div className="flex justify-center items-baseline gap-2">
                <span className={`text-3xl font-black ${txType === 'expense' ? 'text-slate-800' : 'text-yellow-500'}`}>$</span>
                <input type="number" placeholder="0" autoFocus className={`w-48 text-center text-5xl font-black bg-transparent border-b-4 border-slate-100 pb-2 focus:outline-none placeholder:text-slate-200 ${txType === 'expense' ? 'text-slate-800 focus:border-slate-800' : 'text-yellow-500 focus:border-yellow-500'}`} value={inputAmount} onChange={e => setInputAmount(e.target.value)}/>
              </div>
            </div>
            <div className="mb-8">
              <label className="block text-sm font-black text-slate-800 mb-4 px-2">分類</label>
              <div className="grid grid-cols-4 gap-4">
                {currentCategories.map((cat: any) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory.id === cat.id;
                  return (
                    <button key={cat.id} onClick={() => setSelectedCategory(cat)} className="flex flex-col items-center gap-2 active:scale-90 transition-transform">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all border-2 ${isSelected ? (txType === 'expense' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-yellow-400 text-slate-900 border-yellow-400 shadow-md') : 'bg-white border-slate-100 text-slate-300'}`}><Icon size={28} /></div>
                      <span className={`text-xs font-bold ${isSelected ? 'text-slate-800' : 'text-slate-300'}`}>{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-4 bg-white p-2">
              <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                <label className="text-sm font-bold text-slate-400">日期</label>
                <input type="date" className="flex-1 bg-transparent font-bold text-slate-700 focus:outline-none" value={inputDate} onChange={e => setInputDate(e.target.value)}/>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                <label className="text-sm font-bold text-slate-400">備註</label>
                <input type="text" placeholder="買了什麼好吃的？" className="flex-1 bg-transparent font-bold text-slate-700 focus:outline-none" value={inputDesc} onChange={e => setInputDesc(e.target.value)}/>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 overflow-x-auto">
                <label className="text-sm font-bold text-slate-400 whitespace-nowrap">誰花的</label>
                <div className="flex gap-2">
                  {members.map(name => (
                    <button key={name} onClick={() => setUserName(name)} className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors border-2 ${userName === name ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-400'}`}>{name}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 border-t border-slate-100 bg-white">
            <button onClick={handleAdd} disabled={!inputAmount || loading} className={`w-full py-4 rounded-xl font-black text-xl shadow-[0_4px_0_rgb(0,0,0,0.1)] active:translate-y-1 active:shadow-none transition-all border-2 ${!inputAmount ? 'bg-slate-100 text-slate-300 border-slate-200' : (txType === 'expense' ? 'bg-slate-800 text-white border-slate-800' : 'bg-yellow-400 text-slate-900 border-yellow-400')}`}>{loading ? '紀錄中...' : '完成！'}</button>
          </div>
        </div>
      </div>
    );
  }

  // --- 設定頁 ---
  if (viewState === 'settings') {
    return (
      <div className="min-h-screen bg-[#FFFDF0] flex justify-center font-sans text-slate-800">
        <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative p-6">
          <div className="flex items-center mb-8">
            <button onClick={() => setViewState('home')} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full"><ArrowLeft size={24}/></button>
            <h2 className="text-2xl font-black ml-2">設定狗窩</h2>
          </div>
          <div className="mb-8">
            <div className="bg-yellow-50 p-6 rounded-3xl border-2 border-yellow-100 text-center relative overflow-hidden">
               <div className="absolute top-[-20px] right-[-20px] w-20 h-20 bg-yellow-200 rounded-full opacity-50"></div>
              <p className="text-xs font-bold text-yellow-600 mb-1 uppercase tracking-wider">Wallet ID</p>
              <p className="text-3xl font-black text-slate-800 select-all">{walletId}</p>
            </div>
          </div>
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-700">成員名單</h3>
              <button onClick={addMember} className="text-sm bg-slate-800 text-white px-4 py-2 rounded-full font-bold flex items-center gap-1 hover:bg-slate-700"><Plus size={16}/> 新增</button>
            </div>
            <div className="space-y-3">
              {members.map(m => (
                <div key={m} className="flex justify-between items-center bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
                  <span className="font-bold text-lg">{m}</span>
                  <button onClick={() => removeMember(m)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleLogout} className="w-full py-4 text-red-500 font-black bg-red-50 border-2 border-red-100 rounded-2xl flex items-center justify-center gap-2 mt-8 hover:bg-red-100">
            <LogOut size={20}/> 離開狗窩 (登出)
          </button>
        </div>
      </div>
    );
  }

  // --- 主畫面 ---
  return (
    <div className="min-h-screen bg-[#FFFDF0] flex justify-center font-sans text-slate-800">
      <RewardOverlay />
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative pb-24 flex flex-col">
        {/* 卡片區 */}
        <div className="bg-[#FFD700] p-6 pb-16 rounded-b-[3rem] shadow-sm relative overflow-visible shrink-0 border-b-4 border-yellow-500">
          {/* 裝飾圖 (Snoopy on house) */}
          <div className="absolute top-[-20px] right-[20px] w-32 h-32 z-0 pointer-events-none">
             <img src={IMAGES.headerDecor} className="w-full h-full object-contain opacity-90 drop-shadow-lg" />
          </div>
          
          <div className="relative z-10 mt-6">
            <div className="flex items-center gap-2 mb-2 opacity-80 cursor-pointer w-fit px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm" onClick={() => setViewState('settings')}>
              <span className="text-xs font-black text-slate-900 tracking-wide uppercase">{walletId}</span>
              <Settings size={12} className="text-slate-900"/>
            </div>
            <h1 className="text-6xl font-black mb-1 text-slate-900 tracking-tighter drop-shadow-sm">${totalAssets.toLocaleString()}</h1>
            <div className="text-sm font-bold text-slate-800 opacity-70">目前總資產</div>
          </div>
        </div>

        {/* 列表區 */}
        <div className="flex-1 overflow-y-auto px-6 py-6 -mt-8 relative z-20">
          <div className="bg-white rounded-[2rem] p-4 shadow-xl border border-slate-100 min-h-[500px]">
            {loading && transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2"><div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div><p className="font-bold">Snoopy 正在搬資料...</p></div>
            ) : (
              <div className="space-y-3">
                {transactions.map((t: any) => (
                  <div key={t.id} className="p-4 rounded-2xl bg-white border-2 border-slate-50 hover:border-yellow-200 transition-colors flex items-center justify-between group cursor-default shadow-[0_2px_0_rgb(241,245,249)]">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl border-2 ${t.amount > 0 ? 'bg-yellow-100 text-yellow-600 border-yellow-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                         {t.amount > 0 ? <Heart size={20} fill="currentColor"/> : <Utensils size={20}/>}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-base">{t.desc_text}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-bold">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-500">{t.category}</span>
                          <span>• {t.user_name}</span>
                          <span>• {t.date_text}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`block font-black text-lg ${t.amount > 0 ? 'text-yellow-500' : 'text-slate-800'}`}>{t.amount > 0 ? '+' : ''}{t.amount}</span>
                      <button onClick={() => handleDelete(t.id)} className="text-slate-300 hover:text-red-500 text-xs mt-1 p-1 font-bold">刪除</button>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="text-center py-20 flex flex-col items-center gap-6">
                    <img src={IMAGES.emptyState} className="w-32 h-32 object-contain opacity-80" />
                    <p className="text-slate-400 font-bold">這裡空空的<br/>快去買點好吃的吧！</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部導航 (安全版：拿掉顏色判斷，保證不報錯) */}
        <div className="absolute bottom-8 left-8 right-8 h-20 bg-slate-900 rounded-full shadow-2xl flex items-center justify-around z-50 text-white px-2">
          
          {/* 首頁按鈕 */}
          <button 
            onClick={() => setViewState('home')} 
            className="p-4 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Home size={28} strokeWidth={3} />
          </button>

          {/* 中間的大加號 */}
          <button 
            onClick={() => setViewState('add')} 
            className="w-16 h-16 bg-yellow-400 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)] flex items-center justify-center text-slate-900 transform -translate-y-8 transition-transform active:scale-90 hover:scale-105 border-4 border-[#FFFDF0]"
          >
            <Plus size={36} strokeWidth={4} />
          </button>

          {/* 設定按鈕 (原本報錯的地方，現在改簡單了) */}
          <button 
            onClick={() => setViewState('settings')} 
            className="p-4 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Settings size={28} strokeWidth={3} />
          </button>
          
        </div>
      </div>
    </div>
  );
}
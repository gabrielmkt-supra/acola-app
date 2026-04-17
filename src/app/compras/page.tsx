"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Utility for conditional classes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface PurchaseItem {
  name: string;
  price: number;
  qty: number;
  unit: "g" | "ml" | "kg" | "L" | "un";
}

interface Purchase {
  id: string;
  timestamp: string;
  items: string; // Resumo em texto
  itemizedList?: PurchaseItem[];
  total: number;
  place: string; // Local da compra
  payer: "Lara" | "Gabriel";
  method: "Crédito" | "Débito" | "Alimentação";
}

export default function Compras() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // States for new/edit purchase
  const [editingId, setEditingId] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [itemizedList, setItemizedList] = useState<PurchaseItem[]>([{ name: "", price: 0, qty: 0, unit: "g" }]);
  const [payer, setPayer] = useState<"Lara" | "Gabriel">("Lara");
  const [method, setMethod] = useState<"Crédito" | "Débito" | "Alimentação">("Crédito");
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "alert" | "success" }[]>([]);
  const [masterInsumos, setMasterInsumos] = useState<any[]>([]);

  const addToast = (message: string, type: "alert" | "success" = "alert") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const addItemRow = () => setItemizedList([...itemizedList, { name: "", price: 0, qty: 0, unit: "g" }]);
  const removeItemRow = (index: number) => setItemizedList(itemizedList.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newList = [...itemizedList];
    newList[index] = { ...newList[index], [field]: value };
    setItemizedList(newList);
  };

  // Filter States
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchPurchases = async () => {
    const { data } = await supabase.from('purchases').select('*').order('date', { ascending: false });
    if (data) setPurchases(data.map(d => ({
      id: d.id,
      timestamp: d.date,
      items: d.item_name,
      total: Number(d.total_price),
      place: "Local não informado", 
      payer: "Gabriel",
      method: "Débito"
    })));

    const { data: insumosData } = await supabase.from('insumos').select('*');
    if (insumosData) setMasterInsumos(insumosData);
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = itemizedList.filter(i => i.name && i.price > 0);
    if (validItems.length === 0 || !place) return;

    for (const item of validItems) {
      // 1. Salvar na tabela de compras (Individual por item conforme schema)
      const { error: purchaseError } = await supabase.from('purchases').insert([{
        item_name: `${item.name} (${place})`,
        quantity: item.qty,
        unit: item.unit,
        total_price: item.price,
        date: new Date().toISOString()
      }]);

      if (purchaseError) {
        addToast("Erro ao salvar compra: " + purchaseError.message, "alert");
        continue;
      }

      // 2. Atualizar custo do insumo se necessário
      const baseQty = (item.unit === "kg" || item.unit === "L") ? item.qty * 1000 : item.qty;
      const pricePerBaseUnit = item.price / Math.max(1, baseQty);
      
      const existingInsumo = masterInsumos.find(ins => ins.nome.toLowerCase() === item.name.toLowerCase());

      if (existingInsumo) {
        if (pricePerBaseUnit > Number(existingInsumo.custo_unitario)) {
          const increasePct = ((pricePerBaseUnit - Number(existingInsumo.custo_unitario)) / Number(existingInsumo.custo_unitario)) * 100;
          addToast(`Aumento em "${item.name}": +${increasePct.toFixed(1)}%`, "alert");

          await supabase.from('insumos').update({
            custo_unitario: pricePerBaseUnit
          }).eq('id', existingInsumo.id);
        }
      } else {
        // Criar insumo novo se não existir
        await supabase.from('insumos').insert([{
          nome: item.name,
          unidade: item.unit,
          custo_unitario: pricePerBaseUnit
        }]);
      }
    }

    fetchPurchases();
    
    // Reset
    setEditingId(null);
    setPlace("");
    setItemizedList([{ name: "", price: 0, qty: 0, unit: "g" }]);
    setIsModalOpen(false);
    addToast("Compras registradas e custos atualizados!", "success");
  };

  const handleEdit = (p: Purchase) => {
    setEditingId(p.id);
    setPlace(p.place);
    setItemizedList(p.itemizedList || []);
    setPayer(p.payer);
    setMethod(p.method);
    setIsModalOpen(true);
  };

  const openNewPurchaseModal = () => {
    setEditingId(null);
    setPlace("");
    setItemizedList([{ name: "", price: 0, qty: 0, unit: "g" }]);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro de compra?")) return;
    
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) {
      alert("Erro ao excluir compra: " + error.message);
      return;
    }
    
    setPurchases(purchases.filter(p => p.id !== id));
  };

  const filteredPurchases = purchases.filter(p => {
    const date = p.timestamp.split("T")[0];
    return date >= startDate && date <= endDate;
  });

  const totalInPeriod = filteredPurchases.reduce((acc, curr) => acc + curr.total, 0);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header com KPI */}
      <header className="px-8 py-8 border-b border-primary/5 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-2xl font-black text-primary tracking-tight uppercase italic">Gestão de Compras</h1>
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Controle de Insumos e Fornecedores</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6 bg-surface p-4 rounded-3xl border border-primary/5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest">Início</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-primary outline-none cursor-pointer"
                />
              </div>
              <div className="w-px h-8 bg-primary/10" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest">Fim</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-primary outline-none cursor-pointer"
                />
              </div>
            </div>
            
            <div className="w-px h-10 bg-primary/10 hidden md:block" />
            
            <div className="text-right">
              <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Gasto no Período</p>
              <h2 className="text-2xl font-black text-primary italic">
                R$ {totalInPeriod.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </h2>
            </div>
          </div>

          <button 
            onClick={openNewPurchaseModal}
            className="px-8 py-4 bg-secondary text-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-secondary/10 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Registrar Compra
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1920px] mx-auto w-full">
        <div className="bg-surface rounded-[40px] border border-primary/5 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
          <div className="p-8 border-b border-primary/5 bg-surface-variant/10">
            <div className="grid grid-cols-12 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">
              <div className="col-span-2">Data</div>
              <div className="col-span-3">Local / Fornecedor</div>
              <div className="col-span-3">Itens Comprados</div>
              <div className="col-span-2">Método</div>
              <div className="col-span-2 text-right">Valor</div>
            </div>
          </div>

          <div className="divide-y divide-primary/5">
            <AnimatePresence mode="popLayout">
              {filteredPurchases.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-48 text-center">
                  <span className="material-symbols-outlined text-6xl text-primary/5 mb-4 block italic">shopping_cart_checkout</span>
                  <p className="text-sm font-black text-primary/10 uppercase tracking-[0.3em]">Nenhuma compra registrada</p>
                  <p className="text-[10px] font-bold text-primary/20 mt-2 uppercase">Verifique o filtro de datas acima</p>
                </motion.div>
              ) : (
                filteredPurchases.map((p) => (
                  <motion.div 
                    key={p.id} 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="grid grid-cols-12 gap-4 p-8 items-center hover:bg-primary/5 transition-colors group relative"
                  >
                    <div className="col-span-2">
                      <p className="text-xs font-black text-primary italic">{formatDate(p.timestamp)}</p>
                      <p className="text-[9px] font-bold text-primary/30 mt-1 uppercase">#{p.id.split('-').pop()}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm font-black text-primary uppercase leading-tight">{p.place}</p>
                      <span className="text-[9px] font-bold text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                         Pago por {p.payer}
                      </span>
                    </div>
                    <div className="col-span-3">
                      <p className="text-[10px] font-bold text-primary/40 leading-relaxed line-clamp-2 uppercase">{p.items}</p>
                    </div>
                    <div className="col-span-2">
                       <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">{p.method}</p>
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-3">
                      <p className="text-lg font-black text-primary italic mr-3">R$ {p.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      
                      <button onClick={() => handleEdit(p)} className="w-8 h-8 rounded-xl bg-primary/5 text-primary opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-secondary hover:text-white">
                        <span className="material-symbols-outlined text-sm font-black">edit</span>
                      </button>

                      <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-xl bg-error/10 text-error opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-error hover:text-white">
                        <span className="material-symbols-outlined text-sm font-black">delete</span>
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Modal de Registro */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-surface rounded-[48px] shadow-2xl border border-primary/10 overflow-hidden"
            >
              <div className="p-8 bg-secondary text-primary flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">
                    {editingId ? `Editar Registro #${editingId.split('-').pop()}` : 'Registrar Nova Compra'}
                  </h3>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">
                    {editingId ? 'Atualize os dados deste registro' : 'Entrada de Insumos / Gastos'}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-all">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSavePurchase} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Onde comprou?</label>
                    <input 
                      required
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                      className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all"
                      placeholder="Ex: Atacadão, Assaí..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Quem Pagou?</label>
                    <select 
                      value={payer}
                      onChange={(e: any) => setPayer(e.target.value)}
                      className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-black uppercase transition-all appearance-none cursor-pointer"
                    >
                      <option value="Lara">Lara</option>
                      <option value="Gabriel">Gabriel</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Itens da Compra</label>
                    <button 
                      type="button" 
                      onClick={addItemRow}
                      className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] flex items-center gap-1 hover:opacity-70"
                    >
                      <span className="material-symbols-outlined text-xs">add_circle</span>
                      Adicionar Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {itemizedList.map((item, idx) => (
                      <div key={idx} className="bg-background/50 p-4 rounded-3xl border border-primary/5 grid grid-cols-12 gap-3 items-end group/row">
                        <div className="col-span-5 space-y-1.5">
                          <label className="text-[8px] font-black text-primary/20 uppercase tracking-[0.2em] ml-1">Insumo</label>
                          <input 
                            list="insumos-list"
                            value={item.name}
                            onChange={(e) => {
                              const newName = e.target.value;
                              updateItem(idx, "name", newName);
                              
                              // Tentar encontrar unidade no cadastro mestre
                              const matched = masterInsumos.find(mi => mi.name.toLowerCase() === newName.toLowerCase());
                              if (matched) {
                                updateItem(idx, "unit", matched.latestUnit || matched.baseUnit);
                              }
                            }}
                            className="w-full p-3 bg-background border border-primary/5 rounded-xl text-xs font-bold outline-none"
                            placeholder="Nutella, Leite..."
                          />
                          <datalist id="insumos-list">
                            {masterInsumos.map(mi => (
                              <option key={mi.name} value={mi.name} />
                            ))}
                          </datalist>
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-[8px] font-black text-primary/20 uppercase tracking-[0.2em] ml-1">Preço</label>
                          <input 
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(idx, "price", Number(e.target.value))}
                            className="w-full p-3 bg-background border border-primary/5 rounded-xl text-xs font-black outline-none"
                            placeholder="0,00"
                          />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-[8px] font-black text-primary/20 uppercase tracking-[0.2em] ml-1">Qtd</label>
                          <input 
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full p-3 bg-background border border-primary/5 rounded-xl text-xs font-black outline-none"
                            placeholder="0"
                          />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-[8px] font-black text-primary/20 uppercase tracking-[0.2em] ml-1">Un</label>
                          <select 
                            value={item.unit}
                            onChange={(e: any) => updateItem(idx, "unit", e.target.value)}
                            className="w-full p-3 bg-background border border-primary/5 rounded-xl text-[10px] font-black outline-none appearance-none"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="L">L</option>
                            <option value="un">un</option>
                          </select>
                        </div>
                        <div className="col-span-1 pb-1 text-center">
                          <button 
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={itemizedList.length === 1}
                            className="text-primary/10 hover:text-error transition-colors disabled:opacity-0"
                          >
                            <span className="material-symbols-outlined text-lg">delete_sweep</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-primary/5 p-6 rounded-3xl flex justify-between items-center border border-primary/5">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em]">Total da Compra</span>
                    <span className="text-2xl font-black text-primary italic">
                      R$ {itemizedList.reduce((acc, curr) => acc + (curr.price || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-primary/10 mx-4" />
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-primary/40 uppercase tracking-widest ml-1">Método</label>
                    <div className="flex gap-1 p-1 bg-background rounded-xl border border-primary/5 mt-1">
                      {["Crédito", "Débito", "Alimentação"].map((m: any) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMethod(m)}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                            method === m ? "bg-secondary text-primary shadow-sm" : "text-primary/30 hover:text-primary"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-6 bg-secondary text-primary rounded-3xl font-black text-[12px] uppercase tracking-[0.3em] shadow-2xl shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Salvar Registro
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast System */}
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              className={cn(
                "px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-xl",
                t.type === "alert" ? "bg-error/10 border-error/20 text-error" : "bg-secondary/10 border-secondary/20 text-secondary"
              )}
            >
              <span className="material-symbols-outlined text-lg italic">
                {t.type === "alert" ? "warning" : "check_circle"}
              </span>
              <p className="text-[10px] font-black uppercase tracking-widest">{t.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

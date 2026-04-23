/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function ReporEstoque() {
  const router = useRouter();
  const [inventory, setInventory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);
  const [restockAmounts, setRestockAmounts] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "alert" | "success" }[]>([]);

  const addToast = (message: string, type: "alert" | "success" = "alert") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: prodData } = await supabase.from('products').select('*').order('name');
      if (prodData) setInventory(prodData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFinalizeRestock = async () => {
    const pendingUpdates = Object.entries(restockAmounts).filter(([_, amount]) => amount !== undefined);
    
    if (pendingUpdates.length === 0) {
      router.push("/");
      return;
    }

    setIsSaving(true);

    try {
      for (const [id, amount] of pendingUpdates) {
        const item = inventory.find(i => i.id === id);
        if (!item) continue;

        const previousStock = Number(item.stock);
        let newStock = previousStock;

        if (isAdjustmentMode) {
          newStock = amount;
        } else {
          if (amount <= 0) continue;
          newStock = previousStock + amount;
        }

        if (newStock !== previousStock) {
          // TENTATIVA 1: Usar RPC para atomicidade (Recomendado)
          const { data: rpcData, error: rpcError } = await supabase.rpc('process_inventory_update', {
            p_product_id: id,
            p_amount: amount,
            p_is_adjustment: isAdjustmentMode,
            p_note: isAdjustmentMode ? "AJUSTE MANUAL (PÁGINA REPOSIÇÃO)" : "REPOSIÇÃO DE ESTOQUE"
          });

          if (!rpcError && rpcData?.success) {
            continue; // Sucesso via RPC, vai para o próximo item
          }

          // TENTATIVA 2: Fallback (Caso a RPC não esteja instalada)
          console.log(`Executando fallback manual para o produto ${id}...`);
          const { error: updateError } = await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', id);

          if (updateError) {
             console.error(`Erro ao atualizar produto ${id}:`, updateError);
             continue;
          }

          // Registrar movimentação
          const { error: moveError } = await supabase.from('inventory_movements').insert([{
            product_id: id,
            product_name: item.name,
            type: isAdjustmentMode ? "Ajuste" : "Entrada",
            amount: isAdjustmentMode ? (newStock - previousStock) : amount,
            previous_stock: previousStock,
            final_stock: newStock,
            note: isAdjustmentMode ? "AJUSTE MANUAL (PÁGINA REPOSIÇÃO)" : "REPOSIÇÃO DE ESTOQUE"
          }]);
          if (moveError) console.error(`Erro ao registrar movimentação do produto ${id}:`, moveError);
        }
      }

      addToast("Estoque atualizado com sucesso!", "success");
      await new Promise(resolve => setTimeout(resolve, 800));
      router.push("/");
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Erro na reposição:", error);
      addToast(`Erro ao atualizar o estoque: ${err.message || "Erro no servidor"}`, "alert");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto w-full">
        <div className="bg-surface rounded-[40px] border border-primary/5 shadow-2xl p-8">
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h2 className="text-2xl font-black text-primary tracking-tight uppercase italic">Entrada & Ajuste de Estoque</h2>
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Gerencie a produção ou corrija saldos em tempo real</p>
            </div>

            <div className="flex items-center gap-6 bg-background p-2 rounded-2xl border border-primary/5 shadow-inner">
              <div className="flex items-center gap-3 px-4 py-2 border-r border-primary/10">
                <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", !isAdjustmentMode ? "text-primary" : "text-primary/30")}>Reposição</span>
                <button 
                  onClick={() => {
                    setIsAdjustmentMode(!isAdjustmentMode);
                    setRestockAmounts({}); 
                  }}
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-all duration-300",
                    isAdjustmentMode ? "bg-accent" : "bg-primary/20"
                  )}
                >
                  <motion.div 
                    animate={{ x: isAdjustmentMode ? 24 : 4 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
                <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", isAdjustmentMode ? "text-accent" : "text-primary/30")}>Ajuste</span>
              </div>

              <button 
                onClick={() => router.push("/")}
                className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-20">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-secondary rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest">Carregando Inventário...</p>
            </div>
          ) : inventory.length === 0 ? (
            <div className="text-center py-20 bg-background rounded-3xl border-2 border-dashed border-primary/5">
              <p className="font-bold text-primary/30 uppercase tracking-widest text-sm">Nenhum produto cadastrado para reposição</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.map((item) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    borderColor: isAdjustmentMode ? "rgba(var(--accent-rgb), 0.3)" : "rgba(var(--primary-rgb), 0.05)"
                  }}
                  key={item.id}
                  className={cn(
                    "p-6 bg-background rounded-3xl border transition-all flex flex-col gap-4 shadow-sm group hover:shadow-md",
                    isAdjustmentMode ? "border-accent/30 shadow-lg shadow-accent/5" : "border-primary/5"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-surface border border-primary/5 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-black text-primary text-base leading-none uppercase italic">{item.name}</h4>
                      <p className="text-[9px] font-bold text-primary/30 uppercase mt-1 tracking-widest">{item.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-primary/5">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-primary/20 uppercase tracking-widest">Saldo Atual</span>
                      <span className="text-sm font-black text-primary">{item.stock} UN</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        placeholder={isAdjustmentMode ? "Novo total" : "+ 0"}
                        value={restockAmounts[item.id] !== undefined ? restockAmounts[item.id] : ""}
                        onChange={(e) => setRestockAmounts(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                        className={cn(
                          "w-28 p-3 bg-surface rounded-xl border font-black text-sm text-center outline-none transition-all shadow-inner",
                          isAdjustmentMode 
                            ? "border-accent/40 focus:ring-2 focus:ring-accent text-accent" 
                            : "border-primary/10 focus:ring-2 focus:ring-secondary text-primary"
                        )} 
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-primary/5 flex justify-center">
            <button 
              onClick={handleFinalizeRestock}
              disabled={isSaving || Object.keys(restockAmounts).length === 0}
              className="flex items-center gap-3 px-12 py-5 bg-secondary text-primary rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-secondary/20 hover:scale-[1.05] active:scale-95 transition-all cursor-pointer group disabled:opacity-50 disabled:hover:scale-100"
            >
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform font-black">
                {isSaving ? "sync" : "check_circle"}
              </span>
              {isSaving ? "Processando..." : "Finalizar Lote"}
            </button>
          </div>
        </div>
      </div>

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

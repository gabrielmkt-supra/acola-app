"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function SyncPage() {
  const [status, setStatus] = useState<"idle" | "syncing" | "completed" | "error">("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const addLog = (msg: string) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  const handleSync = async () => {
    setStatus("syncing");
    setLog([]);
    addLog("Iniciando sincronização master...");

    try {
      // 1. SINCRONIZAR PRODUTOS (acola_estoque -> products)
      const localProducts = JSON.parse(localStorage.getItem("acola_estoque") || "[]");
      if (localProducts.length > 0) {
        addLog(`Encontrados ${localProducts.length} produtos locais. Enviando...`);
        const { error } = await supabase.from('products').upsert(
          localProducts.map((p: any) => ({
            id: p.id || undefined,
            name: p.name,
            category: p.category,
            subtype: p.subtype,
            price: Number(p.sale_price || p.price || 0),
            cost: Number(p.cost || 0),
            stock: Number(p.current_stock || p.stock || 0),
            image: p.image,
            status: 'active'
          }))
        );
        if (error) throw new Error(`Erro nos produtos: ${error.message}`);
        addLog("✅ Produtos sincronizados com sucesso.");
      }

      // 2. SINCRONIZAR INSUMOS (acola_insumos -> insumos)
      const localInsumos = JSON.parse(localStorage.getItem("acola_insumos") || "[]");
      if (localInsumos.length > 0) {
        addLog(`Encontrados ${localInsumos.length} insumos locais. Enviando...`);
        const { error } = await supabase.from('insumos').upsert(
          localInsumos.map((i: any) => ({
            nome: i.name,
            unidade: i.latestUnit || i.baseUnit || 'un',
            custo_unitario: Number(i.pricePerBaseUnit || 0),
            price_per_base_unit: Number(i.pricePerBaseUnit || 0),
            base_unit: i.baseUnit,
            latest_price: Number(i.latestPrice || 0),
            latest_qty: Number(i.latestQty || 0),
            latest_unit: i.latestUnit,
            last_purchase_date: i.lastPurchaseDate
          }))
        );
        if (error) throw new Error(`Erro nos insumos: ${error.message}`);
        addLog("✅ Insumos sincronizados com sucesso.");
      }

      // 3. SINCRONIZAR VENDAS (acola_vendas -> orders)
      const localSales = JSON.parse(localStorage.getItem("acola_vendas") || "[]");
      if (localSales.length > 0) {
        addLog(`Encontradas ${localSales.length} vendas locais. Enviando...`);
        const { error } = await supabase.from('orders').upsert(
          localSales.map((s: any) => ({
            id: s.id,
            client_name: s.buyerName || 'Cliente Balcão',
            total: Number(s.total || 0),
            payment_status: s.paymentStatus || 'pago',
            payment_method: s.paymentMethod || 'Dinheiro',
            items: s.items || [],
            timestamp: s.timestamp 
          }))
        );
        if (error) throw new Error(`Erro nas vendas: ${error.message}`);
        addLog("✅ Vendas sincronizadas com sucesso.");
      }

      // 4. SINCRONIZAR COMPRAS (acola_compras -> purchases)
      const localPurchases = JSON.parse(localStorage.getItem("acola_compras") || "[]");
      if (localPurchases.length > 0) {
        addLog(`Encontradas ${localPurchases.length} compras locais. Enviando...`);
        const { error } = await supabase.from('purchases').upsert(
          localPurchases.map((c: any) => ({
            item_name: 'Compra em Lote',
            quantity: 1,
            unit: 'un',
            total_price: Number(c.total || 0),
            items: c.items || [],
            date: c.timestamp 
          }))
        );
        if (error) throw new Error(`Erro nas compras: ${error.message}`);
        addLog("✅ Compras sincronizadas com sucesso.");
      }

      setStatus("completed");
      addLog("🚀 SINCRONIZAÇÃO CONCLUÍDA! Seu app agora está na nuvem.");

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message);
      addLog(`❌ ERRO: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-primary">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full bg-surface p-12 rounded-[48px] border border-primary/10 shadow-2xl text-center"
      >
        <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-3xl flex items-center justify-center mx-auto mb-8">
          <span className="material-symbols-outlined text-4xl">cloud_sync</span>
        </div>

        <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-4">Central de Sincronia</h1>
        <p className="text-sm text-primary/40 leading-relaxed mb-12">
          Esta ferramenta irá transferir todos os dados que hoje estão no seu navegador direto para o banco de dados online do Supabase.
        </p>

        {status === "idle" && (
          <button 
            onClick={handleSync}
            className="w-full py-6 bg-secondary text-primary rounded-[24px] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Iniciar Transferência
          </button>
        )}

        {status === "syncing" && (
          <div className="space-y-6">
            <div className="h-2 w-full bg-primary/5 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: "0%" }}
                 animate={{ width: "100%" }}
                 transition={{ duration: 5 }}
                 className="h-full bg-secondary"
               />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando dados...</p>
          </div>
        )}

        {status === "completed" && (
          <div className="space-y-8">
            <div className="p-6 bg-success/5 border border-success/10 rounded-3xl">
               <span className="material-symbols-outlined text-success mb-2">check_circle</span>
               <p className="text-xs font-bold text-success uppercase">Sucesso Total!</p>
            </div>
            <Link 
              href="/"
              className="block w-full py-6 bg-primary text-background rounded-[24px] font-black text-xs uppercase tracking-[0.3em]"
            >
              Voltar ao Dashboard
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6">
            <p className="text-xs text-error font-bold uppercase">{errorMsg}</p>
            <button 
              onClick={handleSync}
              className="px-8 py-3 bg-error/10 text-error rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        <div className="mt-12 text-left bg-background/50 p-6 rounded-3xl border border-primary/5 max-h-48 overflow-y-auto font-mono text-[9px] text-primary/30">
          {log.map((line, i) => (
            <div key={i} className="mb-1">{line}</div>
          ))}
          {log.length === 0 && <div className="opacity-20 italic">Aguardando início...</div>}
        </div>
      </motion.div>
    </div>
  );
}

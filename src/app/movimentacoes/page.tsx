 
"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatUnitCost } from "@/lib/utils";

interface Movement {
  id: string;
  timestamp: string;
  productId: string;
  productName: string;
  type: "Entrada" | "Saída" | "Ajuste";
  amount: number;
  previousStock: number;
  finalStock: number;
  note?: string;
}

export default function Movimentacoes() {
  const [history, setHistory] = useState<Movement[]>([]);
  const [vendas, setVendas] = useState<unknown[]>([]);
  const [inventory, setInventory] = useState<unknown[]>([]);
  const [filter, setFilter] = useState<"Todos" | "Entrada" | "Saída" | "Ajuste">("Todos");
  const [activeTab, setActiveTab] = useState<"Fluxo" | "Pedidos" | "Pendências">("Fluxo");

  const fetchData = async () => {
    try {
      // 1. Histórico de Movimentações
      const { data: movements } = await supabase.from('inventory_movements').select('*').order('timestamp', { ascending: false });
      if (movements) setHistory(movements.map(m => ({
        id: m.id,
        timestamp: m.timestamp,
        productId: m.product_id,
        productName: m.product_name,
        type: m.type,
        amount: m.amount,
        previousStock: m.previous_stock,
        finalStock: m.final_stock,
        note: m.note
      })));

      // 2. Vendas (Orders)
      const { data: sales } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
      if (sales) setVendas(sales);

      // 3. Inventário (Products) - Para estornos
      const { data: prods } = await supabase.from('products').select('*');
      if (prods) setInventory(prods);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  useEffect(() => {
    fetchData();

    // Suporte a abertura direta via URL (ex: ?tab=Pendências)
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab");
    if (initialTab === "Pendências" || initialTab === "Pedidos" || initialTab === "Fluxo") {
      setActiveTab(initialTab as "Pendências" | "Pedidos" | "Fluxo");
    }
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("⚠️ ATENÇÃO: Deseja realmente estornar esta venda?\n\nOs produtos serão devolvidos ao estoque e a venda será excluída.")) return;

    const order = vendas.find(v => v.id === orderId);
    if (!order) return;

    try {
      // 1. Devolver itens ao estoque no Supabase
      for (const item of order.items) {
        const invProduct = inventory.find(p => p.id === item.id);
        if (invProduct) {
          const previousStock = Number(invProduct.stock);
          const newStock = previousStock + Number(item.quantity);

          const { error: updateError } = await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
          if (updateError) console.error(`Erro ao estornar estoque do produto ${item.id}:`, updateError);

          const orderShortId = String(orderId).includes('-') ? orderId.split('-').pop() : orderId;

          // Registrar Movimentação
          const { error: moveError } = await supabase.from('inventory_movements').insert([{
            product_id: item.id,
            product_name: item.name,
            type: "Ajuste",
            amount: item.quantity,
            previous_stock: previousStock,
            final_stock: newStock,
            note: `ESTORNO: Pedido #${orderShortId}`
          }]);
          if (moveError) console.error(`Erro ao registrar movimentação de estorno do produto ${item.id}:`, moveError);
        }
      }

      // 2. Excluir ou Anular Venda no Supabase
      const { error: deleteError } = await supabase.from('orders').delete().eq('id', orderId);
      if (deleteError) throw deleteError;

      alert("Estorno realizado com sucesso!");
      fetchData(); // Recarregar tudo
    } catch (error) {
      console.error("Erro no estorno:", error);
      alert("Erro técnico ao realizar estorno.");
    }
  };

  const handleMarkAsPaid = async (orderId: string) => {
    if (!confirm("Confirmar recebimento deste pedido? O valor entrará no faturamento oficial.")) return;

    const { error } = await supabase
      .from('orders')
      .update({ payment_status: "pago" }) // O usuário usou payment_status no script consolidado
      .eq('id', orderId);

    if (error) {
      alert("Erro ao marcar como pago: " + error.message);
      return;
    }

    setVendas(vendas.map(v => 
      v.id === orderId ? { ...v, payment_status: "pago" } : v
    ));
    alert("Pagamento registrado com sucesso!");
  };

  const filteredHistory = history.filter(item => 
    filter === "Todos" ? true : item.type === filter
  );

  // Agrupamento de Pendências por Cliente
  const pendenciasPorCliente = vendas
    .filter(v => v.payment_status === "pendente")
    .reduce((acc: Record<string, any>, curr: any) => {
      const clientName = curr.client_name; // Schema consolidado usa client_name
      if (!acc[clientName]) {
        acc[clientName] = { 
          name: clientName, 
          phone: curr.client_phone, 
          total: 0, 
          pedidos: [] 
        };
      }
      acc[clientName].total += curr.total;
      acc[clientName].pedidos.push(curr);
      return acc;
    }, {});

  const formatDate = (isoStr: string) => {
    const date = new Date(isoStr);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 md:p-8">
      <header className="max-w-6xl mx-auto w-full mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-all">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
            </Link>
            <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Central de Fluxo</h1>
          </div>
          <p className="text-[11px] font-bold text-primary/40 uppercase tracking-[0.3em] ml-11">Auditoria & Pedidos</p>
        </div>

        <div className="flex gap-1 bg-background p-1.5 rounded-2xl border border-primary/5 shadow-sm overflow-x-auto">
          {["Fluxo", "Pedidos", "Pendências"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? "bg-secondary text-primary shadow-lg" 
                  : "text-primary/60 hover:text-primary hover:bg-primary/5"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full flex-1">
        {activeTab === "Fluxo" ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="flex flex-wrap gap-3">
              {["Todos", "Entrada", "Saída", "Ajuste"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                    filter === f ? "bg-primary/5 border-primary text-primary" : "bg-surface border-primary/5 text-primary/40 hover:border-primary/20"
                  }`}
                >
                  {f === "Ajuste" ? "Ajuste/Estorno" : f === "Saída" ? "Pedidos" : f}
                </button>
              ))}
            </div>

            <div className="bg-surface rounded-[40px] border border-primary/5 shadow-sm overflow-hidden min-h-[500px]">
              <div className="p-8 border-b border-primary/5 bg-surface-variant/10">
                <div className="grid grid-cols-12 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">
                  <div className="col-span-3">Data e Hora</div>
                  <div className="col-span-4">Produto</div>
                  <div className="col-span-2">Tipo</div>
                  <div className="col-span-3 text-right">Movimentação</div>
                </div>
              </div>
              <div className="divide-y divide-primary/5">
                <AnimatePresence mode="popLayout">
                  {filteredHistory.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32 text-center">
                      <span className="material-symbols-outlined text-5xl text-primary/10 mb-4 block">history</span>
                      <p className="text-sm font-bold text-primary/20 uppercase tracking-widest">Nenhuma movimentação</p>
                    </motion.div>
                  ) : (
                    filteredHistory.map((mov) => (
                      <motion.div key={mov.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-12 gap-4 p-8 items-center hover:bg-primary/5 transition-colors group">
                        <div className="col-span-3">
                          <p className="text-xs font-bold text-primary">{formatDate(mov.timestamp)}</p>
                          <p className="text-[9px] font-medium text-primary/30 mt-0.5">ID: {String(mov.id).includes('-') ? mov.id.split('-').pop() : mov.id}</p>
                        </div>
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface-variant flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary/40 text-sm">box</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-primary truncate">{mov.productName}</p>
                            {mov.note && (
                              <p className="text-[10px] font-bold text-secondary uppercase tracking-tight mt-0.5">
                                {mov.note.includes(":") ? mov.note.split(":")[1].trim() : mov.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            mov.type === "Entrada" ? "bg-green-100/10 text-green-600" : mov.type === "Saída" ? "bg-red-100/10 text-red-400" : "bg-secondary/10 text-secondary"
                          }`}>
                            {mov.note?.includes("ESTORNO") ? "Estorno" : mov.type === "Saída" ? "Pedidos" : mov.type}
                          </span>
                        </div>
                        <div className="col-span-3 text-right">
                          <p className={`text-lg font-black ${mov.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                            {mov.amount > 0 ? `+${mov.amount}` : mov.amount} UN
                          </p>
                          <p className="text-[10px] font-bold text-primary/30 uppercase">Saldo: {mov.previousStock} → {mov.finalStock}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ) : activeTab === "Pedidos" ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-surface rounded-[40px] border border-primary/5 shadow-sm overflow-hidden min-h-[500px]">
              <div className="p-8 border-b border-primary/5 bg-surface-variant/10">
                <div className="grid grid-cols-12 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">
                  <div className="col-span-2">ID</div>
                  <div className="col-span-3">Cliente</div>
                  <div className="col-span-4">Itens</div>
                  <div className="col-span-3 text-right">Total</div>
                </div>
              </div>
              <div className="divide-y divide-primary/5">
                <AnimatePresence mode="popLayout">
                  {vendas.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32 text-center">
                      <span className="material-symbols-outlined text-5xl text-primary/10 mb-4 block">receipt_long</span>
                      <p className="text-sm font-bold text-primary/20 uppercase tracking-widest">Nenhum pedido</p>
                    </motion.div>
                  ) : (
                    vendas.map((venda) => (
                      <motion.div key={venda.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-12 gap-4 p-8 items-center hover:bg-primary/5 transition-colors group">
                        <div className="col-span-2">
                           <p className="text-[10px] font-black text-primary uppercase">#{venda.id.split('-').pop()}</p>
                           <p className="text-[9px] font-bold text-primary/30 uppercase mt-0.5">{formatDate(venda.timestamp)}</p>
                        </div>
                        <div className="col-span-3">
                           <p className="text-sm font-black text-primary truncate leading-none mb-1">{venda.client_name}</p>
                           <p className="text-[9px] font-bold text-primary/40 font-mono italic">{venda.client_phone || "SEM TELEFONE"}</p>
                        </div>
                        <div className="col-span-4 flex flex-wrap gap-1">
                          {venda.items.map((item: any, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-background rounded-md text-[9px] font-black text-primary/60 uppercase border border-primary/5">
                              {item.quantity}x {item.name}
                            </span>
                          ))}
                        </div>
                        <div className="col-span-3 text-right flex items-center justify-end gap-6">
                           <div className="flex flex-col items-end">
                              <p className="text-lg font-black text-primary italic">R$ {formatUnitCost(Number(venda.total || 0))}</p>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${venda.payment_status === 'pendente' ? 'text-secondary' : 'text-green-600'}`}>
                                {venda.payment_status === 'pendente' ? 'Pendente' : 'Pago'}
                              </span>
                           </div>
                           <button onClick={() => handleCancelOrder(venda.id)} className="w-10 h-10 rounded-xl bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm hover:scale-110">
                             <span className="material-symbols-outlined text-lg">undo</span>
                           </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {Object.values(pendenciasPorCliente).length === 0 ? (
                 <div className="col-span-2 py-32 text-center bg-surface rounded-[40px] border border-primary/5">
                    <span className="material-symbols-outlined text-5xl text-primary/10 mb-4 block">sentiment_satisfied_alt</span>
                    <p className="text-sm font-bold text-primary/20 uppercase tracking-widest">Tudo limpo! Nenhuma pendência ativa.</p>
                 </div>
               ) : (
                 Object.values(pendenciasPorCliente).map((cliente: any) => (
                   <motion.div key={cliente.name} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-surface border border-primary/5 rounded-[32px] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-6 bg-surface-variant/20 flex justify-between items-center border-b border-primary/5">
                         <div>
                            <h3 className="text-sm font-black text-primary uppercase tracking-tight">{cliente.name}</h3>
                            <p className="text-[9px] font-bold text-primary/40 font-mono">{cliente.phone || "SEM TELEFONE"}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Dívida Total</p>
                            <p className="text-xl font-black text-primary italic">R$ {formatUnitCost(Number(cliente.total || 0))}</p>
                         </div>
                      </div>
                      <div className="p-6 space-y-4">
                         <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] mb-2">Extrato Detalhado:</p>
                         {cliente.pedidos.map((pedido: any) => (
                           <div key={pedido.id} className="flex items-center justify-between py-3 border-b border-background last:border-0 group">
                              <div className="flex-1 pr-4">
                                 <div className="flex flex-wrap gap-1 mb-1">
                                    {pedido.items.map((item: any, iNum: number) => (
                                      <span key={iNum} className="text-[10px] font-bold text-primary italic lowercase">
                                        {item.quantity}x {item.name}{iNum < pedido.items.length - 1 ? "," : ""}
                                      </span>
                                    ))}
                                 </div>
                                 <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest">{formatDate(pedido.timestamp)}</p>
                              </div>
                               <div className="flex items-center gap-4">
                                 <p className="text-xs font-black text-primary">R$ {formatUnitCost(pedido.total)}</p>
                                 <button 
                                   onClick={() => handleMarkAsPaid(pedido.id)} 
                                   title="Marcar como Pago"
                                   className="w-10 h-10 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                                 >
                                   <span className="material-symbols-outlined text-lg">payments</span>
                                 </button>
                               </div>
                           </div>
                         ))}
                      </div>
                   </motion.div>
                 ))
               )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

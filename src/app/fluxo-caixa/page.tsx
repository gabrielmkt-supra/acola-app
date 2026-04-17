"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// Utility for conditional classes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface Sale {
  timestamp: string;
  total: number;
}

interface Purchase {
  timestamp: string;
  total: number;
}

interface InventoryItem {
  stock: number;
  price: string;
}

export default function FluxoCaixa() {
  const [vendas, setVendas] = useState<Sale[]>([]);
  const [compras, setCompras] = useState<Purchase[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // Período de Filtro
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const savedVendas = localStorage.getItem("acola_vendas");
    const savedCompras = localStorage.getItem("acola_compras");
    const savedInventory = localStorage.getItem("acola_estoque");

    if (savedVendas) setVendas(JSON.parse(savedVendas));
    if (savedCompras) setCompras(JSON.parse(savedCompras));
    if (savedInventory) setInventory(JSON.parse(savedInventory));
  }, []);

  // Cálculos Dinâmicos
  const totalVendas = vendas
    .filter(v => v.timestamp.split("T")[0] >= startDate && v.timestamp.split("T")[0] <= endDate)
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalCompras = compras
    .filter(c => c.timestamp.split("T")[0] >= startDate && c.timestamp.split("T")[0] <= endDate)
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalEstoque = inventory.reduce((acc, curr) => {
    const price = Number(curr.price.replace("R$", "").replace(",", "."));
    return acc + (price * curr.stock);
  }, 0);

  const balance = totalVendas - totalCompras;

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const kpis = [
    { 
      label: "Faturamento em Vendas", 
      value: formatCurrency(totalVendas), 
      icon: "trending_up", 
      color: "text-green-500", 
      bg: "bg-green-500/10",
      desc: "Total bruto captado no período"
    },
    { 
      label: "Investimento em Compras", 
      value: formatCurrency(totalCompras), 
      icon: "shopping_bag", 
      color: "text-red-500", 
      bg: "bg-red-500/10",
      desc: "Saída para insumos e materiais"
    },
    { 
      label: "Potencial de Venda (Estoque)", 
      value: formatCurrency(totalEstoque), 
      icon: "inventory_2", 
      color: "text-secondary", 
      bg: "bg-secondary/10",
      desc: "Valor total dos produtos hoje"
    },
    { 
      label: "Resultado Líquido (Balanço)", 
      value: formatCurrency(balance), 
      icon: "account_balance_wallet", 
      color: balance >= 0 ? "text-secondary" : "text-error", 
      bg: balance >= 0 ? "bg-secondary/10" : "bg-error/10",
      desc: "Vendas - Compras (Período)"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background p-8 pt-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="flex items-center gap-4">
          <Link href="/" className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface border border-primary/5 text-primary hover:scale-105 transition-all shadow-sm">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter italic">Fluxo de Caixa Analítico</h1>
            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.3em] mt-1">Visão 360º da Saúde Financeira</p>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-[32px] border border-primary/5 shadow-xl flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest mb-1">Período de Análise</span>
            <div className="flex items-center gap-3">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-primary/5 px-4 py-2 rounded-xl text-xs font-black text-primary outline-none border border-transparent focus:border-primary/20 transition-all"
              />
              <span className="text-primary/20 font-black">→</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-primary/5 px-4 py-2 rounded-xl text-xs font-black text-primary outline-none border border-transparent focus:border-primary/20 transition-all"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {kpis.map((kpi, idx) => (
            <motion.div 
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-surface p-8 rounded-[40px] border border-primary/5 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative"
            >
              <div className={cn("inline-flex w-12 h-12 items-center justify-center rounded-2xl mb-6 transition-transform group-hover:scale-110", kpi.bg)}>
                <span className={cn("material-symbols-outlined font-black", kpi.color)}>{kpi.icon}</span>
              </div>
              <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.15em] mb-2">{kpi.label}</p>
              <h3 className={cn("text-2xl font-black tracking-tighter italic mb-2", kpi.color)}>{kpi.value}</h3>
              <p className="text-[9px] font-bold text-primary/40 uppercase leading-relaxed">{kpi.desc}</p>
              
              <div className={cn("absolute -right-4 -bottom-4 opacity-5 pointer-events-none transition-transform group-hover:scale-150 duration-700", kpi.color)}>
                 <span className="material-symbols-outlined text-8xl">{kpi.icon}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-surface rounded-[48px] border border-primary/5 p-12 relative overflow-hidden group">
            <div className="relative z-10">
              <h2 className="text-xl font-black text-primary uppercase tracking-tight italic mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">analytics</span>
                Balanço Mensal Composto
              </h2>
              <div className="space-y-8">
                 <div className="space-y-3">
                    <div className="flex justify-between items-end">
                       <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Performance de Vendas</span>
                       <span className="text-sm font-black text-primary">{formatCurrency(totalVendas)}</span>
                    </div>
                    <div className="h-3 bg-primary/5 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: "70%" }}
                         className="h-full bg-green-500 rounded-full shadow-lg shadow-green-500/20"
                       />
                    </div>
                 </div>
                 <div className="space-y-3">
                    <div className="flex justify-between items-end">
                       <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Insumos e Compras</span>
                       <span className="text-sm font-black text-primary">{formatCurrency(totalCompras)}</span>
                    </div>
                    <div className="h-3 bg-primary/5 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: "45%" }}
                         className="h-full bg-red-400 rounded-full shadow-lg shadow-red-500/20"
                       />
                    </div>
                 </div>
              </div>
            </div>
            
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-secondary/5 to-transparent pointer-events-none" />
          </div>

          <div className="lg:col-span-4 bg-surface-variant text-primary rounded-[48px] p-12 flex flex-col justify-between shadow-2xl shadow-primary/5 group">
             <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Valor em Produto</span>
                <h3 className="text-4xl font-black tracking-tighter italic mt-2 group-hover:scale-105 transition-transform origin-left text-secondary">
                   {formatCurrency(totalEstoque)}
                </h3>
             </div>
             
             <div className="mt-8 pt-8 border-t border-primary/10">
                <p className="text-[10px] font-bold leading-relaxed opacity-60">
                   Este valor representa o faturamento bruto estimado caso todos os itens em estoque hoje sejam vendidos pelo preço de tabela.
                </p>
                <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:gap-4 transition-all cursor-pointer text-secondary">
                   Ir para estoque
                   <span className="material-symbols-outlined text-sm">arrow_back</span>
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

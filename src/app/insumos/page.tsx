"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Utility for conditional classes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface Insumo {
  name: string;
  pricePerBaseUnit: number;
  baseUnit: "g" | "ml" | "un";
  latestPrice: number;
  latestQty: number;
  latestUnit: string;
  lastPurchaseDate: string;
  vendor?: string;
  createdAt: string;
}

export default function GestaoInsumos() {
  const router = useRouter();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form states
  const [name, setName] = useState("");
  const [initialPrice, setInitialPrice] = useState(0);
  const [initialQty, setInitialQty] = useState(0);
  const [unit, setUnit] = useState<"g" | "kg" | "ml" | "L" | "un">("g");

  useEffect(() => {
    const saved = localStorage.getItem("acola_insumos");
    if (saved) {
      setInsumos(JSON.parse(saved));
    }
  }, []);

  const handleSaveInsumo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || initialPrice <= 0 || initialQty <= 0) return;

    let baseQty = initialQty;
    if (unit === "kg" || unit === "L") baseQty = initialQty * 1000;
    
    const pricePerBaseUnit = initialPrice / Math.max(1, baseQty);
    const baseUnit = (unit === "kg" || unit === "g") ? "g" : (unit === "L" || unit === "ml") ? "ml" : "un";

    const newInsumo: Insumo = {
      name,
      pricePerBaseUnit,
      baseUnit,
      latestPrice: initialPrice,
      latestQty: initialQty,
      latestUnit: unit,
      lastPurchaseDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    const updated = [...insumos, newInsumo];
    setInsumos(updated);
    localStorage.setItem("acola_insumos", JSON.stringify(updated));

    // Reset
    setName("");
    setInitialPrice(0);
    setInitialQty(0);
    setIsModalOpen(false);
  };

  const handleDelete = (nameToDelete: string) => {
    if (!confirm(`Excluir o insumo "${nameToDelete}"? Isso pode afetar receitas vinculadas.`)) return;
    const updated = insumos.filter(i => i.name !== nameToDelete);
    setInsumos(updated);
    localStorage.setItem("acola_insumos", JSON.stringify(updated));
  };

  const filteredInsumos = insumos.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-primary">
      {/* Header */}
      <header className="px-8 py-8 border-b border-primary/5 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-2xl font-black text-primary tracking-tight uppercase italic">Gestão de Insumos</h1>
              <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Cadastro Mestre de Matéria-Prima</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
             <div className="bg-surface px-6 py-3 rounded-2xl border border-primary/5 shadow-sm flex items-center gap-3 w-full md:w-80">
                <span className="material-symbols-outlined text-primary/20">search</span>
                <input 
                  type="text" 
                  placeholder="Pesquisar insumo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent outline-none text-xs font-bold w-full"
                />
             </div>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-8 py-4 bg-secondary text-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-secondary/10 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Novo Insumo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1920px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredInsumos.length === 0 ? (
              <div className="col-span-full py-48 text-center opacity-20">
                <span className="material-symbols-outlined text-6xl italic">egg</span>
                <p className="font-black uppercase tracking-widest mt-4">Nenhum insumo cadastrado</p>
              </div>
            ) : (
              filteredInsumos.map((ins) => (
                <motion.div 
                  key={ins.name}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-surface p-6 rounded-[32px] border border-primary/5 shadow-sm hover:border-secondary/30 transition-all group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-primary transition-all">
                      <span className="material-symbols-outlined">inventory_2</span>
                    </div>
                    <button 
                      onClick={() => handleDelete(ins.name)}
                      className="w-8 h-8 rounded-lg text-primary/10 hover:text-error hover:bg-error/5 transition-all flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>

                  <h3 className="text-lg font-black uppercase italic tracking-tight truncate">{ins.name}</h3>
                  <p className="text-[10px] font-bold text-primary/30 uppercase tracking-[0.2em] mb-6">Cadastro em {new Date(ins.createdAt || ins.lastPurchaseDate).toLocaleDateString()}</p>

                  <div className="space-y-4">
                    <div className="bg-background/50 p-4 rounded-2xl border border-primary/5">
                      <p className="text-[9px] font-black text-primary/20 uppercase tracking-widest mb-1">Custo por {ins.baseUnit}</p>
                      <p className="text-xl font-black text-secondary italic">
                        R$ {ins.pricePerBaseUnit.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-background/30 rounded-xl border border-primary/5">
                         <p className="text-[8px] font-black text-primary/20 uppercase tracking-widest">Último Preço</p>
                         <p className="text-xs font-black">R$ {ins.latestPrice?.toFixed(2)}</p>
                      </div>
                      <div className="p-3 bg-background/30 rounded-xl border border-primary/5">
                         <p className="text-[8px] font-black text-primary/20 uppercase tracking-widest">Unidade</p>
                         <p className="text-xs font-black uppercase text-secondary">{ins.latestQty} {ins.latestUnit}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modal de Cadastro */}
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
              className="relative w-full max-w-md bg-surface rounded-[48px] shadow-2xl border border-primary/10 overflow-hidden"
            >
              <div className="p-8 bg-secondary text-primary flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Novo Insumo</h3>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">Cadastro Mestre</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-all">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveInsumo} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Nome do Insumo</label>
                  <input 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all"
                    placeholder="Ex: Chocolate Callebaut, Leite Moça..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Valor inicial</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={initialPrice || ""}
                      onChange={(e) => setInitialPrice(Number(e.target.value))}
                      className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-black transition-all"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Quantidade</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        required
                        value={initialQty || ""}
                        onChange={(e) => setInitialQty(Number(e.target.value))}
                        className="flex-1 p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-black transition-all"
                        placeholder="Ex: 395"
                      />
                      <select 
                        value={unit}
                        onChange={(e: any) => setUnit(e.target.value)}
                        className="w-20 p-4 bg-background border border-primary/5 rounded-2xl text-xs font-black outline-none appearance-none cursor-pointer"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="un">un</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 p-4 rounded-3xl border border-primary/5 text-center">
                   <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] mb-1">Custo Projetado</p>
                   <p className="text-xl font-black italic">
                     R$ {(initialPrice / (unit === 'kg' || unit === 'L' ? initialQty * 1000 : initialQty || 1)).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                     <span className="text-[10px] text-primary/20 ml-2 uppercase">por { (unit === 'kg' || unit === 'g' ? 'g' : unit === 'L' || unit === 'ml' ? 'ml' : 'un') }</span>
                   </p>
                </div>

                <button 
                  type="submit"
                  className="w-full py-6 bg-secondary text-primary rounded-3xl font-black text-[12px] uppercase tracking-[0.3em] shadow-2xl shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Cadastrar Insumo
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

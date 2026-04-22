"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

import { cn, formatUnitCost } from "@/lib/utils";

interface Insumo {
  id?: string;
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
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [name, setName] = useState("");
  const [initialPrice, setInitialPrice] = useState(0);
  const [initialQty, setInitialQty] = useState(0);
  const [unit, setUnit] = useState<"g" | "kg" | "ml" | "L" | "un">("g");

  const fetchInsumos = async () => {
    const { data } = await supabase.from('insumos').select('*').order('nome');
    if (data) {
      setInsumos(data.map(d => ({
        id: d.id,
        name: d.nome,
        pricePerBaseUnit: Number(d.custo_unitario),
        baseUnit: d.unidade,
        latestPrice: Number(d.custo_unitario),
        latestQty: 0,
        latestUnit: d.unidade,
        lastPurchaseDate: d.created_at,
        createdAt: d.created_at
      })));
    }
  };

  useEffect(() => {
    fetchInsumos();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingInsumo(null);
    setName("");
    setInitialPrice(0);
    setInitialQty(0);
    setUnit("g");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    setName(insumo.name);
    
    // Para edição, carregamos o custo unitário atual como o preço e a quantidade como 1
    // Isso garante que se o usuário não mexer em nada, o valor se mantenha.
    setInitialPrice(insumo.pricePerBaseUnit);
    setInitialQty(1);
    setUnit(insumo.baseUnit as any);
    setIsModalOpen(true);
  };

  const handleSaveInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || initialPrice <= 0 || initialQty <= 0) return;

    let baseQty = initialQty;
    if (unit === "kg" || unit === "L") baseQty = initialQty * 1000;
    
    const pricePerBaseUnit = initialPrice / Math.max(0.000001, baseQty);

    const payload = {
      nome: name,
      unidade: (unit === "kg" || unit === "g") ? "g" : (unit === "L" || unit === "ml" ? "ml" : "un"),
      custo_unitario: pricePerBaseUnit
    };

    if (editingInsumo) {
      const { error } = await supabase.from('insumos').update(payload).eq('id', editingInsumo.id);
      if (error) {
        alert("Erro ao atualizar insumo: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('insumos').insert([payload]);
      if (error) {
        alert("Erro ao salvar insumo: " + error.message);
        return;
      }
    }

    fetchInsumos();
    setIsModalOpen(false);
  };

  const handleDelete = async (nameToDelete: string) => {
    const insumo = insumos.find(i => i.name === nameToDelete);
    if (!insumo) return;

    if (!confirm(`Excluir o insumo "${nameToDelete}"? Isso pode afetar receitas vinculadas.`)) return;
    
    const { error } = await supabase.from('insumos').delete().eq('id', insumo.id || "");
    if (error) {
      await supabase.from('insumos').delete().eq('nome', nameToDelete);
    }
    
    setInsumos(insumos.filter(i => i.name !== nameToDelete));
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      
      const newInsumos = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Suporta tanto vírgula quanto ponto e vírgula
        const separator = line.includes(";") ? ";" : ",";
        const [nome, preco, qtd, unidade] = line.split(separator);
        
        const p = parseFloat(preco.replace(",", "."));
        const q = parseFloat(qtd.replace(",", "."));
        const u = unidade?.trim().toLowerCase();

        if (isNaN(p) || isNaN(q)) continue;

        let baseQty = q;
        let finalBaseUnit: "g" | "ml" | "un" = "un";

        if (u === "kg" || u === "kilo" || u === "quilo" || u === "kg") {
          baseQty = q * 1000;
          finalBaseUnit = "g";
        } else if (u === "g" || u === "gr" || u === "gramas") {
          finalBaseUnit = "g";
        } else if (u === "l" || u === "litro" || u === "litros") {
          baseQty = q * 1000;
          finalBaseUnit = "ml";
        } else if (u === "ml" || u === "milis") {
          finalBaseUnit = "ml";
        } else {
          finalBaseUnit = "un";
        }

        const pricePerBaseUnit = p / Math.max(0.0001, baseQty);

        newInsumos.push({
          nome: nome.trim(),
          unidade: finalBaseUnit,
          custo_unitario: pricePerBaseUnit
        });
      }

      if (newInsumos.length > 0) {
        const { error } = await supabase.from('insumos').insert(newInsumos);
        if (error) {
          alert("Erro ao importar: " + error.message);
        } else {
          alert(`${newInsumos.length} insumos importados com sucesso!`);
          fetchInsumos();
        }
      }
    };
    reader.readAsText(file);
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

            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const content = "nome,preco,quantidade,unidade\nChocolate Callebaut,150.00,1,kg\nLeite Moça,8.50,395,g\nCreme de Leite,35.00,1,L\nEmbalagem P,1.20,1,un";
                  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement("a");
                  const url = URL.createObjectURL(blob);
                  link.setAttribute("href", url);
                  link.setAttribute("download", "modelo_insumos.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-6 py-4 bg-primary/5 text-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary/10 transition-all flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Modelo
              </button>

              <label className="cursor-pointer px-6 py-4 bg-primary/5 text-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary/10 transition-all flex items-center gap-3">
                <span className="material-symbols-outlined text-sm">table_view</span>
                Importar Planilha
                <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
              </label>

              <button 
                onClick={handleOpenCreateModal}
                className="px-8 py-4 bg-secondary text-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-secondary/10 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Novo Insumo
              </button>
            </div>
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
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => handleOpenEditModal(ins)}
                        className="w-8 h-8 rounded-lg text-primary/10 hover:text-secondary hover:bg-secondary/5 transition-all flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(ins.name)}
                        className="w-8 h-8 rounded-lg text-primary/10 hover:text-error hover:bg-error/5 transition-all flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-black uppercase italic tracking-tight truncate">{ins.name}</h3>
                  <p className="text-[10px] font-bold text-primary/30 uppercase tracking-[0.2em] mb-6">Cadastro em {new Date(ins.createdAt || ins.lastPurchaseDate).toLocaleDateString()}</p>

                  <div className="space-y-4">
                    <div className="bg-background/50 p-4 rounded-2xl border border-primary/5">
                      <p className="text-[9px] font-black text-primary/20 uppercase tracking-widest mb-1">Custo por {ins.baseUnit}</p>
                      <p className="text-xl font-black text-secondary italic">
                        R$ {formatUnitCost(ins.pricePerBaseUnit)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-background/30 rounded-xl border border-primary/5">
                         <p className="text-[8px] font-black text-primary/20 uppercase tracking-widest">Último Preço</p>
                         <p className="text-xs font-black">R$ {formatUnitCost(ins.latestPrice)}</p>
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

      {/* Modal de Cadastro/Edição */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-background/95 backdrop-blur-2xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-surface rounded-[48px] shadow-2xl border border-primary/10 overflow-hidden"
            >
              <div className="p-8 bg-secondary text-primary flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">
                    {editingInsumo ? "Editar Insumo" : "Novo Insumo"}
                  </h3>
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
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">
                      {editingInsumo ? "Preço p/ Unidade ou Peso" : "Valor inicial"}
                    </label>
                    <input 
                      type="number"
                      step="0.0001"
                      required
                      value={initialPrice || ""}
                      onChange={(e) => setInitialPrice(Number(e.target.value))}
                      className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-black transition-all"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Quantidade / Medida</label>
                    <div className="flex bg-background border border-primary/5 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-secondary/50 transition-all">
                      <input 
                        type="number"
                        required
                        value={initialQty || ""}
                        onChange={(e) => setInitialQty(Number(e.target.value))}
                        className="flex-1 p-4 bg-transparent outline-none text-sm font-black min-w-0"
                        placeholder="Ex: 395"
                      />
                      <div className="w-px bg-primary/10 self-stretch my-2" />
                      <div className="relative flex items-center bg-primary/5 px-2">
                        <select 
                          value={unit}
                          onChange={(e: any) => setUnit(e.target.value)}
                          className="pl-2 pr-6 py-2 bg-transparent text-secondary text-[10px] font-black uppercase outline-none cursor-pointer appearance-none min-w-[60px]"
                        >
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="ml">ml</option>
                          <option value="L">l</option>
                          <option value="un">un</option>
                          <option value="und">und</option>
                          <option value="cx">cx</option>
                          <option value="pct">pct</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-1 pointer-events-none text-secondary text-xs">expand_more</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 p-4 rounded-3xl border border-primary/5 text-center">
                   <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] mb-1">Custo Projetado</p>
                   <p className="text-xl font-black italic">
                     R$ {formatUnitCost(initialPrice / (unit === 'kg' || unit === 'L' ? initialQty * 1000 : initialQty || 1))}
                     <span className="text-[10px] text-primary/20 ml-2 uppercase">por { (unit === 'kg' || unit === 'g' ? 'g' : unit === 'L' || unit === 'ml' ? 'ml' : 'un') }</span>
                   </p>
                </div>

                <button 
                  type="submit"
                  className="w-full py-6 bg-secondary text-primary rounded-3xl font-black text-[12px] uppercase tracking-[0.3em] shadow-2xl shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {editingInsumo ? "Salvar Alterações" : "Cadastrar Insumo"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

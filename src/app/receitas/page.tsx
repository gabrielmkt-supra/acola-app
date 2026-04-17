"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface Insumo {
  name: string;
  pricePerBaseUnit: number;
  baseUnit: "g" | "ml" | "un";
  latestPrice: number;
  latestQty: number;
  vendor: string;
}

interface RecipeItem {
  insumoName: string;
  qty: number;
  scaleType: "lote" | "unidade" | "inteiro";
}

interface Product {
  id: string;
  name: string;
  category: string;
  cost: string;
}

export default function Receitas() {
  const [products, setProducts] = useState<Product[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [currentRecipe, setCurrentRecipe] = useState<RecipeItem[]>([]);
  const [rendimento, setRendimento] = useState<number>(1);
  
  // Load data
  useEffect(() => {
    const savedProducts = localStorage.getItem("acola_estoque");
    if (savedProducts) setProducts(JSON.parse(savedProducts));

    const savedInsumos = localStorage.getItem("acola_insumos");
    if (savedInsumos) setInsumos(JSON.parse(savedInsumos));

    const savedReceitas = localStorage.getItem("acola_receitas");
    if (savedReceitas && selectedProductId) {
      const allReceitas = JSON.parse(savedReceitas);
      const data = allReceitas[selectedProductId];
      
      if (Array.isArray(data)) {
        // Compatibilidade com dados antigos (apenas array)
        setCurrentRecipe(data);
        setRendimento(1);
      } else if (data) {
        // Novo formato (objeto com items e rendimento)
        setCurrentRecipe(data.items || []);
        setRendimento(data.rendimento || 1);
      } else {
        setCurrentRecipe([]);
        setRendimento(1);
      }
    } else {
      setCurrentRecipe([]);
      setRendimento(1);
    }
  }, [selectedProductId]);

  const addIngredient = () => {
    if (insumos.length === 0) return;
    setCurrentRecipe([...currentRecipe, { insumoName: insumos[0].name, qty: 0, scaleType: "lote" }]);
  };

  const removeIngredient = (index: number) => {
    setCurrentRecipe(currentRecipe.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof RecipeItem, value: any) => {
    const newRecipe = [...currentRecipe];
    newRecipe[index] = { ...newRecipe[index], [field]: value };
    setCurrentRecipe(newRecipe);
  };

  const calculateBatchCost = () => {
    return currentRecipe.reduce((acc, item) => {
      const insumo = insumos.find(i => i.name === item.insumoName);
      if (!insumo) return acc;
      
      if (item.scaleType === "inteiro") {
        return acc + (insumo.latestPrice || 0);
      }

      const effectiveQty = item.scaleType === "unidade" 
        ? item.qty * rendimento 
        : item.qty;
        
      return acc + (insumo.pricePerBaseUnit * effectiveQty);
    }, 0);
  };

  const calculateUnitCost = () => {
    return currentRecipe.reduce((acc, item) => {
      const insumo = insumos.find(i => i.name === item.insumoName);
      if (!insumo) return acc;

      if (item.scaleType === "inteiro") {
        return acc + ((insumo.latestPrice || 0) / rendimento);
      }

      const effectiveQtyPerUnit = item.scaleType === "unidade"
        ? item.qty
        : item.qty / rendimento;

      return acc + (insumo.pricePerBaseUnit * effectiveQtyPerUnit);
    }, 0);
  };

  const handleSaveRecipe = () => {
    if (!selectedProductId) return;

    // 1. Save recipe mapping
    const savedReceitas = localStorage.getItem("acola_receitas");
    const allReceitas = savedReceitas ? JSON.parse(savedReceitas) : {};
    allReceitas[selectedProductId] = {
      items: currentRecipe,
      rendimento: rendimento
    };
    localStorage.setItem("acola_receitas", JSON.stringify(allReceitas));

    alert("Receita salva com sucesso!");
  };

  const updateProductCost = () => {
    if (!selectedProductId) return;
    const unitCost = calculateUnitCost();

    const savedProducts = localStorage.getItem("acola_estoque");
    if (savedProducts) {
      const allProducts: Product[] = JSON.parse(savedProducts);
      const updated = allProducts.map(p => {
        if (p.id === selectedProductId) {
          return { ...p, cost: `R$ ${unitCost.toFixed(2)}` };
        }
        return p;
      });
      localStorage.setItem("acola_estoque", JSON.stringify(updated));
      setProducts(updated);
      alert(`O preço de custo por UNIDADE do produto foi atualizado para R$ ${unitCost.toFixed(2)}`);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      <header className="px-8 py-8 border-b border-primary/5 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
             <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
             </Link>
             <div>
               <h1 className="text-2xl font-black text-primary tracking-tight uppercase italic">Fichas Técnicas</h1>
               <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Gestão de Receitas e Custos de Produção</p>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1920px] mx-auto w-full grid grid-cols-12 gap-8 overflow-hidden">
        
        {/* Lado Esquerdo: Seleção de Produto */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
          <div className="bg-surface rounded-[40px] border border-primary/5 shadow-sm p-8 flex flex-col gap-6">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Selecione o Produto</label>
              <div className="grid gap-3 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={cn(
                      "p-5 rounded-3xl border transition-all text-left flex items-center justify-between group",
                      selectedProductId === p.id 
                        ? "bg-secondary border-primary shadow-lg scale-[1.02]" 
                        : "bg-background border-primary/5 hover:border-secondary/40"
                    )}
                  >
                    <div>
                      <p className={cn("text-xs font-black uppercase italic tracking-tighter", selectedProductId === p.id ? "text-primary" : "text-primary/80")}>
                        {p.name}
                      </p>
                      <p className={cn("text-[9px] font-bold uppercase", selectedProductId === p.id ? "text-primary/40" : "text-primary/20")}>
                        {p.category}
                      </p>
                    </div>
                    <span className={cn("material-symbols-outlined text-sm", selectedProductId === p.id ? "text-primary" : "text-primary/10 group-hover:text-secondary")}>
                      {selectedProductId === p.id ? "check_circle" : "chevron_right"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-secondary text-primary p-8 rounded-[40px] shadow-xl shadow-secondary/10 flex flex-col justify-between h-48 relative overflow-hidden group/card">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/card:scale-110 transition-transform">
                 <span className="material-symbols-outlined text-7xl italic">analytics</span>
              </div>
              <div className="relative z-10 space-y-4">
                <div>
                  <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.3em]">Custo do Lote (Total)</p>
                  <h2 className="text-2xl font-black italic mt-1">
                    R$ {calculateBatchCost().toFixed(2)}
                  </h2>
                </div>
                
                <div className="pt-4 border-t border-primary/10">
                  <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.3em]">Custo por Unidade</p>
                  <h2 className="text-4xl font-black italic mt-1">
                    R$ {calculateUnitCost().toFixed(2)}
                  </h2>
                  {selectedProduct && selectedProduct.cost !== `R$ ${calculateUnitCost().toFixed(2)}` && (
                    <p className="text-[9px] font-bold opacity-60 mt-2 uppercase tracking-widest">
                      ⚠️ No estoque: {selectedProduct.cost}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={updateProductCost}
                disabled={!selectedProductId}
                className="relative z-10 bg-primary text-background px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest self-start mt-4 shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
              >
                Atualizar no Estoque
              </button>
          </div>
        </div>

        {/* Lado Direito: Composição da Receita */}
        <div className="col-span-12 lg:col-span-8 bg-surface rounded-[40px] border border-primary/5 shadow-sm flex flex-col overflow-hidden">
          <div className="p-8 border-b border-primary/5 bg-surface-variant/10 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div>
                 <h2 className="text-sm font-black text-primary uppercase tracking-widest italic">Composição do Lote</h2>
                 <p className="text-[9px] font-bold text-primary/30 uppercase mt-1">Defina os ingredientes para a produção total</p>
              </div>

              <div className="flex items-center gap-3 px-6 py-2 bg-background border border-primary/5 rounded-2xl">
                <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Rendimento:</label>
                <input 
                  type="number" 
                  min="1"
                  value={rendimento}
                  onChange={(e) => setRendimento(Math.max(1, Number(e.target.value)))}
                  className="w-16 bg-transparent text-sm font-black text-secondary outline-none text-center"
                />
                <span className="text-[9px] font-bold text-primary/30 uppercase">unidades</span>
              </div>
            </div>
            <button 
              onClick={addIngredient}
              disabled={!selectedProductId}
              className="bg-secondary/10 text-secondary hover:bg-secondary hover:text-primary px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Adicionar Insumo
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
            {!selectedProductId ? (
              <div className="h-full flex flex-col items-center justify-center text-primary/10 gap-4 opacity-50">
                <span className="material-symbols-outlined text-7xl italic">draw</span>
                <p className="text-xs font-black uppercase tracking-[0.3em]">Selecione um produto para editar a receita</p>
              </div>
            ) : currentRecipe.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-primary/10 gap-4 opacity-50">
                 <span className="material-symbols-outlined text-7xl italic">format_list_bulleted</span>
                 <p className="text-xs font-black uppercase tracking-[0.3em]">Nenhum ingrediente adicionado</p>
                 <button onClick={addIngredient} className="text-[10px] font-black text-secondary uppercase tracking-widest border border-secondary/20 px-4 py-2 rounded-xl hover:bg-secondary/10 transition-all">
                    Começar Receita
                 </button>
               </div>
            ) : (
              <div className="space-y-4">
                {currentRecipe.map((item, idx) => {
                  const insumoInfo = insumos.find(i => i.name === item.insumoName);
                  
                  // Cálculo do custo da linha baseado na escala
                  const lineTotalCost = insumoInfo 
                    ? (item.scaleType === "inteiro" 
                        ? (insumoInfo.latestPrice || 0)
                        : insumoInfo.pricePerBaseUnit * (item.scaleType === "unidade" ? item.qty * rendimento : item.qty))
                    : 0;

                  return (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-background/50 border border-primary/5 rounded-[32px] p-6 grid grid-cols-12 gap-4 items-center hover:border-secondary/20 transition-all group"
                    >
                      {/* Insumo */}
                      <div className="col-span-4 space-y-2">
                         <label className="text-[9px] font-black text-primary/30 uppercase tracking-widest ml-1">Insumo</label>
                         <select 
                           value={item.insumoName}
                           onChange={(e) => updateIngredient(idx, "insumoName", e.target.value)}
                           className="w-full bg-surface border border-primary/5 rounded-2xl p-4 text-xs font-black uppercase outline-none appearance-none cursor-pointer"
                         >
                           {insumos.map(i => (i.name && (
                             <option key={i.name} value={i.name}>{i.name}</option>
                           )))}
                         </select>
                      </div>

                      {/* Escala */}
                      <div className="col-span-3 space-y-2">
                         <label className="text-[9px] font-black text-primary/30 uppercase tracking-widest ml-1">Tipo de Escala</label>
                         <div className="flex bg-surface p-1 rounded-2xl border border-primary/5 gap-1">
                            <button 
                              onClick={() => updateIngredient(idx, "scaleType", "lote")}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all",
                                item.scaleType === "lote" ? "bg-primary text-background" : "text-primary/40 hover:bg-primary/5"
                              )}
                            >Lote</button>
                            <button 
                              onClick={() => updateIngredient(idx, "scaleType", "unidade")}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all",
                                item.scaleType === "unidade" ? "bg-secondary text-background" : "text-primary/40 hover:bg-primary/5"
                              )}
                            >Unid.</button>
                            <button 
                              onClick={() => updateIngredient(idx, "scaleType", "inteiro")}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all",
                                item.scaleType === "inteiro" ? "bg-accent text-background" : "text-primary/40 hover:bg-primary/5"
                              )}
                            >Inteiro</button>
                         </div>
                      </div>

                      {/* Quantidade */}
                      <div className="col-span-2 space-y-2">
                         {item.scaleType !== "inteiro" ? (
                           <>
                             <label className="text-[9px] font-black text-primary/30 uppercase tracking-widest ml-1">
                               {item.scaleType === "unidade" ? "Qtd p/ Un." : "Qtd Total"}
                             </label>
                             <input 
                               type="number"
                               value={item.qty}
                               onChange={(e) => updateIngredient(idx, "qty", Number(e.target.value))}
                               className="w-full bg-surface border border-primary/5 rounded-2xl p-4 text-xs font-black outline-none"
                             />
                           </>
                         ) : (
                           <div className="h-full flex flex-col justify-center gap-1">
                              <span className="material-symbols-outlined text-accent text-lg">package_2</span>
                              <p className="text-[8px] font-black text-accent uppercase leading-tight">Uso Integral da Embalagem</p>
                           </div>
                         )}
                      </div>

                      {/* Custo e Info */}
                      <div className="col-span-2 flex flex-col items-end">
                         <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest mr-1 mb-1 italic">Custo no Lote</span>
                         <p className="text-sm font-black text-primary italic">R$ {lineTotalCost.toFixed(2)}</p>
                         <p className="text-[8px] font-bold text-primary/20 uppercase mt-1">
                            {item.scaleType === "unidade" 
                              ? `Total Lote: ${(item.qty * rendimento).toFixed(2)}${insumoInfo?.baseUnit}`
                              : item.scaleType === "inteiro"
                              ? `1 Emb. Completa (${insumoInfo?.latestQty || 0}${insumoInfo?.baseUnit})`
                              : `Por unidade: ${(item.qty / rendimento).toFixed(2)}${insumoInfo?.baseUnit}`
                            }
                         </p>
                      </div>

                      {/* Remover */}
                      <div className="col-span-1 flex justify-end">
                        <button 
                          onClick={() => removeIngredient(idx)}
                          className="w-8 h-8 rounded-full bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:scale-110 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}

                <div className="pt-10 flex justify-end gap-4">
                  <button 
                    onClick={handleSaveRecipe}
                    className="px-10 py-5 bg-surface border border-primary/10 rounded-[24px] text-xs font-black text-primary uppercase tracking-[0.2em] hover:bg-primary/5 transition-all"
                  >
                    Salvar Receita
                  </button>
                  <button 
                    onClick={updateProductCost}
                    className="px-10 py-5 bg-secondary text-primary rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-secondary/10 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Confirmar & Atualizar Custo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

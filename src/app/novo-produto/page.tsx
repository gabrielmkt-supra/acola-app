"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn, formatUnitCost } from "@/lib/utils";
import { getSettings, AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";

interface RecipeIngredient {
  id: string;
  insumoId?: string;
  name: string;
  type: 'lote' | 'unidade' | 'inteiro';
  qty: number;
  unit: string;
  unitCost: number; // Preço por grama/unidade
  packagePrice?: number; // Preço da embalagem fechada
  packageQty?: number; // Quantidade na embalagem fechada
}

function NovoProdutoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [viewMode, setViewMode] = useState<"new" | "loading">("loading");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Trufa");
  const [precoVenda, setPrecoVenda] = useState(0);
  const [estoqueInicial, setEstoqueInicial] = useState(0);
  const [rendimento, setRendimento] = useState(1);
  const [foto, setFoto] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ingredientes, setIngredientes] = useState<RecipeIngredient[]>([]);
  const [masterInsumos, setMasterInsumos] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [subtipo, setSubtipo] = useState<"premium" | "classico" | "">("premium");
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "alert" | "success" }[]>([]);
  const [appConfigs, setAppConfigs] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Função para converter dados antigos para o novo formato
  const transformLegacyRecipe = (items: any) => {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map(item => ({
      id: item.id || `ing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: item.name || item.insumoName || "",
      type: (item.type || item.scaleType || "lote") as 'lote' | 'unidade' | 'inteiro',
      qty: Number(item.qty || 0),
      unit: item.unit || "g",
      unitCost: Number(item.unitCost || 0)
    }));
  };

  // Carregar configurações globais
  useEffect(() => {
    const loadConfigs = async () => {
      const s = await getSettings();
      setAppConfigs(s);
    };
    loadConfigs();
  }, []);

  // Determinar modo inicial e carregar dados para edição
  useEffect(() => {
    if (editId) {
      const loadEditData = async () => {
        setIsSaving(true);
        try {
          const { data: prod, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', editId)
            .single();

          if (error) throw error;

          if (prod) {
            setNome(prod.name);
            setCategoria(prod.category || "Trufa");
            setSubtipo((prod.subtype as any) || "premium");
            setPrecoVenda(Number(prod.price || 0));
            setEstoqueInicial(Number(prod.stock || 0));
            setFoto(prod.image || "");

            // Tentar carregar receita de forma robusta
            let recipeSource = prod.recipe;
            
            if (recipeSource) {
              try {
                const recipeData = typeof recipeSource === 'string' ? JSON.parse(recipeSource) : recipeSource;
                const rawItems = Array.isArray(recipeData) 
                  ? recipeData 
                  : (recipeData.items || recipeData.ingredients || recipeData.componentes || []);
                
                setIngredientes(transformLegacyRecipe(rawItems));
                const yieldVal = recipeData.rendimento || recipeData.yield || recipeData.yieldQty || 1;
                setRendimento(Number(yieldVal));
              } catch (e) {
                console.error("Erro ao processar dados da receita:", e);
              }
            }
          }
        } catch (err) {
          console.error("Erro ao carregar produto para edição:", err);
          addToast("Não foi possível carregar o produto.", "alert");
        } finally {
          setIsSaving(false);
          setViewMode("new");
        }
      };
      loadEditData();
    } else {
      setViewMode("new");
    }
  }, [editId]);

  const addToast = (message: string, type: "alert" | "success" = "alert") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Carregar insumos
  useEffect(() => {
    const fetchData = async () => {
      const { data: insData } = await supabase.from('insumos').select('*').order('nome');
      if (insData) setMasterInsumos(insData.map(d => ({
        id: d.id,
        name: d.nome,
        unit: d.unidade,
        unitCost: Number(d.custo_unitario),
        latestPrice: Number(d.latest_price || d.custo_unitario || 0),
        latestQty: Number(d.latest_qty || 1)
      })));
    };
    
    if (viewMode === "new") {
      fetchData();
    }
  }, [viewMode]);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Lógica de Salvar no Supabase
  const handleSave = async () => {
    if (!nome || precoVenda <= 0) {
      addToast("Por favor, preencha o nome e o preço de venda.", "alert");
      return;
    }

    setIsSaving(true);
    
    try {
      const recipePayload = {
        items: ingredientes,
        rendimento: rendimento
      };

      const productPayload: any = {
        name: nome,
        category: categoria,
        subtype: categoria === "Geladinho" ? subtipo : "",
        cost: Number(custoTotal),
        price: Number(precoVenda),
        stock: Number(estoqueInicial),
        image: foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=2a2a2a&color=c9a84c&bold=true&size=128`,
        status: 'active',
        recipe: recipePayload
      };

      let error;
      
      if (editId) {
        const { error: updateError } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', editId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert([productPayload]);
        error = insertError;
      }

      if (error) throw error;

      addToast(editId ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!", "success");

      await new Promise(resolve => setTimeout(resolve, 800));
      router.push("/");
    } catch (error: any) {
      console.error("Erro ao salvar no Supabase:", error);
      addToast("Erro ao salvar o produto no banco de dados.", "alert");
    } finally {
      setIsSaving(false);
    }
  };

  const addIngredient = () => {
    const newIngredient: RecipeIngredient = {
      id: `ing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: "",
      type: "lote",
      qty: 0,
      unit: "g",
      unitCost: 0,
    };
    setIngredientes(prev => [...prev, newIngredient]);
  };

  const removeIngredient = (id: string) => {
    setIngredientes(ingredientes.filter((i) => i.id !== id));
  };

  const updateIngredient = (id: string, field: keyof RecipeIngredient, value: any) => {
    setIngredientes(
      ingredientes.map((i) => {
        if (i.id === id) {
          const updated = { ...i, [field]: value };
          
          if (field === "name") {
            const matched = masterInsumos.find(mi => mi.name.toLowerCase() === value.toLowerCase());
            if (matched) {
              updated.insumoId = matched.id;
              updated.unitCost = matched.unitCost;
              updated.unit = matched.unit;
              updated.packagePrice = matched.latestPrice;
              updated.packageQty = matched.latestQty;
            }
          }

          if (field === "type" && value === "inteiro") {
             updated.qty = 1;
          }

          return updated;
        }
        return i;
      })
    );
  };

  const custosIngredientes = ingredientes.map((i) => {
    if (i.unitCost < 0) return 0;

    let cost = 0;
    if (i.type === 'unidade') {
      cost = i.unitCost * (i.qty || 0);
    } else if (i.type === 'lote') {
      cost = (i.unitCost * (i.qty || 0)) / Math.max(1, rendimento);
    } else if (i.type === 'inteiro') {
      const fullPrice = (i.packagePrice && i.packagePrice > 1) ? i.packagePrice : (i.unitCost * (i.packageQty || 1));
      cost = fullPrice / Math.max(1, rendimento);
    }
    
    return cost;
  });

  const subtotalReceita = custosIngredientes.reduce((acc, curr) => acc + curr, 0);
  const margemSeguranca = subtotalReceita * 0.05;
  const custoTotal = subtotalReceita + margemSeguranca;
  const lucroBruto = precoVenda - custoTotal;
  const margemLucro = precoVenda > 0 ? (lucroBruto / precoVenda) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {viewMode === "loading" && (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <div className="w-12 h-12 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin" />
              <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">Preparando Ambiente...</p>
            </div>
          )}

          {viewMode === "new" && (
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
                <div className="bg-surface p-6 rounded-[32px] border border-primary/5 shadow-sm space-y-6">
                  <h2 className="text-sm font-black text-primary uppercase tracking-widest border-b border-primary/5 pb-4">Básico</h2>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={async (e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files?.[0] || null); }}
                    className={cn(
                      "aspect-square rounded-2xl bg-surface-variant flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-all cursor-pointer overflow-hidden relative group",
                      isDragging ? "border-secondary bg-secondary/5" : "border-primary/10 text-primary/30 hover:border-secondary hover:text-secondary"
                    )}
                  >
                    {foto ? (
                      <>
                        <img src={foto} className="w-full h-full object-cover" alt="Preview" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                           <span className="material-symbols-outlined text-white">upload</span>
                           <span className="text-[8px] font-black text-white uppercase tracking-widest">Trocar Foto</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Foto do Produto</span>
                      </>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Nome do Produto</label>
                      <input 
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all text-primary" 
                        placeholder="Ex: Trufa de Maracujá" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Categoria</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {appConfigs.categories.map(cat => (
                          <button 
                            key={cat}
                            type="button"
                            onClick={() => { 
                              setCategoria(cat); 
                              if (cat === "Geladinho") setSubtipo("premium"); 
                              else setSubtipo(""); 
                            }}
                            className={cn(
                              "py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border cursor-pointer",
                              categoria === cat 
                                ? "bg-secondary text-primary border-primary shadow-md" 
                                : "bg-background text-primary/40 border-primary/5 hover:bg-primary/5"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {categoria === "Geladinho" && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Linha do Geladinho</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["premium", "classico"] as const).map(sub => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => setSubtipo(sub)}
                              className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border cursor-pointer flex flex-col items-center gap-1 ${
                                subtipo === sub
                                  ? sub === "premium"
                                    ? "bg-secondary text-primary border-secondary shadow-md"
                                    : "bg-accent/10 text-accent border-accent/30 shadow-md"
                                  : "bg-background text-primary/40 border-primary/5 hover:bg-primary/5"
                              }`}
                            >
                              <span className="material-symbols-outlined text-base">{sub === "premium" ? "workspace_premium" : "style"}</span>
                              {sub === "premium" ? "Premium" : "Clássico"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Preço Venda</label>
                        <input 
                          type="number"
                          value={precoVenda || ""}
                          onChange={(e) => setPrecoVenda(Number(e.target.value))}
                          className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all text-secondary" 
                          placeholder="0,00" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Estoque Inicial</label>
                        <input 
                          type="number"
                          value={estoqueInicial || ""}
                          onChange={(e) => setEstoqueInicial(Number(e.target.value))}
                          className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all text-primary" 
                          placeholder="0" 
                        />
                      </div>
                    </div>
                  </div>
                </div>


                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full h-14 bg-secondary text-primary rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-secondary/20 disabled:opacity-50"
                >
                  {isSaving ? "SALVANDO..." : (editId ? "ATUALIZAR PRODUTO" : "SALVAR PRODUTO")}
                </button>
              </div>

              <div className="flex-1 bg-surface rounded-[32px] border border-primary/5 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="bg-surface-variant/10 p-6 m-6 rounded-[32px] border border-primary/5 flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    <div className="bg-background/40 p-4 rounded-2xl border border-primary/5">
                      <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest mb-1">Custo Total</p>
                      <p className="text-xl font-black text-primary italic">R$ {formatUnitCost(custoTotal)}</p>
                    </div>
                    <div className="bg-background/40 p-4 rounded-2xl border border-primary/5">
                      <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest mb-1">Preço Venda</p>
                      <p className="text-xl font-black text-secondary italic">R$ {formatUnitCost(precoVenda)}</p>
                    </div>
                    <div className="bg-background/40 p-4 rounded-2xl border border-primary/5">
                      <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest mb-1">Lucro Líquido</p>
                      <p className="text-xl font-black text-primary italic">R$ {formatUnitCost(precoVenda - custoTotal)}</p>
                    </div>
                    <div className="bg-background/40 p-4 rounded-2xl border border-primary/5">
                      <p className="text-[8px] font-black text-primary/30 uppercase tracking-widest mb-1">Margem</p>
                      <p className={cn(
                        "text-xl font-black italic",
                        margemLucro > 50 ? "text-secondary" : margemLucro > 30 ? "text-primary" : "text-error"
                      )}>
                        {margemLucro.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-8 py-6 border-b border-primary/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-black text-primary tracking-tight uppercase">Receita & Custos</h2>
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Gestão detalhada de insumos</p>
                  </div>
                  
                  <div className="flex items-center gap-6 bg-background/50 px-6 py-3 rounded-2xl border border-primary/5">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-primary/30 uppercase tracking-widest">Rendimento Lote</span>
                      <div className="flex items-center gap-2">
                         <input 
                           type="number"
                           value={rendimento}
                           onChange={(e) => setRendimento(Math.max(1, Number(e.target.value)))}
                           className="w-12 bg-transparent text-sm font-black text-secondary outline-none border-b border-secondary/20 focus:border-secondary transition-all"
                         />
                         <span className="text-[10px] font-black text-primary/40 uppercase">UN</span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-primary/10" />
                    <button 
                      type="button"
                      onClick={addIngredient}
                      className="flex items-center gap-2 text-secondary hover:text-secondary/80 transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">add_circle</span>
                      Novo Item
                    </button>
                  </div>
               </div>

                <div className="flex-1 overflow-x-auto p-4 md:p-8">
                  <div className="min-w-[900px] flex flex-col gap-4">
                    <AnimatePresence>
                      {ingredientes.length === 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center py-32 text-primary/10"
                        >
                          <span className="material-symbols-outlined text-7xl mb-4 italic">restaurant_menu</span>
                          <p className="font-black text-[10px] uppercase tracking-[0.4em] text-center max-w-[250px]">Adicione insumos para calcular o custo</p>
                        </motion.div>
                      ) : (
                        ingredientes.map((ing, idx) => {
                          const itemCost = custosIngredientes[idx];

                          return (
                            <motion.div 
                               key={ing.id}
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0, scale: 0.95 }}
                               className="p-5 bg-background/40 rounded-[32px] grid grid-cols-12 gap-6 items-center border border-primary/5 hover:border-secondary/20 transition-all shadow-sm"
                            >
                               <div className="col-span-3 space-y-1.5">
                                  <label className="text-[9px] font-black text-primary/30 uppercase tracking-widest ml-1">Insumo</label>
                                  <div className="relative">
                                    <input 
                                       list="master-insumos"
                                       className="w-full bg-background/80 rounded-2xl p-4 text-xs font-black outline-none border border-primary/10 focus:border-secondary transition-all text-primary"
                                       placeholder="Buscar..."
                                       value={ing.name}
                                       onChange={(e) => updateIngredient(ing.id, "name", e.target.value)}
                                    />
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary/10 text-lg">search</span>
                                  </div>
                                  <datalist id="master-insumos">
                                     {masterInsumos.map(mi => <option key={mi.id} value={mi.name} />)}
                                  </datalist>
                               </div>

                               <div className="col-span-3 space-y-1.5">
                                  <label className="text-[9px] font-black text-primary/30 uppercase tracking-widest ml-1">Tipo de Uso</label>
                                  <div className="flex bg-background/80 rounded-2xl p-1.5 border border-primary/10 h-[54px] items-center">
                                     {(['lote', 'unidade', 'inteiro'] as const).map(type => (
                                       <button
                                         key={type}
                                         type="button"
                                         onClick={() => updateIngredient(ing.id, "type", type)}
                                         className={cn(
                                           "flex-1 h-full rounded-xl text-[9px] font-black uppercase tracking-tight transition-all",
                                           ing.type === type ? "bg-secondary text-primary shadow-lg" : "text-primary/20 hover:text-primary hover:bg-primary/5"
                                         )}
                                       >
                                         {type === 'lote' ? 'Lote' : type === 'unidade' ? 'Unit' : 'Inteiro'}
                                       </button>
                                     ))}
                                  </div>
                               </div>

                               <div className={cn("col-span-2 space-y-1.5", ing.type === 'inteiro' ? "opacity-20 pointer-events-none" : "")}>
                                  <label className="text-[9px] font-black text-primary/30 uppercase tracking-widest ml-1">Qtd ({ing.unit})</label>
                                  <input 
                                     type="number"
                                     disabled={ing.type === 'inteiro'}
                                     className="w-full h-[54px] bg-background/80 rounded-2xl p-4 text-sm font-black outline-none border border-primary/10 focus:border-secondary text-center"
                                     value={ing.qty || ""}
                                     onChange={(e) => updateIngredient(ing.id, "qty", Number(e.target.value))}
                                  />
                               </div>

                               <div className="col-span-3">
                                  <div className="bg-primary/5 rounded-[24px] px-6 py-3 border border-primary/5 flex justify-between items-center h-[54px]">
                                     <div className="text-left">
                                        <p className="text-[8px] font-black text-primary/20 uppercase tracking-widest leading-none mb-1">Custo</p>
                                        <p className="text-sm font-black text-primary italic leading-tight">
                                           R$ {formatUnitCost(ing.type === 'inteiro' ? (ing.packagePrice && ing.packagePrice > 1 ? ing.packagePrice : (ing.unitCost * (ing.packageQty || 1))) : itemCost)}
                                        </p>
                                     </div>
                                     <div className="w-px h-6 bg-primary/5" />
                                     <div className="text-right">
                                        <p className="text-[8px] font-black text-secondary/30 uppercase tracking-widest leading-none mb-1">Subtotal</p>
                                        <p className="text-xs font-black text-secondary italic leading-tight">
                                           R$ {formatUnitCost(itemCost * rendimento)}
                                        </p>
                                     </div>
                                  </div>
                               </div>

                               <div className="col-span-1 flex justify-center">
                                  <button 
                                    onClick={() => removeIngredient(ing.id)} 
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-error/5 text-error/30 hover:bg-error hover:text-white transition-all cursor-pointer"
                                  >
                                     <span className="material-symbols-outlined text-lg">delete</span>
                                  </button>
                               </div>
                            </motion.div>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

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

export default function NovoProduto() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-background text-primary/30 font-black uppercase tracking-widest">
        Carregando Calculadora...
      </div>
    }>
      <NovoProdutoContent />
    </Suspense>
  );
}

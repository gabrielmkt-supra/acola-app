"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function NovoProduto() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"selection" | "new" | "restock" | "import">("selection");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Trufa");
  const [precoVenda, setPrecoVenda] = useState(0);
  const [estoqueInicial, setEstoqueInicial] = useState(0);
  const [rendimento, setRendimento] = useState(1); // Novo campo de rendimento
  const [foto, setFoto] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ingredientes, setIngredientes] = useState<RecipeIngredient[]>([]);
  const [masterInsumos, setMasterInsumos] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [subtipo, setSubtipo] = useState<"premium" | "classico" | "">("premium");
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "alert" | "success" }[]>([]);

  const addToast = (message: string, type: "alert" | "success" = "alert") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Estados de importação
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [isDraggingImport, setIsDraggingImport] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const importFileRef = useRef<HTMLInputElement>(null);

  // Carregar inventário e insumos
  useEffect(() => {
    const fetchData = async () => {
      const { data: prodData } = await supabase.from('products').select('*').order('name');
      if (prodData) setInventory(prodData);

      const { data: insData } = await supabase.from('insumos').select('*').order('nome');
      if (insData) setMasterInsumos(insData.map(d => ({
        id: d.id,
        name: d.nome,
        unit: d.unidade,
        unitCost: Number(d.custo_unitario),
        // Fallbacks para colunas que podem não existir no banco
        latestPrice: Number(d.latest_price || d.custo_unitario || 0),
        latestQty: Number(d.latest_qty || 1)
      })));
    };
    
    if (viewMode === "restock" || viewMode === "new") {
      fetchData();
    }
  }, [viewMode]);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 320; // Reduzido de 500 para 320
        const MAX_HEIGHT = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", 0.4)); // Qualidade reduzida de 0.7 para 0.4 para economizar espaço
      };
    });
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const compressed = await compressImage(base64);
      setFoto(compressed);
    };
    reader.readAsDataURL(file);
  };

  // Migração automática: classificar geladinhos já cadastrados
  useEffect(() => {
    const savedData = localStorage.getItem("acola_estoque");
    if (!savedData) return;
    const items: any[] = JSON.parse(savedData);

    const premiums = ["ninho com nutella", "maracujá com nutella", "morango com nutella", "maracuja com nutella"];
    const classicos = ["oreo", "mousse de maracujá", "tortinha de limão", "mousse de maracuja", "tortinha de limao"];

    let updated = false;
    const migrated = items.map(item => {
      if (item.category !== "Geladinho" || item.subtype) return item;
      const nameLower = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (premiums.some(p => nameLower.includes(p.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
        updated = true;
        return { ...item, subtype: "premium" };
      }
      if (classicos.some(c => nameLower.includes(c.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
        updated = true;
        return { ...item, subtype: "classico" };
      }
      return item;
    });

    if (updated) {
      localStorage.setItem("acola_estoque", JSON.stringify(migrated));
    }
  }, []);

  // Helper para normalizar volumes para base (g, ml, un) e retornar família
  const getUnitData = (qty: number, unit: string) => {
    let baseQty = qty;
    let family = "count";

    if (unit === "kg" || unit === "g") family = "weight";
    if (unit === "L" || unit === "ml") family = "volume";

    if (unit === "kg" || unit === "L") baseQty = qty * 1000;
    
    return { baseQty, family };
  };

  // ── IMPORTAÇÃO CSV ──────────────────────────────────────────
  const parseCSV = useCallback((text: string): any[] => {
    // Remove BOM (Excel UTF-8)
    const clean = text.replace(/^\uFEFF/, "").trim();
    const lines = clean.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Detecta separador (; ou ,)
    const sep = lines[0].includes(";") ? ";" : ",";
    const rawHeaders = lines[0].split(sep).map(h => h.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]/g, ""));

    const find = (aliases: string[]) => rawHeaders.findIndex(h => aliases.some(a => h.includes(a)));

    const cols = {
      nome:      find(["nome", "name", "produto", "product"]),
      categoria: find(["categoria", "category", "cat", "tipo", "type"]),
      preco:     find(["precovenda", "preco_venda", "venda", "price", "valor", "preco"]),
      custo:     find(["precocusto", "preco_custo", "custo", "cost"]),
      estoque:   find(["estoque", "stock", "quantidade", "qtd", "qty", "quant"]),
    };

    const parseNum = (v: string) => parseFloat((v || "0").replace(",", ".").replace(/[^0-9.]/g, "")) || 0;

    return lines.slice(1)
      .filter(l => l.trim())
      .map((line, idx) => {
        const c = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
        const get = (col: number) => col >= 0 ? (c[col] ?? "") : "";

        const nome = get(cols.nome);
        if (!nome) return null;

        const catRaw = get(cols.categoria);
        const categoria = ["Trufa", "Geladinho"].find(
          cat => catRaw.toLowerCase().includes(cat.toLowerCase())
        ) ?? "Trufa";

        const preco  = parseNum(get(cols.preco));
        const custo  = parseNum(get(cols.custo));
        const stock  = Math.round(parseNum(get(cols.estoque)));

        return {
          id: `PROD-${Date.now().toString().slice(-6)}-${idx}`,
          name: nome,
          category: categoria,
          price: `R$${preco.toFixed(2)}`,
          cost: `R$${custo.toFixed(2)}`,
          stock,
          image: "",
          status: stock < 20 ? "ESTOQUE BAIXO" : "SAUDÁVEL",
          percentage: 100,
          created_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);
  }, []);

  const handleImportFile = useCallback((file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setImportPreview(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }, [parseCSV]);

  const handleImportDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingImport(false);
    handleImportFile(e.dataTransfer.files?.[0] ?? null);
  }, [handleImportFile]);

  const downloadTemplate = () => {
    const rows = [
      "nome;categoria;preco_venda;preco_custo;estoque",
      "Trufa de Nutella;Trufa;10.00;2.50;30",
      "Geladinho de Morango;Geladinho;5.00;1.20;50",
      "Trufa de Maracujá;Trufa;8.00;1.80;20",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo_produtos_acola.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = () => {
    if (importPreview.length === 0) return;

    // 1. Atualizar estoque
    const existing = localStorage.getItem("acola_estoque");
    const current: any[] = existing ? JSON.parse(existing) : [];
    const final = importMode === "replace" ? importPreview : [...importPreview, ...current];
    localStorage.setItem("acola_estoque", JSON.stringify(final));

    // 2. Registrar cada produto como "Entrada" no histórico de movimentações
    const savedHistory = localStorage.getItem("acola_historico");
    const history: any[] = savedHistory ? JSON.parse(savedHistory) : [];

    const now = new Date().toISOString();
    const newMovements = importPreview.map((item, idx) => ({
      id: `IMPORT-${Date.now()}-${idx}`,
      timestamp: now,
      productId: item.id,
      productName: item.name,
      type: "Entrada",
      amount: item.stock,
      previousStock: 0,
      finalStock: item.stock,
      note: `IMPORTAÇÃO VIA PLANILHA`,
    }));

    localStorage.setItem("acola_historico", JSON.stringify([...newMovements, ...history]));
    router.push("/");
  };
  // ─────────────────────────────────────────────────────────────

  // Lógica de Salvar no Supabase
  const handleSave = async () => {
    if (!nome || precoVenda <= 0) {
      alert("Por favor, preencha o nome e o preço de venda.");
      return;
    }

    setIsSaving(true);
    
    try {
      // 1. Preparar objeto do produto consolidado para o Supabase
      const { error } = await supabase
        .from('products')
        .insert([{
          name: nome,
          category: categoria,
          subtype: categoria === "Geladinho" ? subtipo : "",
          cost: Number(custoTotal),
          price: Number(precoVenda),
          stock: Number(estoqueInicial),
          image: foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=2a2a2a&color=c9a84c&bold=true&size=128`,
          status: 'active'
        }]);

      if (error) throw error;

      addToast("Produto cadastrado com sucesso!", "success");

      // Feedback visual
      await new Promise(resolve => setTimeout(resolve, 800));

      router.push("/");
    } catch (error: any) {
      console.error("Erro ao salvar no Supabase:", error);
      addToast("Erro ao salvar o produto no banco de dados.", "alert");
    } finally {
      setIsSaving(false);
    }
  };

  // Lógica de adicionar ingrediente
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
          
          // Se mudou o nome, tenta buscar no master de insumos
          if (field === "name") {
            const matched = masterInsumos.find(mi => mi.name.toLowerCase() === value.toLowerCase());
            if (matched) {
              updated.insumoId = matched.id;
              updated.unitCost = matched.unitCost;
              updated.unit = matched.unit;
              // Pegar o preço cheio da embalagem
              updated.packagePrice = matched.latestPrice;
              updated.packageQty = matched.latestQty;
            }
          }

          // Se mudou o tipo para 'inteiro', a quantidade interna vira 1 (uma embalagem)
          if (field === "type" && value === "inteiro") {
             updated.qty = 1;
          }

          return updated;
        }
        return i;
      })
    );
  };

  // Cálculos Financeiros
  const custosIngredientes = ingredientes.map((i) => {
    if (i.unitCost < 0) return 0;

    let cost = 0;
    if (i.type === 'unidade') {
      // UNIT: Custo fixo por unidade individual produzida
      cost = i.unitCost * (i.qty || 0);
    } else if (i.type === 'lote') {
      // LOTE: Custo total do uso na receita dividido pelo rendimento
      cost = (i.unitCost * (i.qty || 0)) / Math.max(1, rendimento);
    } else if (i.type === 'inteiro') {
      // INTEIRO: Valor cheio da embalagem / Rendimento
      // Se packagePrice < 1, provavelmente é o custo unitário (mismatch de schema)
      // Nesse caso, tentamos multiplicar pelo packageQty (se disponível)
      const fullPrice = (i.packagePrice && i.packagePrice > 1) ? i.packagePrice : (i.unitCost * (i.packageQty || 1));
      cost = fullPrice / Math.max(1, rendimento);
    }
    
    return cost;
  });

  const subtotalReceita = custosIngredientes.reduce((acc, curr) => acc + curr, 0);
  const margemSeguranca = subtotalReceita * 0.05; // 5% de quebra/perda
  const custoTotal = subtotalReceita + margemSeguranca;
  const lucroBruto = precoVenda - custoTotal;
  const margemLucro = precoVenda > 0 ? (lucroBruto / precoVenda) * 100 : 0;

  // Estado para os inputs de reposição
  const [restockAmounts, setRestockAmounts] = useState<Record<string, number>>({});
  const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);

  const handleRestock = (productId: string) => {
    const amount = restockAmounts[productId] || 0;
    if (amount <= 0) return;

    // 1. Atualizar Inventory Local (UI)
    const updatedInventory = inventory.map(item => {
      if (item.id === productId) {
        const newStock = Number(item.stock) + amount;
        return { 
          ...item, 
          stock: newStock,
          status: newStock < 20 ? "ESTOQUE BAIXO" : "SAUDÁVEL"
        };
      }
      return item;
    });

    setInventory(updatedInventory);

    // 2. Persistir no LocalStorage
    localStorage.setItem("acola_estoque", JSON.stringify(updatedInventory));

    // 3. Limpar input
    setRestockAmounts(prev => ({ ...prev, [productId]: 0 }));
    
    // Feedback visual opcional
    console.log(`Estoque atualizado: ${productId} +${amount}`);
  };

  const handleFinalizeRestock = async () => {
    const pendingUpdates = Object.entries(restockAmounts).filter(([_, amount]) => amount >= 0);
    
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
          // 1. Atualizar estoque no Supabase
          const { error: updateError } = await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', id);

          if (updateError) throw updateError;

          // 2. Registrar movimentação
          await supabase.from('inventory_movements').insert([{
            product_id: id,
            product_name: item.name,
            type: isAdjustmentMode ? "Ajuste" : "Entrada",
            amount: isAdjustmentMode ? (newStock - previousStock) : amount,
            previous_stock: previousStock,
            final_stock: newStock,
            note: isAdjustmentMode ? "AJUSTE MANUAL" : "REPOSIÇÃO DE ESTOQUE"
          }]);
        }
      }

      addToast("Estoque atualizado com sucesso!", "success");
      router.push("/");
    } catch (error: any) {
      console.error("Erro na reposição:", error);
      addToast("Erro ao atualizar o estoque no servidor.", "alert");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Fluido (Sobe com o scroll) */}
      <header className="h-20 shrink-0 flex items-center justify-between px-8 bg-background border-b border-primary/5 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-xl font-black text-primary tracking-tight uppercase">Produto / Estoque</h1>
            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest leading-none mt-1">Gestão de Inventário</p>
          </div>
        </div>

        {viewMode !== "selection" && (
           <button 
             onClick={() => setViewMode("selection")}
             className="px-4 py-2 text-[10px] font-black text-primary/40 hover:text-primary uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer"
           >
             <span className="material-symbols-outlined text-lg">grid_view</span>
             Mudar Modo
           </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* MODO SELECIONAR */}
          {viewMode === "selection" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-12">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setViewMode("new")}
                className="group p-8 bg-surface rounded-[32px] border border-primary/5 shadow-sm hover:shadow-2xl hover:border-secondary transition-all text-left flex flex-col gap-6 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-secondary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-4xl font-black">add_box</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-primary mb-2">Novo Cadastro</h3>
                  <p className="text-sm text-primary/60 font-medium leading-relaxed">
                    Inicie uma receita do zero, calcule custos por ingrediente e defina preços de venda para uma nova criação.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                  Começar Receita <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </div>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setViewMode("restock")}
                className="group p-8 bg-surface rounded-[32px] border border-primary/5 shadow-sm hover:shadow-2xl hover:border-accent transition-all text-left flex flex-col gap-6 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-accent/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-4xl font-black">inventory_2</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-primary mb-2">Repor Estoque</h3>
                  <p className="text-sm text-primary/60 font-medium leading-relaxed">
                    Já produziu mais trufas ou geladinhos? Adicione unidades rapidamente aos produtos que já estão cadastrados.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest">
                  Atualizar Qtd <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </div>
              </motion.button>

              {/* Card Importar Planilha */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => { setImportPreview([]); setImportFileName(""); setViewMode("import"); }}
                className="group p-8 bg-surface rounded-[32px] border border-primary/5 shadow-sm hover:shadow-2xl hover:border-secondary/60 transition-all text-left flex flex-col gap-6 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-4xl font-black">table_chart</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-primary mb-2">Importar Planilha</h3>
                  <p className="text-xs text-primary/50 font-medium leading-relaxed">
                    Suba um arquivo CSV do Excel ou Google Sheets e importe todos os seus produtos de uma vez.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-secondary font-black text-xs uppercase tracking-widest">
                  Importar Agora <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </div>
              </motion.button>
            </div>
          )}

          {/* MODO NOVO PRODUTO (CALCULADORA) */}
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
                      <div className="grid grid-cols-2 gap-2">
                        {["Trufa", "Geladinho"].map(cat => (
                          <button 
                            key={cat}
                            type="button"
                            onClick={() => { setCategoria(cat); if (cat === "Geladinho") setSubtipo("premium"); else setSubtipo(""); }}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border cursor-pointer ${categoria === cat ? "bg-secondary text-primary border-primary" : "bg-background text-primary/40 border-primary/5 hover:bg-primary/5"}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sub-tipo: só aparece quando Geladinho está selecionado */}
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
                        <p className="text-[9px] font-bold text-primary/30 uppercase tracking-widest ml-1">
                          {subtipo === "premium" ? "Ex: Ninho c/ Nutella, Morango c/ Nutella" : "Ex: Oreo, Mousse de Maracujá"}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Preço Venda</label>
                        <input 
                          type="number"
                          value={precoVenda}
                          onChange={(e) => setPrecoVenda(Number(e.target.value))}
                          className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all text-secondary" 
                          placeholder="0,00" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Estoque Inicial</label>
                        <input 
                          type="number"
                          value={estoqueInicial}
                          onChange={(e) => setEstoqueInicial(Number(e.target.value))}
                          className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all text-primary" 
                          placeholder="0" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary text-primary p-6 rounded-[32px] shadow-xl shadow-secondary/10 flex flex-col justify-between h-40 relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Resumo Financeiro</p>
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-bold opacity-60 uppercase mb-1">Custo Total:</span>
                        <span className="text-xl font-black text-primary">R${custoTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-end border-t border-primary/10 pt-2">
                        <span className="text-[9px] font-bold opacity-60 uppercase mb-1">Margem de Lucro:</span>
                        <span className="text-xl font-black text-primary">
                          {precoVenda > 0 ? (((precoVenda - custoTotal) / precoVenda) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full h-14 bg-secondary text-primary rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-secondary/20 disabled:opacity-50"
                >
                  {isSaving ? "SALVANDO..." : "SALVAR PRODUTO"}
                </button>
              </div>

              {/* Direita: Calculadora de Ingredientes */}
              <div className="flex-1 bg-surface rounded-[32px] border border-primary/5 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-8 border-b border-primary/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-surface-variant/20">
                  <div>
                    <h2 className="text-lg font-black text-primary tracking-tight uppercase">Ingredientes da Receita</h2>
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Selecione os insumos e defina o rendimento</p>
                  </div>
                  
                  <div className="flex items-center gap-6 bg-background/50 px-6 py-3 rounded-2xl border border-primary/5">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-primary/30 uppercase tracking-widest">Rendimento</span>
                      <div className="flex items-center gap-2">
                         <input 
                           type="number"
                           value={rendimento}
                           onChange={(e) => setRendimento(Math.max(1, Number(e.target.value)))}
                           className="w-12 bg-transparent text-sm font-black text-secondary outline-none border-b border-secondary/20 focus:border-secondary transition-all"
                         />
                         <span className="text-[10px] font-black text-primary/40 uppercase">Unidades</span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-primary/10" />
                    <button 
                      type="button"
                      onClick={addIngredient}
                      className="flex items-center gap-2 text-secondary hover:text-secondary/80 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                      <span className="material-symbols-outlined text-lg">add_circle</span>
                      Novo Item
                    </button>
                  </div>
               </div>

                <div className="flex-1 overflow-x-auto p-4 md:p-8">
                  <div className="min-w-[850px] flex flex-col gap-3">
                    <AnimatePresence>
                      {ingredientes.length === 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center py-32 text-primary/10"
                        >
                          <span className="material-symbols-outlined text-7xl mb-4 italic">restaurant_menu</span>
                          <p className="font-black text-[10px] uppercase tracking-[0.4em] text-center max-w-[250px]">Adicione os componentes da sua receita</p>
                        </motion.div>
                      ) : (
                        ingredientes.map((ing, idx) => {
                          const itemCost = custosIngredientes[idx];

                          return (
                            <motion.div 
                               key={ing.id}
                               initial={{ opacity: 0, x: -20 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: 20 }}
                               className="p-4 bg-background/40 rounded-3xl grid grid-cols-12 gap-4 items-center group border border-primary/5 hover:border-secondary/30 transition-all"
                            >
                               <div className="col-span-3 space-y-1">
                                  <label className="text-[8px] font-black text-primary/30 uppercase tracking-widest ml-1">Insumo</label>
                                  <input 
                                     list="master-insumos"
                                     className="w-full bg-background/80 rounded-xl p-3 text-xs font-bold outline-none border border-primary/5 focus:border-secondary transition-all text-primary"
                                     placeholder="Buscar insumo..."
                                     value={ing.name}
                                     onChange={(e) => updateIngredient(ing.id, "name", e.target.value)}
                                  />
                                  <datalist id="master-insumos">
                                     {masterInsumos.map(mi => <option key={mi.id} value={mi.name} />)}
                                  </datalist>
                               </div>

                               <div className="col-span-3 space-y-1">
                                  <label className="text-[8px] font-black text-primary/30 uppercase tracking-widest ml-1">Tipo de Uso</label>
                                  <div className="flex bg-background/80 rounded-xl p-1 border border-primary/5">
                                     {(['lote', 'unidade', 'inteiro'] as const).map(type => (
                                       <button
                                         key={type}
                                         type="button"
                                         onClick={() => updateIngredient(ing.id, "type", type)}
                                         className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-tight transition-all ${ing.type === type ? "bg-secondary text-primary shadow-sm" : "text-primary/30 hover:text-primary"}`}
                                       >
                                         {type === 'lote' ? 'Lote' : type === 'unidade' ? 'Unit' : 'Inteiro'}
                                       </button>
                                     ))}
                                  </div>
                               </div>

                               <div className={ing.type === 'inteiro' ? 'hidden' : 'col-span-2 space-y-1'}>
                                  <label className="text-[8px] font-black text-primary/30 uppercase tracking-widest ml-1">
                                     Uso ({ing.unit})
                                  </label>
                                  <input 
                                     type="number"
                                     className="w-full bg-background/80 rounded-xl p-3 text-xs font-black outline-none border border-primary/5 focus:border-secondary"
                                     value={ing.qty || ""}
                                     onChange={(e) => updateIngredient(ing.id, "qty", Number(e.target.value))}
                                  />
                               </div>

                               <div className={ing.type === 'inteiro' ? 'col-span-5' : 'col-span-3'}>
                                  <div className="bg-secondary/5 rounded-2xl px-4 py-2 border border-secondary/10 flex justify-between items-center h-12">
                                     <div>
                                        <p className="text-[7px] font-black text-secondary/50 uppercase tracking-widest leading-none">
                                           {ing.type === 'inteiro' ? 'Preço Emb.' : 'Custo Unit.'}
                                        </p>
                                        <p className="text-sm font-black text-primary italic leading-tight">
                                           R$ {(ing.type === 'inteiro' ? (ing.packagePrice && ing.packagePrice > 1 ? ing.packagePrice : (ing.unitCost * (ing.packageQty || 1))) : itemCost).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                     </div>
                                     <div className="text-right">
                                        <p className="text-[7px] font-black text-primary/20 uppercase tracking-widest leading-none">Total Item</p>
                                        <p className="text-[10px] font-bold text-primary/30 leading-tight">
                                           R$ {(itemCost * rendimento).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                     </div>
                                  </div>
                               </div>

                               <div className="col-span-1 flex justify-end">
                                  <button onClick={() => removeIngredient(ing.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-error/5 text-error/40 hover:bg-error hover:text-white transition-all">
                                     <span className="material-symbols-outlined text-sm">delete</span>
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

          {/* MODO REPOSIÇÃO (RESTOCK) */}
          {viewMode === "restock" && (
            <div className="bg-surface rounded-[40px] border border-primary/5 shadow-2xl p-8">
               <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h2 className="text-2xl font-black text-primary tracking-tight uppercase">Entrada & Ajuste</h2>
                    <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Gerencie a produção ou corrija saldos</p>
                  </div>

                  <div className="flex items-center gap-6 bg-background p-2 rounded-2xl border border-primary/5">
                    {/* Toggle Modo Ajuste */}
                    <div className="flex items-center gap-3 px-4 py-2 border-r border-primary/10">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", !isAdjustmentMode ? "text-primary" : "text-primary/30")}>Reposição</span>
                      <button 
                        onClick={() => {
                          setIsAdjustmentMode(!isAdjustmentMode);
                          setRestockAmounts({}); // Limpa ao trocar modo
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
                      onClick={() => setViewMode("selection")}
                      className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-primary transition-all cursor-pointer"
                    >
                      Voltar
                    </button>
                  </div>
               </div>

               {inventory.length === 0 ? (
                 <div className="text-center py-20 bg-background rounded-3xl border-2 border-dashed border-primary/5">
                    <p className="font-bold text-primary/30 uppercase tracking-widest text-sm">Nenhum produto cadastrado</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {inventory.map((item) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1,
                          borderColor: isAdjustmentMode ? "var(--color-accent-30)" : "var(--color-primary-5)"
                        }}
                        key={item.id}
                        className={cn(
                          "p-6 bg-background rounded-3xl border transition-all flex flex-col gap-4 shadow-sm",
                          isAdjustmentMode ? "border-accent/30 shadow-lg shadow-accent/5" : "border-primary/5"
                        )}
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-surface border border-primary/5 overflow-hidden">
                               <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                               <h4 className="font-black text-primary text-base leading-none">{item.name}</h4>
                               <p className="text-[9px] font-bold text-primary/30 uppercase mt-1">{item.category}</p>
                            </div>
                         </div>
                         <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Saldo Atual: <b className="text-primary">{item.stock} UN</b></span>
                            <div className="flex items-center gap-2">
                               <input 
                                 type="number" 
                                 placeholder={isAdjustmentMode ? "Novo total" : "+ 0"}
                                 value={restockAmounts[item.id] !== undefined ? restockAmounts[item.id] : (isAdjustmentMode ? item.stock : "")}
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
                    className="flex items-center gap-3 px-10 py-5 bg-secondary text-primary rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-secondary/20 hover:scale-[1.05] active:scale-95 transition-all cursor-pointer group"
                  >
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform font-black">check_circle</span>
                    Finalizar e Voltar
                  </button>
               </div>
            </div>
          )}
          {/* ── MODO IMPORTAR PLANILHA ───────────────────────────────── */}
          {viewMode === "import" && (
            <div className="flex flex-col gap-6">

              {/* Cabeçalho da seção */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-primary tracking-tight uppercase">Importar Planilha</h2>
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">CSV do Excel ou Google Sheets</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-all font-black text-[10px] uppercase tracking-widest cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Baixar Modelo CSV
                </button>
              </div>

              {/* Drop Zone */}
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => importFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingImport(true); }}
                onDragLeave={() => setIsDraggingImport(false)}
                onDrop={handleImportDrop}
                className={cn(
                  "w-full rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 py-16",
                  isDraggingImport
                    ? "border-secondary bg-secondary/10 scale-[1.01]"
                    : importFileName
                    ? "border-secondary/40 bg-secondary/5"
                    : "border-primary/10 bg-surface hover:border-secondary/40 hover:bg-secondary/5"
                )}
              >
                {importFileName ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl">check_circle</span>
                    </div>
                    <div className="text-center">
                      <p className="font-black text-primary text-sm">{importFileName}</p>
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">
                        {importPreview.length} produto{importPreview.length !== 1 ? "s" : ""} encontrado{importPreview.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setImportPreview([]); setImportFileName(""); }}
                      className="text-[9px] font-black text-primary/30 uppercase tracking-widest hover:text-error transition-colors"
                    >
                      Trocar arquivo
                    </button>
                  </>
                ) : (
                  <>
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", isDraggingImport ? "bg-secondary/20 text-secondary" : "bg-surface-variant text-primary/30")}>
                      <span className="material-symbols-outlined text-3xl">{isDraggingImport ? "file_download" : "upload_file"}</span>
                    </div>
                    <div className="text-center">
                      <p className={cn("font-black text-sm uppercase tracking-widest transition-colors", isDraggingImport ? "text-secondary" : "text-primary/40")}>
                        {isDraggingImport ? "Solte o arquivo aqui!" : "Clique ou arraste seu arquivo CSV"}
                      </p>
                      <p className="text-[10px] font-bold text-primary/25 uppercase tracking-widest mt-1">Exportado do Excel ou Google Sheets</p>
                    </div>
                  </>
                )}
              </div>

              {/* Instruções rápidas */}
              {!importFileName && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: "table_chart", step: "1", title: "Baixe o Modelo", desc: "Clique em \"Baixar Modelo CSV\" para ter as colunas corretas" },
                    { icon: "edit_note", step: "2", title: "Preencha no Excel", desc: "Abra no Excel ou Google Sheets e preencha seus produtos" },
                    { icon: "upload", step: "3", title: "Importe aqui", desc: "Salve como CSV e arraste para a área acima" },
                  ].map(s => (
                    <div key={s.step} className="bg-surface rounded-3xl p-6 border border-primary/5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-xl">{s.icon}</span>
                      </div>
                      <div>
                        <p className="font-black text-primary text-xs uppercase tracking-widest">Passo {s.step} — {s.title}</p>
                        <p className="text-[10px] text-primary/50 font-medium mt-1 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview dos dados */}
              {importPreview.length > 0 && (
                <div className="bg-surface rounded-[32px] border border-primary/5 shadow-sm overflow-hidden">
                  <div className="px-8 py-5 border-b border-primary/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-primary uppercase tracking-widest">Prévia dos Dados</h3>
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-0.5">{importPreview.length} produto{importPreview.length !== 1 ? "s" : ""} prontos para importar</p>
                    </div>
                    {/* Toggle merge/replace */}
                    <div className="flex items-center gap-3 bg-background p-1.5 rounded-xl border border-primary/5">
                      {(["merge", "replace"] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setImportMode(mode)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                            importMode === mode ? "bg-secondary text-primary shadow-md" : "text-primary/30 hover:text-primary"
                          )}
                        >
                          {mode === "merge" ? "Adicionar ao estoque" : "Substituir tudo"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left min-w-[700px]">
                      <thead className="sticky top-0 bg-surface-variant/40">
                        <tr>
                          {["Produto", "Categoria", "Preço Venda", "Preço Custo", "Estoque"].map(h => (
                            <th key={h} className="px-6 py-4 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/5">
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-background/60 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-black text-primary text-sm">{item.name}</p>
                              <p className="text-[9px] font-bold text-primary/30 uppercase tracking-widest">{item.id}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                item.category === "Trufa" ? "bg-accent/10 text-accent" : "bg-secondary/10 text-secondary"
                              )}>{item.category}</span>
                            </td>
                            <td className="px-6 py-4 font-black text-primary text-sm">{item.price}</td>
                            <td className="px-6 py-4 font-bold text-primary/50 text-xs">{item.cost}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "font-black text-sm",
                                item.stock <= 5 ? "text-error" : item.stock <= 20 ? "text-amber-400" : "text-secondary"
                              )}>{item.stock} UN</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Botão de confirmação */}
                  <div className="px-8 py-6 border-t border-primary/5 flex items-center justify-between gap-4">
                    <p className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                      {importMode === "merge"
                        ? `Os ${importPreview.length} produtos serão adicionados ao estoque existente`
                        : `O estoque atual será substituído por ${importPreview.length} produto${importPreview.length !== 1 ? "s" : ""}`
                      }
                    </p>
                    <button
                      onClick={handleConfirmImport}
                      className="flex items-center gap-3 px-8 py-4 bg-secondary text-primary rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-secondary/20 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
                    >
                      <span className="material-symbols-outlined group-hover:translate-x-0.5 transition-transform">check_circle</span>
                      Confirmar Importação
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ──────────────────────────────────────────────────────────── */}

        </div>
      </main>
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

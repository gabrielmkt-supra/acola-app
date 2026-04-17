"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Utility for conditional classes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Todos os Itens");
  const [salesPeriod, setSalesPeriod] = useState<"dia" | "semana" | "mes">("dia");
  const [purchasePeriod, setPurchasePeriod] = useState<"dia" | "semana" | "mes">("dia");
  const [inventory, setInventory] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editProductModal, setEditProductModal] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const [tempName, setTempName] = useState("");
  const [tempPrice, setTempPrice] = useState("");
  const [imageInputValue, setImageInputValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar dados reais do Supabase
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Produtos
      const { data: products } = await supabase.from('products').select('*').order('name');
      if (products) setInventory(products);

      // 2. Vendas (Orders)
      const { data: sales } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
      if (sales) setVendas(sales);

      // 3. Compras (Purchases)
      const { data: purchases } = await supabase.from('purchases').select('*').order('date', { ascending: false });
      if (purchases) setCompras(purchases);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lógicas de Cálculo Dinâmico
  const getSalesTotal = (period: "dia" | "semana" | "mes") => {
    const now = new Date();
    const filtered = vendas.filter(venda => {
      // APENAS VENDAS PAGAS entram no faturamento real
      if (venda.paymentStatus === "pendente") return false;

      const vDate = new Date(venda.timestamp);
      if (period === "dia") {
        return vDate.toDateString() === now.toDateString();
      }
      if (period === "semana") {
        const diff = (now.getTime() - vDate.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }
      if (period === "mes") {
        return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
      }
      return false;
    });
    return filtered.reduce((acc, curr) => acc + curr.total, 0);
  };
 
  const getPurchasesTotal = (period: "dia" | "semana" | "mes") => {
    const now = new Date();
    const filtered = compras.filter(compra => {
      const cDate = new Date(compra.date); // Tabela usa 'date'
      if (period === "dia") {
        return cDate.toDateString() === now.toDateString();
      }
      if (period === "semana") {
        const diff = (now.getTime() - cDate.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }
      if (period === "mes") {
        return cDate.getMonth() === now.getMonth() && cDate.getFullYear() === now.getFullYear();
      }
      return false;
    });
    return filtered.reduce((acc, curr) => acc + (curr.total_price || 0), 0); // Tabela usa 'total_price'
  };

  const totalPending = vendas
    .filter(v => v.paymentStatus === "pendente")
    .reduce((acc, curr) => acc + curr.total, 0);

  const formatCurrency = (val: number) => {
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(1)}k`;
    return `R$ ${val.toFixed(0)}`;
  };

  const salesData = {
    dia: { label: "Hoje", value: formatCurrency(getSalesTotal("dia")) },
    semana: { label: "Esta Semana", value: formatCurrency(getSalesTotal("semana")) },
    mes: { label: "Este Mês", value: formatCurrency(getSalesTotal("mes")) }
  };

  const purchasesData = {
    dia: { label: "Hoje", value: formatCurrency(getPurchasesTotal("dia")) },
    semana: { label: "Esta Semana", value: formatCurrency(getPurchasesTotal("semana")) },
    mes: { label: "Este Mês", value: formatCurrency(getPurchasesTotal("mes")) }
  };

  const totalProducts = inventory.length;
  const totalUnits = inventory.reduce((acc, curr) => acc + (curr.stock || 0), 0);
  const stockValueTotal = inventory.reduce((acc, curr) => {
    const price = Number(curr.price || 0);
    return acc + (price * (curr.stock || 0));
  }, 0);

  const stats = [
    { label: "QUANTIDADE DE ITENS EM ESTOQUE", value: totalUnits.toString().padStart(2, '0'), color: "text-accent" },
    { label: "VALOR ESTIMADO ESTOQUE", value: formatCurrency(stockValueTotal), color: "text-secondary" },
    { label: "TOTAL A RECEBER (FIADO)", value: formatCurrency(totalPending), color: "text-primary" },
  ];

  const filteredInventory = inventory.filter(item => {
    if (activeTab === "Todos os Itens") return true;
    return item.category === activeTab;
  });

  const openEditProductModal = (item: any) => {
    setEditProductModal({ open: true, item });
    setTempName(item.name);
    setTempPrice(item.price.toString());
    setImageInputValue(item.image || "");
  };

  const closeEditProductModal = () => {
    setEditProductModal({ open: false, item: null });
    setTempName("");
    setTempPrice("");
    setImageInputValue("");
  };

  const handleSaveProduct = async () => {
    if (!editProductModal.item) return;
    
    const { error } = await supabase
      .from('products')
      .update({
        name: tempName,
        price: Number(tempPrice),
        image: imageInputValue
      })
      .eq('id', editProductModal.item.id);
    
    if (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar produto no banco de dados.");
      return;
    }

    // Atualizar estado local para feedback imediato
    setInventory(inventory.map(item => 
      item.id === editProductModal.item.id 
        ? { ...item, name: tempName, price: Number(tempPrice), image: imageInputValue }
        : item
    ));
    
    closeEditProductModal();
  };

  const handleRemoveImage = async () => {
    if (!editProductModal.item) return;

    const { error } = await supabase
      .from('products')
      .update({ image: "" })
      .eq('id', editProductModal.item.id);

    if (error) {
      console.error("Erro ao remover imagem:", error);
      alert("Erro ao remover imagem do banco.");
      return;
    }

    setInventory(inventory.map(item =>
      item.id === editProductModal.item.id ? { ...item, image: "" } : item
    ));
    setImageInputValue(""); 
  };

  const handleDeleteProduct = async () => {
    if (!editProductModal.item) return;
    
    if (!confirm(`⚠️ ATENÇÃO: Deseja excluir permanentemente o produto "${editProductModal.item.name}"? Esta ação não pode ser desfeita.`)) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', editProductModal.item.id);

    if (error) {
      console.error("Erro ao excluir produto:", error);
      alert("Erro ao excluir produto do banco.");
      return;
    }

    setInventory(inventory.filter(item => item.id !== editProductModal.item.id));
    closeEditProductModal();
    alert("Produto excluído com sucesso!");
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
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
        resolve(canvas.toDataURL("image/webp", 0.7)); // Salva em WebP para menor tamanho
      };
    });
  };

  const handleFileChange = useCallback(async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const compressed = await compressImage(base64);
      setImageInputValue(compressed);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileChange(file);
  }, [handleFileChange]);

  // Fallback de imagem
  const getImageSrc = (item: any) => item.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=2a2a2a&color=c9a84c&bold=true&size=128`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 pb-24 md:pb-8">
        <div className="max-w-[1920px] mx-auto flex flex-col h-full gap-8">
          
          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 shrink-0">
            {stats.map((stat, idx) => {
              const isPendingCard = stat.label.includes("RECEBER");
              const cardContent = (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    "bg-surface rounded-2xl p-6 border border-primary/5 shadow-sm transition-all h-full",
                    isPendingCard ? "hover:-translate-y-1 hover:shadow-lg hover:border-secondary/20 group cursor-pointer" : "hover:-translate-y-1"
                  )}
                >
                  <p className="text-[10px] font-bold text-primary/50 uppercase tracking-widest mb-1">{stat.label}</p>
                  <h2 className={`text-3xl font-black ${stat.color}`}>{stat.value}</h2>
                  {isPendingCard && (
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-secondary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Ver Lista de Devedores</span>
                      <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                    </div>
                  )}
                </motion.div>
              );

              return isPendingCard ? (
                <Link key={stat.label} href="/movimentacoes?tab=Pendências">
                  {cardContent}
                </Link>
              ) : (
                <div key={stat.label}>{cardContent}</div>
              );
            })}

            {/* CARD DE VENDAS DINÂMICO */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-surface p-6 rounded-[24px] border border-primary/5 shadow-sm relative overflow-hidden flex flex-col justify-between group h-full"
            >
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                    Vendas {salesPeriod === 'mes' ? 'Mês' : salesPeriod === 'semana' ? 'Semana' : 'Hoje'}
                  </p>
                  <div className="flex bg-primary/5 p-0.5 rounded-lg">
                    {(['dia', 'semana', 'mes'] as const).map((period) => (
                      <button
                         key={period}
                         onClick={(e) => { e.preventDefault(); setSalesPeriod(period); }}
                         className={cn(
                           "w-6 h-6 flex items-center justify-center rounded-md text-[9px] font-black uppercase transition-all",
                           salesPeriod === period ? "bg-secondary text-primary shadow-md" : "hover:bg-primary/5 text-primary/30"
                         )}
                      >
                        {period[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <h2 className="text-3xl font-black italic tracking-tighter text-white">{salesData[salesPeriod].value}</h2>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-[100px] font-black italic">payments</span>
              </div>
            </motion.div>

            {/* CARD DE COMPRAS DINÂMICO */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-surface p-6 rounded-[24px] border border-primary/5 shadow-sm relative overflow-hidden flex flex-col justify-between group h-full"
            >
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                    Compras {purchasePeriod === 'mes' ? 'Mês' : purchasePeriod === 'semana' ? 'Semana' : 'Hoje'}
                  </p>
                  <div className="flex bg-primary/5 p-0.5 rounded-lg">
                    {(['dia', 'semana', 'mes'] as const).map((period) => (
                      <button
                         key={period}
                         onClick={(e) => { e.preventDefault(); setPurchasePeriod(period); }}
                         className={cn(
                           "w-6 h-6 flex items-center justify-center rounded-md text-[9px] font-black uppercase transition-all",
                           purchasePeriod === period ? "bg-secondary text-primary shadow-md" : "hover:bg-primary/5 text-primary/30"
                         )}
                      >
                        {period[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <h2 className="text-3xl font-black italic tracking-tighter text-white">{purchasesData[purchasePeriod].value}</h2>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-[100px] font-black italic">shopping_cart</span>
              </div>
            </motion.div>
          </div>

          {/* Table Section */}
          <div className="bg-surface rounded-2xl border border-primary/5 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[500px]">
            <div className="p-6 flex flex-wrap gap-4 items-center justify-between border-b border-primary/5 shrink-0">
              <h3 className="text-xl font-black text-primary uppercase italic tracking-tight">Estoque Real</h3>
              <div className="flex gap-2">
                {["Todos os Itens", "Geladinho", "Trufa"].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-5 py-2 font-black text-[10px] uppercase tracking-widest rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95",
                      activeTab === tab 
                        ? "bg-secondary text-primary shadow-lg" 
                        : "bg-surface-variant/50 text-primary/40 hover:bg-surface-variant hover:text-primary"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-64 text-primary/20 text-xs font-black uppercase tracking-widest">Carregando estoque...</div>
              ) : filteredInventory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-primary/30 gap-4">
                   <span className="material-symbols-outlined text-6xl">inventory_2</span>
                   <div className="text-center">
                      <p className="font-black uppercase tracking-widest text-sm text-primary/20">Sem Itens nesta categoria</p>
                      <p className="text-[10px] font-bold opacity-40 mt-1 uppercase tracking-widest">Aguardando movimentação</p>
                   </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="sticky top-0 z-10 bg-surface">
                    <tr className="bg-surface-variant/30">
                      <th className="px-6 py-4 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">Produto</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">Categoria</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">Preço Custo</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">Preço Venda</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">Estoque</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">Saúde</th>
                      <th className="px-6 py-4 text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] text-right">Foto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {filteredInventory.map((item, idx) => (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.05 * idx }}
                        className="hover:bg-background transition-colors group cursor-default"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-surface-variant overflow-hidden shrink-0 border border-primary/5 shadow-sm">
                              <img alt={item.name} className="w-full h-full object-cover" src={getImageSrc(item)} />
                            </div>
                            <div>
                              <p className="font-black text-primary text-sm uppercase tracking-tight leading-none mb-1">{item.name}</p>
                              <p className="text-[9px] font-bold text-primary/30 uppercase tracking-widest">{item.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                            item.category === "Trufa" ? "bg-accent/10 text-accent" : "bg-secondary/10 text-secondary"
                          )}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-primary/40 tracking-tight">R$ {Number(item.cost || 0).toFixed(2).replace(".", ",")}</td>
                        <td className="px-6 py-5 text-sm font-black text-primary">R$ {Number(item.price || 0).toFixed(2).replace(".", ",")}</td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden border border-primary/5">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000",
                                  item.category === "Trufa" 
                                    ? (item.stock <= 10 ? "bg-error" : "bg-secondary")
                                    : (item.stock <= 5 ? "bg-error" : item.stock < 15 ? "bg-amber-400" : "bg-secondary")
                                )} 
                                style={{ width: `${Math.min(100, (item.stock / (item.category === "Trufa" ? 50 : 30)) * 100)}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-black", 
                              item.category === "Trufa" 
                                ? (item.stock <= 10 ? "text-error" : "text-primary")
                                : (item.stock <= 5 ? "text-error" : "text-primary")
                            )}>{item.stock} UN</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {(() => {
                            const isTrufa = item.category === "Trufa";
                            const isCritico = isTrufa ? item.stock <= 10 : item.stock <= 5;
                            const isOk = !isTrufa && item.stock >= 6 && item.stock < 15;
                            const isExcelente = isTrufa ? item.stock > 10 : item.stock >= 15;

                            let label = "SAUDÁVEL";
                            let colorClass = "bg-secondary/10 text-secondary";
                            let dotClass = "bg-secondary";

                            if (isCritico) {
                              label = "CRÍTICO";
                              colorClass = "bg-error/10 text-error";
                              dotClass = "bg-error";
                            } else if (isOk) {
                              label = "OK";
                              colorClass = "bg-amber-100 text-amber-600";
                              dotClass = "bg-amber-500";
                            } else if (isExcelente && !isTrufa) {
                              label = "MUITO BOM";
                            }

                            return (
                              <span className={cn(
                                "inline-flex items-center gap-2 py-1.5 px-3 rounded-full text-[9px] font-black uppercase tracking-widest",
                                colorClass
                              )}>
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full animate-pulse",
                                  dotClass
                                )} />
                                {label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button
                            onClick={() => router.push(`/novo-produto?id=${item.id}`)}
                            title="Editar produto e receita"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-variant/60 text-primary/30 hover:bg-secondary/15 hover:text-secondary transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer border border-primary/5"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                </tbody>
              </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edição de Produto */}
      {editProductModal.open && editProductModal.item && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeEditProductModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-surface border border-primary/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-primary/5">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary text-xl">edit_square</span>
                <div>
                  <p className="text-xs font-black text-primary uppercase tracking-widest">Editar Produto</p>
                  <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest mt-0.5">{editProductModal.item.name}</p>
                </div>
              </div>
              <button
                onClick={closeEditProductModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-primary/30 hover:text-primary hover:bg-surface-variant transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="px-6 pt-6 space-y-4">
              {/* Campo: Nome */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Nome do Produto</label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full bg-background border border-primary/5 rounded-xl px-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                />
              </div>

              {/* Campo: Preço */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Preço (R$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-primary/30">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tempPrice}
                    onChange={(e) => setTempPrice(e.target.value)}
                    className="w-full bg-background border border-primary/5 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-primary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Divisor */}
              <div className="h-px bg-primary/5 my-2" />
              <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Imagem do Produto</label>
            </div>

            <div className="px-6">

              {/* Input de arquivo oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />

              {/* Drop Zone / Preview */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`w-full h-44 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center mb-4 cursor-pointer transition-all duration-200 relative group ${
                  isDragging
                    ? "border-secondary bg-secondary/10 scale-[1.01]"
                    : imageInputValue
                    ? "border-primary/10 bg-surface-variant"
                    : "border-primary/15 bg-surface-variant hover:border-secondary/40 hover:bg-secondary/5"
                }`}
              >
                {imageInputValue ? (
                  <>
                    <img
                      src={imageInputValue}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {/* Overlay no hover para indicar que pode trocar */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-white text-3xl">upload</span>
                      <p className="text-[9px] font-black text-white uppercase tracking-widest">Trocar Foto</p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-primary/25 pointer-events-none select-none">
                    <span className={`material-symbols-outlined text-5xl transition-colors ${isDragging ? "text-secondary" : ""}`}>upload_file</span>
                    <p className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isDragging ? "text-secondary" : ""}`}>
                      {isDragging ? "Solte aqui!" : "Clique ou arraste uma foto"}
                    </p>
                    <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest">JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>

              {/* Divisor OU */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-primary/8" />
                <span className="text-[9px] font-black text-primary/20 uppercase tracking-widest">ou cole uma URL</span>
                <div className="flex-1 h-px bg-primary/8" />
              </div>

              {/* Input URL */}
              <div className="flex flex-col gap-1.5 mb-5">
                <input
                  type="text"
                  value={imageInputValue.startsWith("data:") ? "" : imageInputValue}
                  onChange={(e) => setImageInputValue(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-surface-variant border border-primary/10 rounded-xl px-4 py-3 text-xs text-primary placeholder-primary/20 font-bold focus:outline-none focus:border-secondary/40 focus:ring-1 focus:ring-secondary/20 transition-all"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={handleRemoveImage}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/10 text-primary/40 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">image_not_supported</span>
                  Remover Foto
                </button>
                <button
                  onClick={handleSaveProduct}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-primary text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer shadow-lg"
                >
                  <span className="material-symbols-outlined text-[15px]">check</span>
                  Salvar
                </button>
              </div>
              
              <button
                onClick={handleDeleteProduct}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-error text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all cursor-pointer shadow-md"
              >
                <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                Excluir Produto Permanentemente
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

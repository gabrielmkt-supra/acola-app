"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";

export default function ConfigPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [activeTab, setActiveTab] = useState<"perfil" | "precificacao" | "categorias" | "sistema">("precificacao");
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "alert" | "success" }[]>([]);

  const addToast = (message: string, type: "alert" | "success" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        // Tenta buscar no Supabase
        const { data, error } = await supabase
          .from('app_configs')
          .select('*')
          .eq('id', 'global')
          .single();

        if (data) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data
          });
        } else {
          // Fallback LocalStorage
          const local = localStorage.getItem("acola_settings");
          if (local) setSettings(JSON.parse(local));
        }
      } catch (e) {
        console.warn("Usando configurações locais devido a erro no banco ou tabela ausente.");
        const local = localStorage.getItem("acola_settings");
        if (local) setSettings(JSON.parse(local));
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (updatedSettings: AppSettings) => {
    setIsSaving(true);
    setSettings(updatedSettings);
    
    // 1. Salvar no LocalStorage para rapidez e offline
    localStorage.setItem("acola_settings", JSON.stringify(updatedSettings));

    try {
      // 2. Tentar salvar no Supabase
      const { error } = await supabase
        .from('app_configs')
        .upsert({
          id: 'global',
          ...updatedSettings,
          updated_at: new Date().toISOString()
        });

      if (error) {
        if (error.code === '42P01') { // Relation doesn't exist
          console.warn("A tabela 'app_configs' ainda não existe no Supabase. Gravado no LocalStorage apenas.");
          addToast("Configuração salva localmente (tabela ausente no Supabase).", "alert");
        } else {
          throw error;
        }
      } else {
        addToast("Configurações sincronizadas na nuvem!");
      }
    } catch (e) {
      console.error(e);
      addToast("Erro ao salvar no banco. Dados mantidos localmente.", "alert");
    } finally {
      setIsSaving(false);
    }
  };

  const addCategory = () => {
    if (!newCategory || settings.categories.includes(newCategory)) return;
    const updated = { ...settings, categories: [...settings.categories, newCategory] };
    handleSave(updated);
    setNewCategory("");
  };

  const removeCategory = (cat: string) => {
    if (confirm(`Tem certeza que deseja excluir a categoria "${cat}"?`)) {
      const updated = { ...settings, categories: settings.categories.filter(c => c !== cat) };
      handleSave(updated);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/30">Carregando Preferências...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background p-6 md:p-10 max-w-6xl mx-auto space-y-10 pb-32">
      
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-2xl bg-surface border border-primary/5 text-primary hover:scale-105 transition-all shadow-sm">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </Link>
            <h1 className="text-4xl font-black text-primary italic uppercase tracking-tighter">Configurações</h1>
          </div>
          <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] ml-14">Personalize a inteligência do seu Atelier</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-surface border border-primary/5 rounded-[24px] w-fit shadow-sm overflow-x-auto max-w-full no-scrollbar">
        {(["perfil", "precificacao", "categorias", "sistema"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeTab === tab ? "bg-secondary text-primary shadow-lg" : "text-primary/30 hover:text-primary hover:bg-primary/5"
            )}
          >
            {tab === "perfil" ? "Perfil" : tab === "precificacao" ? "Financeiro" : tab === "categorias" ? "Produtos" : "Sincronia"}
          </button>
        ))}
      </div>

      <main className="grid grid-cols-1 md:grid-cols-12 gap-10">
        
        {/* Left Panel: Controls */}
        <div className="md:col-span-8">
          <AnimatePresence mode="wait">
            
            {activeTab === "perfil" && (
              <motion.div
                key="perfil"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="bg-surface rounded-[40px] border border-primary/5 p-10 shadow-sm relative overflow-hidden group">
                  <div className="relative z-10 flex flex-col gap-10">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-secondary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-secondary text-3xl">storefront</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-primary uppercase italic tracking-tight">Identidade do Negócio</h2>
                        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Como seu atelier se apresenta</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                      {/* Nome do Atelier */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 ml-1">Nome do Atelier</label>
                        <input 
                          type="text"
                          value={settings.business_name}
                          onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                          onBlur={() => handleSave(settings)}
                          placeholder="Ex: Acolá Atelier"
                          className="w-full bg-primary/5 px-6 py-4 rounded-2xl text-sm font-bold text-primary placeholder:text-primary/10 outline-none focus:ring-2 focus:ring-secondary/20 transition-all border border-transparent focus:border-secondary/10"
                        />
                      </div>

                      {/* Slogan */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 ml-1">Slogan ou Bio (Opcional)</label>
                        <input 
                          type="text"
                          value={settings.business_slogan}
                          onChange={(e) => setSettings({ ...settings, business_slogan: e.target.value })}
                          onBlur={() => handleSave(settings)}
                          placeholder="Ex: Doces feitos com amor"
                          className="w-full bg-primary/5 px-6 py-4 rounded-2xl text-sm font-bold text-primary placeholder:text-primary/10 outline-none focus:ring-2 focus:ring-secondary/20 transition-all border border-transparent focus:border-secondary/10"
                        />
                      </div>

                      {/* WhatsApp */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 ml-1">WhatsApp de Contato</label>
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary/20 font-bold text-sm">+55</span>
                          <input 
                            type="text"
                            value={settings.whatsapp}
                            onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                            onBlur={() => handleSave(settings)}
                            placeholder="(00) 00000-0000"
                            className="w-full bg-primary/5 pl-14 pr-6 py-4 rounded-2xl text-sm font-bold text-primary placeholder:text-primary/10 outline-none focus:ring-2 focus:ring-secondary/20 transition-all border border-transparent focus:border-secondary/10"
                          />
                        </div>
                        <p className="text-[9px] font-medium text-primary/30 uppercase leading-relaxed ml-1">
                          Usado para gerar links de pedido e contato direto.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                    <span className="material-symbols-outlined text-[300px]">branding_watermark</span>
                  </div>
                </div>
              </motion.div>
            )}
            
            {activeTab === "precificacao" && (
              <motion.div
                key="precificacao"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="bg-surface rounded-[40px] border border-primary/5 p-10 shadow-sm relative overflow-hidden group">
                  <div className="relative z-10 flex flex-col gap-10">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-secondary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-secondary text-3xl">payments</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-primary uppercase italic tracking-tight">Estratégia de Preço</h2>
                        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Defina como o app calcula seus lucros</p>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {/* Margem de Lucro */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <label className="text-xs font-black uppercase tracking-widest text-primary/60">Markup Sugerido (%)</label>
                          <span className="text-xl font-black text-secondary italic">{settings.markup}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="400"
                          step="5"
                          value={settings.markup}
                          onChange={(e) => setSettings({ ...settings, markup: Number(e.target.value) })}
                          onMouseUp={() => handleSave(settings)}
                          className="w-full h-1.5 bg-primary/5 rounded-full appearance-none cursor-pointer accent-secondary transition-all"
                        />
                        <p className="text-[9px] font-medium text-primary/30 uppercase leading-relaxed">
                          O Markup é multiplicado pelo custo total da receita para sugerir o preço de venda. <br/>
                          (Ex: 100% markup = multiplica custo por 2.0).
                        </p>
                      </div>

                      <div className="h-px bg-primary/5 w-full" />

                      {/* Custos Indiretos */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <label className="text-xs font-black uppercase tracking-widest text-primary/60">Taxa de Custos Indiretos (%)</label>
                          <span className="text-xl font-black text-secondary italic">{settings.indirect_cost_pct}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="50"
                          step="1"
                          value={settings.indirect_cost_pct}
                          onChange={(e) => setSettings({ ...settings, indirect_cost_pct: Number(e.target.value) })}
                          onMouseUp={() => handleSave(settings)}
                          className="w-full h-1.5 bg-primary/5 rounded-full appearance-none cursor-pointer accent-secondary transition-all"
                        />
                        <p className="text-[9px] font-medium text-primary/30 uppercase leading-relaxed">
                          Percentual automático adicionado ao custo de cada receita para cobrir gás, luz, água e etiquetas.
                        </p>
                      </div>

                      <div className="h-px bg-primary/5 w-full" />

                      {/* Taxas de Maquininha */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <label className="text-xs font-black uppercase tracking-widest text-primary/60">Taxas Médias de Cartão (%)</label>
                          <span className="text-xl font-black text-secondary italic">{settings.card_fee_pct}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="15"
                          step="0.5"
                          value={settings.card_fee_pct}
                          onChange={(e) => setSettings({ ...settings, card_fee_pct: Number(e.target.value) })}
                          onMouseUp={() => handleSave(settings)}
                          className="w-full h-1.5 bg-primary/5 rounded-full appearance-none cursor-pointer accent-secondary transition-all"
                        />
                        <p className="text-[9px] font-medium text-primary/30 uppercase leading-relaxed">
                          Percentual descontado pela operadora de cartão. <br/>
                          Influencia no preço sugerido para manter sua margem líquida.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                    <span className="material-symbols-outlined text-[300px]">calculating</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "categorias" && (
              <motion.div
                key="categorias"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="bg-surface rounded-[40px] border border-primary/5 p-10 shadow-sm">
                  <div className="flex items-center gap-6 mb-10">
                    <div className="w-14 h-14 bg-secondary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-secondary text-3xl">category</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-primary uppercase italic tracking-tight">Gestão de Portfólio</h2>
                      <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Gerencie as categorias de produtos do seu Atelier</p>
                    </div>
                  </div>

                  {/* Add Category */}
                  <div className="flex gap-3 mb-8">
                    <input 
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Nova categoria (ex: Bento Cake)"
                      className="flex-1 bg-primary/5 px-6 py-4 rounded-2xl text-sm font-bold text-primary placeholder:text-primary/20 outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                      onKeyDown={(e) => e.key === "Enter" && addCategory()}
                    />
                    <button 
                      onClick={addCategory}
                      className="px-8 py-4 bg-secondary text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg"
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {settings.categories.map(cat => (
                      <motion.div 
                        layout
                        key={cat}
                        className="flex items-center justify-between p-5 bg-background rounded-3xl border border-primary/5 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-secondary" />
                          <span className="text-xs font-black text-primary/80 uppercase tracking-tight">{cat}</span>
                        </div>
                        <button 
                          onClick={() => removeCategory(cat)}
                          className="w-8 h-8 rounded-xl bg-error/5 text-error opacity-0 group-hover:opacity-100 transition-all hover:bg-error hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "sistema" && (
              <motion.div
                key="sistema"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="bg-surface rounded-[40px] border border-primary/5 p-10 shadow-sm relative overflow-hidden group">
                  <div className="relative z-10 flex flex-col gap-8">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-secondary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-secondary text-3xl">cloud_sync</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-primary uppercase italic tracking-tight">Sincronização Master</h2>
                        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">Status da nuvem e unidades de medida</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Base Unit Selection */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary/40 ml-1">Unidade Base Padrão</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["g", "ml", "un"] as const).map(unit => (
                            <button
                              key={unit}
                              onClick={() => handleSave({ ...settings, base_unit: unit })}
                              className={cn(
                                "py-4 rounded-2xl text-xs font-black uppercase transition-all border",
                                settings.base_unit === unit 
                                  ? "bg-secondary text-primary border-secondary shadow-lg" 
                                  : "bg-primary/5 text-primary/30 border-transparent hover:bg-primary/10"
                              )}
                            >
                              {unit}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sync Stats */}
                      <div className="bg-background rounded-[32px] p-6 border border-primary/5 flex flex-col justify-center gap-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">Status Supabase</span>
                          <span className="flex items-center gap-2 text-[10px] font-black text-secondary">
                            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                            CONECTADO
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">Última Sincronia</span>
                          <span className="text-[10px] font-black text-primary/60">HOJE ÀS {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button 
                        onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
                          const downloadAnchorNode = document.createElement('a');
                          downloadAnchorNode.setAttribute("href",     dataStr);
                          downloadAnchorNode.setAttribute("download", "acola_settings.json");
                          document.body.appendChild(downloadAnchorNode);
                          downloadAnchorNode.click();
                          downloadAnchorNode.remove();
                          addToast("Configurações exportadas!");
                        }}
                        className="flex items-center justify-center gap-3 py-4 bg-primary/5 text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all border border-primary/5"
                      >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Exportar JSON
                      </button>

                      <button 
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.json';
                          input.onchange = (e: any) => {
                            const file = e.target.files[0];
                            const reader = new FileReader();
                            reader.readAsText(file, 'UTF-8');
                            reader.onload = (readerEvent) => {
                              try {
                                const content = readerEvent.target?.result as string;
                                const parsed = JSON.parse(content);
                                handleSave(parsed);
                                addToast("Configurações importadas!");
                                setTimeout(() => window.location.reload(), 1000);
                              } catch (err) {
                                addToast("Erro ao importar JSON", "alert");
                              }
                            }
                          }
                          input.click();
                        }}
                        className="flex items-center justify-center gap-3 py-4 bg-primary/5 text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all border border-primary/5"
                      >
                        <span className="material-symbols-outlined text-lg">upload</span>
                        Importar JSON
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => {
                        if (confirm("Isso apagará o cache local do seu navegador. O banco de dados Supabase não será afetado. Deseja continuar?")) {
                          localStorage.clear();
                          window.location.reload();
                        }
                      }}
                      className="mt-4 flex items-center justify-center gap-3 py-5 bg-error/5 text-error rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-error hover:text-white transition-all border border-error/10 border-dashed"
                    >
                      <span className="material-symbols-outlined text-lg">cleaning_services</span>
                      Limpar Ativos Locais (Hard Reset)
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Panel: Summary/Tips */}
        <div className="md:col-span-4 space-y-6">
           <div className="bg-secondary p-8 rounded-[40px] text-primary relative overflow-hidden group">
              <h4 className="text-lg font-black italic tracking-tighter uppercase mb-4 leading-none">Dica de Especialista</h4>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                {activeTab === "precificacao" 
                  ? "Um markup de 100% (x2.0) é o mínimo recomendado para um atelier saudável, garantindo que você cubra custos e ainda tenha margem para reinvestir." 
                  : activeTab === "categorias" 
                  ? "Mantenha as categorias enxutas para facilitar a leitura dos gráficos no Dashboard e a busca rápida por produtos no estoque."
                  : "A sincronia com o Supabase garante que você possa abrir o app no seu celular enquanto faz as compras no mercado e ver o estoque real."}
              </p>
              <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none group-hover:rotate-12 transition-transform duration-500">
                <span className="material-symbols-outlined text-[100px]">tips_and_updates</span>
              </div>
           </div>

           <div className="bg-surface rounded-[40px] border border-primary/5 p-8 flex flex-col gap-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/40">Status do Sistema</h4>
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-[11px] font-bold text-primary/70">Database Engine: Supabase v2</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-[11px] font-bold text-primary/70">Local Persistence: Active</span>
                 </div>
              </div>
           </div>
        </div>
      </main>

      {/* Toast System */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={cn(
                "px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
                t.type === "success" ? "bg-primary text-secondary border-secondary/20" : "bg-error text-white border-white/10"
              )}
            >
              <span className="material-symbols-outlined text-xl">
                {t.type === "success" ? "check_circle" : "warning"}
              </span>
              <p className="text-[10px] font-black uppercase tracking-widest">{t.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

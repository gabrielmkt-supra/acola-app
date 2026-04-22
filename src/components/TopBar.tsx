"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Lógica de Títulos Dinâmicos
  const getPageTitle = () => {
    if (pathname.includes("/vendas")) return { title: "Ponto de Venda", subtitle: "Realizar Pedido", back: true };
    if (pathname.includes("/configuracoes")) return { title: "Configurações", subtitle: "Personalize seu Atelier", back: true };
    if (pathname.includes("/novo-produto")) return { title: "Produto / Estoque", subtitle: "Gestão de Inventário", back: true };
    if (pathname.includes("/insumos")) return { title: "Gestão de Insumos", subtitle: "Controle de Matéria-Prima", back: true };
    if (pathname.includes("/fluxo-caixa")) return { title: "Fluxo de Caixa", subtitle: "Análise Financeira", back: true };
    if (pathname.includes("/movimentacoes")) return { title: "Movimentações", subtitle: "Auditoria de Estoque", back: true };
    if (pathname.includes("/sync")) return { title: "Central de Sincronia", subtitle: "Migração Supabase", back: true };
    
    return { title: "E-commerce Insights", subtitle: "Painel de Gestão", back: false };
  };

  const { title, subtitle, back } = getPageTitle();

  return (
    <header className="h-20 shrink-0 flex items-center px-8 bg-background/80 backdrop-blur-xl border-b border-primary/5 sticky top-0 z-30">
      <div className="max-w-[1920px] mx-auto w-full flex justify-between items-center">
        {/* Page Title / Location */}
        <div className="flex items-center gap-4">
          {back && (
            <button 
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
          )}
          <div className="hidden md:block">
            <h2 className="text-xl md:text-2xl font-black text-primary tracking-tight leading-none uppercase italic">{title}</h2>
            <p className="text-[9px] md:text-xs font-bold text-primary/40 uppercase tracking-widest mt-1">{subtitle}</p>
          </div>
        </div>

        {/* Actions Area */}
        <div className="flex items-center gap-6 flex-1 justify-end">
          {/* Search Bar - Hidden on small screens */}
          <div className="relative w-full max-w-sm hidden lg:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-xl">search</span>
            <input 
              className="w-full pl-10 pr-4 py-2.5 bg-secondary text-primary placeholder:text-primary/40 border border-primary/5 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none shadow-sm font-bold" 
              placeholder="Pesquisar..." 
              type="text"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Actions Dropdown */}
            <div className="relative group">
              <button className="bg-secondary text-primary text-[10px] font-black uppercase tracking-wider py-2.5 px-5 rounded-xl flex items-center gap-2 hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/10 whitespace-nowrap">
                AÇÕES RÁPIDAS
                <span className="material-symbols-outlined text-sm font-black">keyboard_arrow_down</span>
              </button>
              
              <div className="absolute top-full right-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-[60]">
                <div className="bg-surface rounded-2xl border border-primary/5 shadow-2xl p-2 min-w-[220px]">
                  <Link 
                    href="/novo-produto"
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary hover:bg-secondary/20 rounded-xl transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">add_box</span>
                    Novo Produto
                  </Link>
                  <Link 
                    href="/repor-estoque"
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary hover:bg-secondary/20 rounded-xl transition-colors border-t border-primary/5"
                  >
                    <span className="material-symbols-outlined text-lg">add_home_work</span>
                    Repor Estoque
                  </Link>
                  <Link 
                    href="/vendas"
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary hover:bg-secondary/20 rounded-xl transition-colors border-t border-primary/5"
                  >
                    <span className="material-symbols-outlined text-lg">shopping_cart</span>
                    Nova Venda (PDV)
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}


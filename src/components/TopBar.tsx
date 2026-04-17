"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function TopBar() {
  return (
    <header className="h-20 shrink-0 flex items-center px-8 bg-background/80 backdrop-blur-xl border-b border-primary/5 sticky top-0 z-30">
      <div className="max-w-[1920px] mx-auto w-full flex justify-between items-center">
        {/* Page Title / Location */}
        <div className="hidden md:block">
          <h2 className="text-2xl font-black text-primary tracking-tight">E-commerce Insights</h2>
          <p className="text-xs font-bold text-primary/40 uppercase tracking-widest">Painel de Gestão</p>
        </div>

        {/* Actions Area */}
        <div className="flex items-center gap-6 flex-1 justify-end">
          {/* Search Bar */}
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
                    Produto / Estoque
                  </Link>
                  <Link 
                    href="/pedidos"
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary hover:bg-secondary/20 rounded-xl transition-colors border-t border-primary/5"
                  >
                    <span className="material-symbols-outlined text-lg">payments</span>
                    Pedidos / Vendas
                  </Link>
                </div>
              </div>
            </div>

            {/* Notification/Settings (Decorative) */}
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary text-primary hover:bg-secondary/90 transition-all shadow-sm">
                <span className="material-symbols-outlined font-black">notifications</span>
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-secondary text-primary hover:bg-secondary/90 transition-all shadow-sm">
                <span className="material-symbols-outlined font-black">settings</span>
              </button>
            </div>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-2 border-l border-primary/5">
              <div className="hidden xl:flex flex-col items-end">
                <span className="text-sm font-black text-primary">Ethan Carter</span>
                <span className="text-[10px] font-bold text-primary/40 uppercase">Proprietário</span>
              </div>
              <div className="w-10 h-10 rounded-xl border-2 border-secondary/50 overflow-hidden bg-surface-variant flex items-center justify-center cursor-pointer hover:border-secondary transition-all shadow-sm">
                <img 
                  alt="User profile" 
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBA0pIVbxduwKKI_K35EFhBbtiaTbG5WgJL2LPz-UUvuAaw_GWRiQe1_SzjQ6ZcizODBOmJzptclMvVMjRCXtacuzL8cLemcn7tqEnnhHL36UCxi-ypwXCLedHflStanqTyO6leWvZmOXkR0fFDq30A-DiUOd0xeNxuwiRCqHCi_wOiAiQPr6Qb4xaed3ZbxUrwDljTrUuMo6YbouPoUZo1-BSlZTS9eP-6zApiDGMgRUTRUIfL5rvkrxlHOBsOAgwcckxAl1YQ"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

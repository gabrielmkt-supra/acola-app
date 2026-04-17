"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type NavItem = {
  name: string;
  href: string;
  icon: string;
  fill?: boolean;
  children?: { name: string; href: string; icon: string }[];
};

const navItems: NavItem[] = [
  { name: "ESTOQUE", href: "/", icon: "inventory_2", fill: true },
  { name: "MOVIMENTAÇÕES", href: "/movimentacoes", icon: "swap_horiz" },
  { name: "PEDIDOS", href: "/pedidos", icon: "assignment" },
  { name: "COMPRAS", href: "/compras", icon: "shopping_cart" },
  { 
    name: "CAIXA", 
    href: "#", 
    icon: "account_balance_wallet",
    children: [
      { name: "CUSTOS", href: "/custos", icon: "receipt_long" },
      { name: "FLUXO DE CAIXA", href: "/fluxo-caixa", icon: "trending_up" },
    ]
  },
];

export function Header() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 h-20 bg-surface border-b border-primary/5 z-50 px-6">
      <div className="max-w-[1920px] mx-auto h-full flex items-center justify-between">
        {/* Logo Area */}
        <Link href="/" className="shrink-0 group">
          <h1 className="text-xl font-black text-primary tracking-tight transition-transform group-hover:scale-[1.02]">
            Acolá Admin
          </h1>
          <p className="text-[10px] text-primary/60 font-bold uppercase tracking-[0.2em]">
            Gestão Atelier
          </p>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const hasActiveChild = item.children?.some(child => pathname === child.href);
            const isActive = pathname === item.href || hasActiveChild;
            
            if (item.children) {
              return (
                <div key={item.name} className="relative group/nav">
                  <button
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 transition-all duration-200 text-sm whitespace-nowrap",
                      isActive 
                        ? "bg-primary text-secondary rounded-lg shadow-sm font-bold" 
                        : "text-primary/60 hover:text-primary font-semibold rounded-lg"
                    )}
                  >
                    <span 
                      className={cn(
                        "material-symbols-outlined text-lg",
                        isActive ? "text-secondary" : "text-inherit"
                      )}
                    >
                      {item.icon}
                    </span>
                    {item.name}
                    <span className="material-symbols-outlined text-sm opacity-50">keyboard_arrow_down</span>
                  </button>
                  
                  {/* Submenu Dropdown */}
                  <div className="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-y-0 group-hover/nav:pointer-events-auto transition-all duration-200 z-[60]">
                    <div className="bg-surface rounded-2xl border border-primary/5 shadow-2xl p-2 min-w-[220px]">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-colors",
                            pathname === child.href ? "bg-primary/5 text-primary" : "text-primary/60 hover:bg-secondary/20 hover:text-primary"
                          )}
                        >
                          <span className="material-symbols-outlined text-lg">{child.icon}</span>
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 transition-all duration-200 text-sm whitespace-nowrap",
                  isActive 
                    ? "bg-primary text-secondary rounded-lg shadow-sm font-bold" 
                    : "text-primary/60 hover:text-primary font-semibold rounded-lg"
                )}
              >
                <span 
                  className={cn(
                    "material-symbols-outlined text-lg",
                    isActive ? "text-secondary" : "text-inherit"
                  )}
                  style={isActive && item.fill ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Profile & Actions */}
        <div className="flex items-center gap-4">
          <div className="relative group hidden sm:block">
            <button className="bg-primary text-secondary text-[11px] font-black uppercase tracking-wider py-2.5 px-6 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/10">
              AÇÕES RÁPIDAS
              <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
            </button>
            <div className="absolute top-full right-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-[60]">
              <div className="bg-surface rounded-2xl border border-primary/5 shadow-2xl p-2 min-w-[200px]">
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary hover:bg-secondary/20 rounded-xl transition-colors">
                  <span className="material-symbols-outlined text-lg">add_box</span>
                  Adicionar Produto
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary hover:bg-secondary/20 rounded-xl transition-colors border-t border-primary/5">
                  <span className="material-symbols-outlined text-lg">shopping_cart</span>
                  Realizar Venda
                </button>
              </div>
            </div>
          </div>
          
          <div className="w-10 h-10 rounded-full border-2 border-secondary/50 overflow-hidden bg-surface-variant flex items-center justify-center cursor-pointer hover:border-secondary transition-all">
            <img 
              alt="User profile" 
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBA0pIVbxduwKKI_K35EFhBbtiaTbG5WgJL2LPz-UUvuAaw_GWRiQe1_SzjQ6ZcizODBOmJzptclMvVMjRCXtacuzL8cLemcn7tqEnnhHL36UCxi-ypwXCLedHflStanqTyO6leWvZmOXkR0fFDq30A-DiUOd0xeNxuwiRCqHCi_wOiAiQPr6Qb4xaed3ZbxUrwDljTrUuMo6YbouPoUZo1-BSlZTS9eP-6zApiDGMgRUTRUIfL5rvkrxlHOBsOAgwcckxAl1YQ"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}

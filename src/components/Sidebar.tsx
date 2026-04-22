"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  { 
    name: "FINANCEIRO", 
    href: "#", 
    icon: "shopping_cart",
    children: [
      { name: "GESTÃO DE INSUMOS", href: "/insumos", icon: "inventory_2" },
      { name: "REGISTRO DE COMPRAS", href: "/compras", icon: "post_add" },
      { name: "FLUXO DE CAIXA", href: "/fluxo-caixa", icon: "query_stats" },
    ]
  },
  { name: "TUTORIAIS", href: "/tutoriais", icon: "smart_display" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Inicializar tema
  useEffect(() => {
    const savedTheme = localStorage.getItem("acola_theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("acola_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <aside className="h-screen bg-background z-[100] flex flex-col items-center py-6 hidden md:flex transition-all duration-300 shrink-0 w-24">
      {/* Logo Area */}
      <motion.div 
        whileHover={{ scale: 1.05 }}
        className="w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center mb-8 shrink-0 cursor-pointer overflow-hidden"
      >
        <img src="/logo.png" alt="Acolá Logo" className="w-full h-full object-cover" />
      </motion.div>

      {/* Floating Dock Container */}
      <div className="bg-surface rounded-[40px] shadow-sm border border-primary/5 p-2 flex flex-col gap-3 w-14">
        {navItems.map((item) => {
          const hasActiveChild = item.children?.some(child => pathname === child.href);
          const isActive = pathname === item.href || hasActiveChild;

          return (
            <div key={item.name} className="relative group/item">
              {item.children ? (
                <div 
                  className="relative"
                  onMouseEnter={() => setOpenSubmenu(item.name)}
                  onMouseLeave={() => setOpenSubmenu(null)}
                >
                  <button
                    className={cn(
                      "w-full h-10 rounded-full flex items-center justify-center transition-all duration-300",
                      isActive ? "bg-secondary text-primary shadow-md" : "text-primary/40 hover:bg-primary/5 hover:text-primary"
                    )}
                  >
                    <motion.span 
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      className="material-symbols-outlined text-xl shrink-0"
                    >
                      {item.icon}
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {openSubmenu === item.name && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: 10 }}
                        className="absolute left-full top-0 ml-4 bg-surface border border-primary/10 rounded-3xl shadow-2xl p-2 min-w-[200px] z-[110]"
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 text-[11px] font-bold rounded-2xl transition-all",
                              pathname === child.href ? "bg-secondary text-primary shadow-sm" : "text-primary/60 hover:bg-primary/5 hover:text-primary"
                            )}
                          >
                            <span className="material-symbols-outlined text-lg">{child.icon}</span>
                            {child.name}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "w-full h-10 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive ? "bg-secondary text-primary shadow-md" : "text-primary/40 hover:bg-primary/5 hover:text-primary"
                  )}
                >
                  <motion.span 
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    className="material-symbols-outlined text-xl shrink-0"
                  >
                    {item.icon}
                  </motion.span>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Controls */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="bg-surface rounded-full shadow-sm border border-primary/5 p-1 flex flex-col items-center gap-1 w-12">
          <button 
            onClick={() => toggleTheme("light")}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full transition-all",
              theme === "light" ? "bg-secondary/20 text-secondary" : "text-primary/20 hover:text-primary"
            )}
          >
            <span className="material-symbols-outlined text-xl">light_mode</span>
          </button>
          <button 
            onClick={() => toggleTheme("dark")}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full transition-all",
              theme === "dark" ? "bg-secondary/20 text-secondary" : "text-primary/20 hover:text-primary"
            )}
          >
            <span className="material-symbols-outlined text-xl">dark_mode</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

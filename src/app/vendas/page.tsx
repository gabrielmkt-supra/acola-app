"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn, formatUnitCost } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  category: string;
}

export default function PDVPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modo de Venda
  const [channel, setChannel] = useState<"balcao" | "ifood">("balcao");
  const [ifoodFeePct, setIfoodFeePct] = useState(23); // Padrão iFood
  const [deliveryFee, setDeliveryFee] = useState(0);
  
  // Dados do Cliente
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cartão");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) {
      setProducts(data);
      setFilteredProducts(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, category: product.category }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const calculateSubtotal = () => cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  const subtotal = calculateSubtotal();
  
  // Cálculos iFood / Direta com Frete
  const platformFeesAmount = channel === "ifood" ? (subtotal * (ifoodFeePct / 100)) : 0;
  const totalAmount = subtotal + deliveryFee;
  const netAmount = totalAmount - platformFeesAmount;

  const handleFinalize = async () => {
    if (cart.length === 0) return;
    setIsSaving(true);

    try {
      // 1. Criar o pedido no Supabase
      const orderPayload = {
        client_name: clientName || (channel === "ifood" ? "Cliente iFood" : "Cliente Balcão"),
        client_phone: clientPhone,
        client_address_street: clientStreet,
        client_address_city: clientCity,
        total: totalAmount,
        payment_method: channel === "ifood" ? "iFood App" : paymentMethod,
        payment_status: "pago",
        items: cart,
        channel: channel,
        platform_fees: platformFeesAmount,
        delivery_fee: deliveryFee,
        net_amount: netAmount,
        timestamp: new Date().toISOString()
      };

      const { error: orderError } = await supabase.from('orders').insert([orderPayload]);
      if (orderError) throw orderError;

      // 2. Abater estoque
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (product) {
          const newStock = Math.max(0, product.stock - item.qty);
          await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
        }
      }

      // 3. Sucesso e Redirecionamento
      alert("✅ Venda computada com sucesso! Redirecionando...");
      router.push("/");

    } catch (e: any) {
      console.error(e);
      alert("❌ Erro ao finalizar venda: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-background">
      {/* Esquerda: Catálogo */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/30">search</span>
            <input 
              type="text"
              placeholder="Buscar por produto ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-surface border border-primary/5 rounded-[24px] text-sm font-bold text-primary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
            />
          </div>
          
          <div className="flex bg-surface p-1 rounded-[24px] border border-primary/5">
             <button 
               onClick={() => { setChannel("balcao"); setIfoodFeePct(0); }}
               className={cn(
                 "px-6 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all",
                 channel === "balcao" ? "bg-secondary text-primary shadow-lg" : "text-primary/30 hover:bg-primary/5"
               )}
             >
               Venda Direta
             </button>
             <button 
               onClick={() => { setChannel("ifood"); setIfoodFeePct(23); }}
               className={cn(
                 "px-6 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                 channel === "ifood" ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-primary/30 hover:bg-primary/5"
               )}
             >
               {channel === "ifood" && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
               Canal iFood
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-full opacity-20 font-black uppercase tracking-[0.3em]">Carregando Catálogo...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((p) => (
                <motion.div 
                  key={p.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addToCart(p)}
                  className="bg-surface p-4 rounded-[32px] border border-primary/5 shadow-sm cursor-pointer hover:shadow-xl hover:border-secondary/20 transition-all group flex flex-col h-full"
                >
                  <div className="w-full aspect-square rounded-[24px] overflow-hidden mb-4 bg-background relative">
                    <img 
                      src={p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=2a2a2a&color=c9a84c&bold=true`} 
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black text-white uppercase tracking-widest">
                      {p.category}
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 justify-between gap-2">
                    <h3 className="text-xs font-black text-primary uppercase tracking-tight line-clamp-2 leading-none">{p.name}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-black text-secondary">R$ {formatUnitCost(p.price)}</span>
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-1 rounded-lg",
                        p.stock <= 5 ? "bg-error/10 text-error" : "bg-primary/5 text-primary/40"
                      )}>{p.stock} UN</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Direita: Carrinho */}
      <div className="w-[450px] bg-surface border-l border-primary/5 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-primary/5 bg-background/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-primary uppercase italic tracking-tighter">Carrinho / Cliente</h2>
            <span className="bg-secondary text-primary px-3 py-1 rounded-full text-[9px] font-black">{cart.length} ITENS</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="relative col-span-2">
               <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">person</span>
               <input 
                 type="text" 
                 placeholder="Nome Completo"
                 value={clientName}
                 onChange={(e) => setClientName(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30 transition-all"
               />
            </div>
            
            <div className="relative">
               <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">call</span>
               <input 
                 type="text" 
                 placeholder="Telefone / WhatsApp"
                 value={clientPhone}
                 onChange={(e) => setClientPhone(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30 transition-all"
               />
            </div>

            <div className="relative">
               <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">location_city</span>
               <input 
                 type="text" 
                 placeholder="Cidade"
                 value={clientCity}
                 onChange={(e) => setClientCity(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30 transition-all"
               />
            </div>

            <div className="relative col-span-2">
               <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">home</span>
               <input 
                 type="text" 
                 placeholder="Endereço (Rua, Número, Bairro)"
                 value={clientStreet}
                 onChange={(e) => setClientStreet(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30 transition-all"
               />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase text-primary/40 ml-1">Taxa de Entrega (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary/20">R$</span>
                <input 
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value))}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-black text-primary outline-none focus:border-secondary/30"
                />
              </div>
            </div>
            
            {channel === "ifood" && (
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-primary/40 ml-1">Taxa iFood (%)</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-red-500/40">%</span>
                  <input 
                    type="number"
                    value={ifoodFeePct}
                    onChange={(e) => setIfoodFeePct(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-red-500/5 border border-red-500/10 rounded-xl text-[11px] font-black text-red-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-primary/20 gap-4 opacity-40">
              <span className="material-symbols-outlined text-5xl">shopping_basket</span>
              <p className="text-[9px] font-black uppercase tracking-widest">O carrinho está vazio</p>
            </div>
          ) : (
            <AnimatePresence>
              {cart.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-3 bg-background/50 p-3 rounded-2xl border border-primary/5 group"
                >
                  <div className="flex-1">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-tight mb-0.5 line-clamp-1">{item.name}</h4>
                    <p className="text-[9px] font-bold text-secondary">R$ {formatUnitCost(item.price)}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-background rounded-lg border border-primary/5 p-0.5">
                      <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 flex items-center justify-center hover:bg-primary/5 rounded text-primary/40 hover:text-primary transition-all">
                        <span className="material-symbols-outlined text-xs">remove</span>
                      </button>
                      <span className="w-6 text-center text-[10px] font-black text-primary">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 flex items-center justify-center hover:bg-primary/5 rounded text-primary/40 hover:text-primary transition-all">
                        <span className="material-symbols-outlined text-xs">add</span>
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-error/30 hover:text-error hover:bg-error/10 transition-all">
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="p-6 bg-background/50 border-t border-primary/5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-primary/40 text-[9px] font-bold uppercase tracking-widest">
              <span>Subtotal Itens</span>
              <span>R$ {formatUnitCost(subtotal)}</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-primary/40 text-[9px] font-bold uppercase tracking-widest">
                <span>Taxa de Entrega</span>
                <span>+ R$ {formatUnitCost(deliveryFee)}</span>
              </div>
            )}
            {channel === "ifood" && (
              <div className="flex justify-between text-red-500/60 text-[9px] font-bold uppercase tracking-widest">
                <span>Comissão iFood ({ifoodFeePct}%)</span>
                <span>- R$ {formatUnitCost(platformFeesAmount)}</span>
              </div>
            )}
            <div className="h-px bg-primary/5 my-3" />
            <div className="flex justify-between items-end">
               <div>
                  <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.2em] mb-1">Total Cliente</p>
                  <p className="text-3xl font-black text-primary italic tracking-tighter leading-none">R$ {formatUnitCost(totalAmount)}</p>
               </div>
               {channel === "ifood" && (
                 <div className="text-right">
                    <p className="text-[8px] font-black text-success uppercase tracking-widest mb-1">Liquido Atelier</p>
                    <p className="text-lg font-black text-success tracking-tight leading-none">R$ {formatUnitCost(netAmount)}</p>
                 </div>
               )}
            </div>
          </div>

          <button 
            disabled={cart.length === 0 || isSaving}
            onClick={handleFinalize}
            className={cn(
              "w-full py-5 rounded-[20px] text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-xl",
              cart.length === 0 ? "bg-primary/5 text-primary/20 cursor-not-allowed" : "bg-secondary text-primary hover:scale-[1.02] active:scale-95 shadow-secondary/20"
            )}
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-base">check_circle</span>
                Finalizar e Computar Venda
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

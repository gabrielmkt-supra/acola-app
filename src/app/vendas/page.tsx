"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn, formatUnitCost } from "@/lib/utils";

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
  
  // Modo de Venda e Entrega
  const [channel, setChannel] = useState<"balcao" | "ifood">("balcao");
  const [isDelivery, setIsDelivery] = useState(false);
  const [ifoodFeePct, setIfoodFeePct] = useState(28.69); 
  const [platformIncentives, setPlatformIncentives] = useState(0); 
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState("");
  
  // Dados do Cliente
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientStreet, setClientStreet] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cartão");

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (channel === "ifood") {
      setIsDelivery(true);
      if (ifoodFeePct === 0) setIfoodFeePct(28.69);
    } else {
      setPlatformIncentives(0);
    }
  }, [channel]);

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

  // LÓGICA DE COMBO: 3 geladinhos por 27,99
  const calculateSubtotal = () => {
    let total = 0;
    let geladinhosQty = 0;
    
    cart.forEach(item => {
      if (item.category.toLowerCase().includes("geladinho")) {
        geladinhosQty += item.qty;
      } else {
        total += item.price * item.qty;
      }
    });

    const combos = Math.floor(geladinhosQty / 3);
    const remaining = geladinhosQty % 3;
    total += combos * 27.99;
    
    const firstGeladinho = cart.find(i => i.category.toLowerCase().includes("geladinho"));
    if (firstGeladinho && remaining > 0) {
      total += remaining * firstGeladinho.price;
    }

    return total;
  };

  const subtotal = calculateSubtotal();
  const platformFeesAmount = channel === "ifood" ? (subtotal * (ifoodFeePct / 100)) : 0;
  const totalAmount = subtotal + (isDelivery ? deliveryFee : 0);
  const netAmount = totalAmount - platformFeesAmount - platformIncentives;

  const handleFinalize = async () => {
    if (cart.length === 0) return;
    setIsSaving(true);

    try {
      const timestamp = new Date().toISOString();
      
      // Mapear itens para usar 'quantity' (padrão do sistema para estorno)
      const itemsForOrder = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
        category: item.category
      }));

      // 1. Criar o pedido
      const orderPayload = {
        client_name: clientName || (channel === "ifood" ? "Cliente iFood" : "Cliente Balcão"),
        client_phone: clientPhone,
        client_address_street: isDelivery ? clientStreet : "",
        client_address_city: isDelivery ? clientCity : "",
        total: totalAmount,
        payment_method: channel === "ifood" ? "iFood App" : paymentMethod,
        payment_status: "pago",
        items: itemsForOrder,
        channel: channel,
        platform_fees: platformFeesAmount,
        platform_incentives: platformIncentives,
        delivery_fee: isDelivery ? deliveryFee : 0,
        net_amount: netAmount,
        is_delivery: isDelivery,
        delivery_date: isDelivery ? deliveryDate : null,
        timestamp: timestamp
      };

      const { data: newOrder, error: orderError } = await supabase.from('orders').insert([orderPayload]).select().single();
      if (orderError) throw orderError;

      // 2. Abater estoque e Registrar Movimentação para cada item
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (product) {
          const previousStock = Number(product.stock);
          const newStock = Math.max(0, previousStock - item.qty);
          
          // Atualiza Produto
          await supabase.from('products').update({ stock: newStock }).eq('id', item.id);

          // Registra na Central de Fluxo
          await supabase.from('inventory_movements').insert([{
            product_id: item.id,
            product_name: item.name,
            type: "Saída",
            amount: -item.qty, // Negativo pois é saída
            previous_stock: previousStock,
            final_stock: newStock,
            note: `VENDA: ${orderPayload.client_name.toUpperCase()} - Pedido #${newOrder.id.split('-').pop()} (${channel.toUpperCase()})`
          }]);
        }
      }

      alert("✅ Venda computada com sucesso!");
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
                 channel === "balcao" ? "bg-secondary text-primary-foreground shadow-lg" : "text-primary/30 hover:bg-primary/5"
               )}
             >
               Venda Direta
             </button>
             <button 
               onClick={() => { setChannel("ifood"); setIfoodFeePct(28.69); }}
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black text-primary uppercase italic tracking-tighter">Pedido / Cliente</h2>
            <div className="flex bg-background/50 p-1 rounded-xl border border-primary/5">
               <button 
                 onClick={() => setIsDelivery(false)}
                 disabled={channel === "ifood"}
                 className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", !isDelivery ? "bg-secondary text-primary-foreground shadow-lg" : "text-primary/30 hover:bg-primary/5")}
               >Balcão</button>
               <button 
                 onClick={() => setIsDelivery(true)}
                 className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", isDelivery ? "bg-secondary text-primary-foreground shadow-lg" : "text-primary/30 hover:bg-primary/5")}
               >Entrega</button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="relative col-span-2">
               <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">person</span>
               <input 
                 type="text" 
                 placeholder="Nome do Cliente"
                 value={clientName}
                 onChange={(e) => setClientName(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30 transition-all"
               />
            </div>
            
            <div className="relative col-span-2">
               <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">call</span>
               <input 
                 type="text" 
                 placeholder="WhatsApp / Contato"
                 value={clientPhone}
                 onChange={(e) => setClientPhone(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30 transition-all"
               />
            </div>

            {/* CAMPOS CONDICIONAIS DE ENTREGA */}
            <AnimatePresence>
              {isDelivery && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="col-span-2 grid grid-cols-2 gap-3 overflow-hidden"
                >
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">location_city</span>
                    <input 
                      type="text" 
                      placeholder="Cidade"
                      value={clientCity}
                      onChange={(e) => setClientCity(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30"
                    />
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">calendar_today</span>
                    <input 
                      type="datetime-local" 
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30"
                    />
                  </div>
                  <div className="relative col-span-2">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/30 text-base">home</span>
                    <input 
                      type="text" 
                      placeholder="Endereço (Rua, Número, Bairro)"
                      value={clientStreet}
                      onChange={(e) => setClientStreet(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-bold text-primary outline-none focus:border-secondary/30"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[8px] font-black uppercase text-primary/40 ml-1">Taxa de Entrega (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary/20">R$</span>
                      <input 
                        type="number"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(Number(e.target.value))}
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-black text-primary outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {channel === "ifood" && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-2 grid grid-cols-2 gap-3"
              >
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-primary/40 ml-1">Taxa iFood (%)</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary/20">%</span>
                    <input 
                      type="number"
                      value={ifoodFeePct}
                      onChange={(e) => setIfoodFeePct(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-black text-primary outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-primary/40 ml-1">Incentivos iFood (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary/20">R$</span>
                    <input 
                      type="number"
                      value={platformIncentives}
                      onChange={(e) => setPlatformIncentives(Number(e.target.value))}
                      className="w-full pl-9 pr-4 py-2.5 bg-background border border-primary/5 rounded-xl text-[11px] font-black text-primary outline-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-primary/20 gap-4 opacity-40">
              <span className="material-symbols-outlined text-5xl">shopping_basket</span>
              <p className="text-[9px] font-black uppercase tracking-widest">Carrinho vazio</p>
            </div>
          ) : (
            <AnimatePresence>
              {cart.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-3 bg-background/50 p-3 rounded-2xl border border-primary/5"
                >
                  <div className="flex-1">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-tight mb-0.5">{item.name}</h4>
                    <p className="text-[9px] font-bold text-secondary">R$ {formatUnitCost(item.price)}</p>
                  </div>
                  <div className="flex items-center bg-background rounded-lg border border-primary/5 p-0.5">
                    <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 flex items-center justify-center text-primary/40"><span className="material-symbols-outlined text-xs">remove</span></button>
                    <span className="w-6 text-center text-[10px] font-black">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 flex items-center justify-center text-primary/40"><span className="material-symbols-outlined text-xs">add</span></button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-error/30 hover:text-error transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
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
            {isDelivery && deliveryFee > 0 && (
              <div className="flex justify-between text-primary/40 text-[9px] font-bold uppercase tracking-widest">
                <span>Taxa de Entrega</span>
                <span>+ R$ {formatUnitCost(deliveryFee)}</span>
              </div>
            )}
            {channel === "ifood" && (
              <>
                <div className="flex justify-between text-red-500/60 text-[9px] font-bold uppercase tracking-widest">
                  <span>Comissão iFood ({ifoodFeePct}%)</span>
                  <span>- R$ {formatUnitCost(platformFeesAmount)}</span>
                </div>
                {platformIncentives > 0 && (
                  <div className="flex justify-between text-red-500/60 text-[9px] font-bold uppercase tracking-widest">
                    <span>Incentivos iFood</span>
                    <span>- R$ {formatUnitCost(platformIncentives)}</span>
                  </div>
                )}
              </>
            )}
            <div className="h-px bg-primary/5 my-3" />
            <div className="flex justify-between items-end">
               <div>
                  <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.2em] mb-1">Total Cliente</p>
                  <p className="text-3xl font-black text-primary italic tracking-tighter">R$ {formatUnitCost(totalAmount)}</p>
               </div>
               {channel === "ifood" && (
                 <div className="text-right">
                    <p className="text-[8px] font-black text-success uppercase tracking-widest mb-1">Líquido Acolá</p>
                    <p className="text-lg font-black text-success tracking-tight">R$ {formatUnitCost(netAmount)}</p>
                 </div>
               )}
            </div>
          </div>

          <button 
            disabled={cart.length === 0 || isSaving}
            onClick={handleFinalize}
            className={cn(
              "w-full py-5 rounded-[20px] text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-xl",
              cart.length === 0 ? "bg-primary/5 text-primary/20 cursor-not-allowed" : "bg-secondary text-primary-foreground hover:scale-[1.02] active:scale-95 shadow-secondary/20"
            )}
          >
            {isSaving ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : "Finalizar Venda"}
          </button>
        </div>
      </div>
    </div>
  );
}

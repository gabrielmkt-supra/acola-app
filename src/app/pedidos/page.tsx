"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Utility for conditional classes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface Product {
  id: string;
  name: string;
  category: string;
  subtype?: string;
  price: string;
  stock: number;
  image: string;
}

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  category?: string;
  subtype?: string;
}

export default function Pedidos() {
  const router = useRouter();
  const [inventory, setInventory] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qtyValue, setQtyValue] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"pago" | "pendente">("pago");

  // Carregar inventário do Supabase
  useEffect(() => {
    async function loadInventory() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      
      if (!error && data) {
        setInventory(data);
      }
    }
    loadInventory();
  }, []);

  const addToCart = () => {
    if (!selectedProductId) return;
    
    const product = inventory.find(p => p.id === selectedProductId);
    if (!product) return;

    // Trava de Segurança: Validar Estoque Total (existente + no carrinho)
    const existingInCart = cart.find(item => item.id === selectedProductId);
    const cartQty = existingInCart ? existingInCart.quantity : 0;
    const totalRequest = cartQty + qtyValue;

    if (totalRequest > product.stock) {
      alert(`⚠️ ESTOQUE INSUFICIENTE!\nVocê tem apenas ${product.stock} unidades de "${product.name}" em estoque.`);
      return;
    }

    const price = Number(product.price.replace("R$", "").replace(",", "."));

    if (existingInCart) {
      setCart(cart.map(item => 
        item.id === selectedProductId 
          ? { ...item, quantity: item.quantity + qtyValue, total: (item.quantity + qtyValue) * item.pricePerUnit }
          : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        quantity: qtyValue,
        pricePerUnit: price,
        total: qtyValue * price,
        category: product.category,
        subtype: product.subtype ?? "",
      }]);
    }

    // Reset seleção
    setQtyValue(1);
    setSelectedProductId("");
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // ── Lógica do Combo Promocional ───────────────────────────────────────────
  const PROMO_PRICE = 24.90;

  const premiumQty = cart.filter(i => i.category === "Geladinho" && i.subtype === "premium")
    .reduce((acc, i) => acc + i.quantity, 0);
  const classicoQty = cart.filter(i => i.category === "Geladinho" && i.subtype === "classico")
    .reduce((acc, i) => acc + i.quantity, 0);

  const combosAtivos = Math.min(Math.floor(premiumQty / 2), classicoQty);

  const rawTotal = cart.reduce((acc, curr) => acc + curr.total, 0);
  const totalOrder = combosAtivos > 0
    ? (() => {
        const geladinhoItems = cart.filter(i => i.category === "Geladinho");
        const premItems = geladinhoItems.filter(i => i.subtype === "premium");
        const clasItems = geladinhoItems.filter(i => i.subtype === "classico");

        let premUsados = combosAtivos * 2;
        let clasUsados = combosAtivos * 1;
        let custoNormalCombo = 0;

        for (const item of premItems) {
          const qtdNoCombo = Math.min(item.quantity, premUsados);
          custoNormalCombo += qtdNoCombo * item.pricePerUnit;
          premUsados -= qtdNoCombo;
        }
        for (const item of clasItems) {
          const qtdNoCombo = Math.min(item.quantity, clasUsados);
          custoNormalCombo += qtdNoCombo * item.pricePerUnit;
          clasUsados -= qtdNoCombo;
        }

        const economia = custoNormalCombo - (combosAtivos * PROMO_PRICE);
        return Math.max(0, rawTotal - economia);
      })()
    : rawTotal;

  const handleFinalize = async () => {
    if (cart.length === 0 || !clientName) {
      alert("Por favor, preencha o nome do cliente e adicione itens ao carrinho.");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Registrar a Venda no Supabase
      const { data: saleData, error: saleError } = await supabase
        .from("orders")
        .insert([{
          client_name: clientName,
          client_phone: clientPhone,
          total: totalOrder,
          payment_status: paymentStatus,
          items: cart,
          timestamp: new Date().toISOString()
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Atualizar Estoque e Registrar Movimentações para cada item
      for (const item of cart) {
        const product = inventory.find(p => p.id === item.id);
        if (!product) continue;

        const newStock = product.stock - item.quantity;
        
        // Calcular novo status
        const isTrufa = product.category === "Trufa";
        const isCritico = isTrufa ? newStock <= 10 : newStock <= 5;
        let status = newStock <= 0 ? "SEM ESTOQUE" : isCritico ? "CRÍTICO" : "SAUDÁVEL";

        // Update no produto
        await supabase
          .from("products")
          .update({ stock: newStock, status })
          .eq("id", item.id);

        // Registro de Movimentação
        await supabase
          .from("inventory_movements")
          .insert([{
            product_id: item.id,
            product_name: item.name,
            type: "Saída",
            amount: -item.quantity,
            previous_stock: product.stock,
            final_stock: newStock,
            note: `VENDA #${saleData.id.split('-')[0].toUpperCase()} - ${clientName}`
          }]);
      }

      alert(paymentStatus === "pago" ? "Venda realizada com sucesso!" : "Venda registrada como PENDENTE.");
      router.push("/");
    } catch (err) {
      console.error("Erro no PDV:", err);
      alert("Erro ao processar a venda no banco de dados.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="h-20 shrink-0 border-b border-primary/5 px-8 flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-xl z-40">
        <div className="flex items-center gap-4">
           <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all">
             <span className="material-symbols-outlined text-sm">arrow_back</span>
           </Link>
           <div>
             <h1 className="text-xl font-black text-primary tracking-tight uppercase">Pedidos / Vendas</h1>
             <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">PDV em Nuvem</p>
           </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-surface p-8 rounded-[32px] border border-primary/5 shadow-sm space-y-6">
              <h2 className="text-sm font-black text-primary uppercase tracking-widest border-b border-primary/5 pb-4">Dados do Cliente</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all" 
                    placeholder="Ex: João Silva" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Telefone (Opcional)</label>
                  <input 
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all font-mono" 
                    placeholder="(00) 00000-0000" 
                  />
                </div>
              </div>
            </section>

            <section className="bg-surface p-8 rounded-[32px] border border-primary/5 shadow-sm">
              <h2 className="text-sm font-black text-primary uppercase tracking-widest border-b border-primary/5 pb-6 mb-6">Adicionar Itens</h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-7 space-y-1.5">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Produto em Estoque</label>
                  <select 
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Selecione um produto...</option>
                    {inventory.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ({p.stock} un disponíveis)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Qtd</label>
                  <input 
                    type="number"
                    min="1"
                    value={qtyValue}
                    onChange={(e) => setQtyValue(Number(e.target.value))}
                    className="w-full p-4 bg-background border border-primary/5 rounded-2xl focus:ring-2 focus:ring-secondary/50 outline-none text-sm font-bold transition-all text-center"
                  />
                </div>
                <div className="md:col-span-3">
                  <button 
                    onClick={addToCart}
                    className="w-full h-[52px] bg-secondary text-primary rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.03] active:scale-95 transition-all shadow-lg shadow-secondary/20 cursor-pointer"
                  >
                    Add Carrinho
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            <section className="bg-surface rounded-[40px] border border-primary/5 shadow-2xl flex flex-col flex-1 overflow-hidden min-h-[500px]">
              <div className="p-8 border-b border-primary/5 bg-secondary text-primary flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-tight italic">Carrinho</h3>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black tracking-widest">
                  {cart.length} ITENS
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
                <AnimatePresence mode="popLayout">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-primary/10">
                      <span className="material-symbols-outlined text-6xl">shopping_basket</span>
                      <p className="font-bold text-[10px] uppercase tracking-widest mt-4">Carrinho Vazio</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <motion.div key={item.id} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="bg-background rounded-2xl p-4 flex items-center justify-between group border border-transparent hover:border-primary/5 transition-all">
                        <div className="flex-1">
                          <p className="text-sm font-black text-primary leading-tight uppercase">{item.name}</p>
                          <p className="text-[9px] font-bold text-primary/40 uppercase mt-0.5 tracking-tighter">
                            {item.quantity} un x R${item.pricePerUnit.toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-sm font-black text-primary">R${item.total.toFixed(2).replace(".", ",")}</p>
                          <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              <div className="p-8 bg-background/50 border-t border-primary/5 space-y-6">

                {combosAtivos > 0 && (
                  <div className="flex items-center gap-3 bg-secondary/10 border border-secondary/30 rounded-2xl px-4 py-3">
                    <span className="material-symbols-outlined text-secondary text-xl">local_offer</span>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-secondary uppercase tracking-widest">
                        COMBO ATIVO {combosAtivos > 1 ? `x${combosAtivos}` : ""}
                      </p>
                      <p className="text-[9px] font-bold text-primary/50 uppercase tracking-widest">
                        2 Premium + 1 Clássico = R$24,90
                      </p>
                    </div>
                    <p className="text-sm font-black text-secondary">R$24,90</p>
                  </div>
                )}

                <div className="flex justify-between items-end border-b border-primary/5 pb-4">
                  <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">Total Geral</p>
                  <div className="text-right">
                    {combosAtivos > 0 && (
                      <p className="text-xs font-bold text-primary/30 line-through">
                        R$ {rawTotal.toFixed(2).replace(".", ",")}
                      </p>
                    )}
                    <p className="text-4xl font-black text-primary tracking-tighter italic">
                      <span className="text-xl font-bold not-italic mr-1">R$</span>
                      {totalOrder.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Status do Recebimento</label>
                  <div className="flex bg-background p-1.5 rounded-2xl border border-primary/5">
                    <button onClick={() => setPaymentStatus("pago")} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2", paymentStatus === "pago" ? "bg-secondary text-primary shadow-lg" : "text-primary/40 hover:text-primary")}>
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Pago
                    </button>
                    <button onClick={() => setPaymentStatus("pendente")} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2", paymentStatus === "pendente" ? "bg-secondary/20 text-secondary shadow-lg border border-secondary/30" : "text-primary/40 hover:text-primary")}>
                      <span className="material-symbols-outlined text-sm">schedule_send</span>
                      Pendente
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleFinalize}
                  disabled={isProcessing || cart.length === 0}
                  className="w-full py-5 bg-secondary text-primary rounded-2xl font-black text-sm uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-xl shadow-secondary/20 disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? "PROCESSANDO..." : "FINALIZAR VENDA"}
                  <span className="material-symbols-outlined font-black">arrow_forward</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function CloudSync() {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    async function syncData() {
      // 1. Verificar se ja sincronizou para evitar loops
      if (localStorage.getItem("acola_cloud_synced") === "true") return;

      setSyncing(true);
      console.log("Iniciando sincronização com a nuvem...");

      try {
        // --- 1. Sincronizar Insumos ---
        const localInsumos = JSON.parse(localStorage.getItem("acola_insumos") || "[]");
        if (localInsumos.length > 0) {
          const { error } = await supabase.from("insumos").upsert(
            localInsumos.map((i: any) => ({
              nome: i.nome,
              unidade: i.unidade,
              custo_unitario: i.custoUnitario || i.custo_unitario
            }))
          );
          if (error) throw error;
        }

        // --- 2. Sincronizar Estoque (Produtos) ---
        const localEstoque = JSON.parse(localStorage.getItem("acola_estoque") || "[]");
        if (localEstoque.length > 0) {
          const { error } = await supabase.from("products").upsert(
            localEstoque.map((p: any) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              subtype: p.subtype,
              price: p.price,
              cost: p.cost,
              stock: p.stock,
              image: p.image,
              status: p.status
            }))
          );
          if (error) throw error;
        }

        // --- 3. Sincronizar Compras ---
        const localCompras = JSON.parse(localStorage.getItem("acola_compras") || "[]");
        if (localCompras.length > 0) {
          const { error } = await supabase.from("purchases").upsert(
            localCompras.map((c: any) => ({
              item_name: c.itemName || c.item_name,
              quantity: c.quantity,
              unit: c.unit,
              total_price: c.totalPrice || c.total_price,
              date: c.date
            }))
          );
          if (error) throw error;
        }

        // --- 4. Sincronizar Vendas (Orders) ---
        const localVendas = JSON.parse(localStorage.getItem("acola_vendas") || "[]");
        if (localVendas.length > 0) {
          const { error } = await supabase.from("orders").upsert(
            localVendas.map((v: any) => ({
              client_name: v.client?.name || v.client_name,
              client_phone: v.client?.phone || v.client_phone,
              total: v.total,
              payment_status: v.paymentStatus || v.payment_status,
              items: v.items,
              timestamp: v.timestamp
            }))
          );
          if (error) throw error;
        }

        // --- 5. Sincronizar Movimentacoes ---
        const localHist = JSON.parse(localStorage.getItem("acola_historico") || "[]");
        if (localHist.length > 0) {
          const { error } = await supabase.from("inventory_movements").upsert(
            localHist.map((m: any) => ({
              product_id: m.productId || m.product_id,
              product_name: m.productName || m.product_name,
              type: m.type,
              amount: m.amount,
              previous_stock: m.previousStock || m.previous_stock,
              final_stock: m.finalStock || m.final_stock,
              note: m.note,
              timestamp: m.timestamp
            }))
          );
          if (error) throw error;
        }

        // --- 6. Sincronizar Receitas (Fichas Técnicas) ---
        const localReceitas = JSON.parse(localStorage.getItem("acola_receitas") || "{}");
        if (Object.keys(localReceitas).length > 0) {
          for (const [prodId, recipeData] of Object.entries(localReceitas)) {
             await supabase.from("products").update({ recipe: recipeData }).eq("id", prodId);
          }
        }

        // Marcar como sincronizado
        localStorage.setItem("acola_cloud_synced", "true");
        setSynced(true);
        console.log("Sincronização concluída com sucesso!");
        
      } catch (err) {
        console.error("Erro na sincronização:", err);
      } finally {
        setSyncing(false);
      }
    }

    syncData();
  }, []);

  if (syncing) {
    return (
      <div className="fixed bottom-4 left-4 z-[9999] bg-primary text-secondary px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl animate-pulse">
        <span className="material-symbols-outlined text-sm animate-spin">sync</span>
        Sincronizando com a Nuvem...
      </div>
    );
  }

  if (synced) {
    return (
      <div className="fixed bottom-4 left-4 z-[9999] bg-secondary text-primary px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl transition-all duration-1000 opacity-0 hover:opacity-100">
        <span className="material-symbols-outlined text-sm">cloud_done</span>
        Sistema em Nuvem Online
      </div>
    );
  }

  return null;
}

"use client";

import { useEffect } from "react";
import { supabase } from "./supabase";

export function useAutoMigrate() {
  useEffect(() => {
    const runMigrate = async () => {
      // 1. Verifica se já migrou nesta sessão para não repetir
      if (typeof window === "undefined") return;
      const alreadyMigrated = localStorage.getItem("acola_cloud_migrated");
      if (alreadyMigrated === "true") return;

      console.log("Iniciando auto-migração silenciosa...");

      try {
        // 0. Configurações
        const localSettings = JSON.parse(localStorage.getItem("acola_settings") || "{}");
        if (Object.keys(localSettings).length > 0) {
          await supabase.from('app_configs').upsert({
            id: 'global',
            business_name: localSettings.business_name,
            business_slogan: localSettings.business_slogan,
            whatsapp: localSettings.whatsapp,
            markup_base: localSettings.markup,
            taxa_indireta: localSettings.indirect_cost_pct,
            taxa_cartao: localSettings.card_fee_pct,
            categories: localSettings.categories,
            updated_at: new Date().toISOString()
          });
        }

        // 1. Produtos e Receitas
        const localRecipes = JSON.parse(localStorage.getItem("acola_receitas") || "{}");
        const localProducts = JSON.parse(localStorage.getItem("acola_estoque") || "[]");
        if (localProducts.length > 0) {
          const productsPayload = localProducts.map((p: any) => {
            const recipe = localRecipes[p.id] || Object.values(localRecipes).find((r: any) => r.productName === p.name);
            return {
              id: p.id,
              name: p.name,
              category: p.category,
              subtype: p.subtype,
              price: Number(p.sale_price || p.price || 0),
              cost: Number(p.cost || 0),
              stock: Number(p.current_stock || p.stock || 0),
              image: p.image,
              status: 'active',
              recipe: recipe ? { items: recipe.items, rendimento: recipe.rendimento } : null
            };
          });
          await supabase.from('products').upsert(productsPayload);
        }

        // 2. Insumos
        const localInsumos = JSON.parse(localStorage.getItem("acola_insumos") || "[]");
        if (localInsumos.length > 0) {
          await supabase.from('insumos').upsert(
            localInsumos.map((i: any) => ({
              nome: i.name,
              unidade: i.latestUnit || i.baseUnit || 'un',
              custo_unitario: Number(i.pricePerBaseUnit || 0),
              latest_price: Number(i.latestPrice || 0),
              latest_qty: Number(i.latestQty || 0),
              latest_unit: i.latestUnit,
              last_purchase_date: i.lastPurchaseDate
            }))
          );
        }

        // 3. Vendas e Compras (Apenas os últimos 100 para evitar timeout, ou todos se for pequeno)
        const localSales = JSON.parse(localStorage.getItem("acola_vendas") || "[]");
        if (localSales.length > 0) {
          await supabase.from('orders').upsert(
            localSales.map((s: any) => ({
              id: s.id,
              client_name: s.buyerName || s.client_name || 'Cliente Balcão',
              total: Number(s.total || 0),
              payment_status: s.paymentStatus || s.payment_status || 'pago',
              items: s.items || [],
              timestamp: s.timestamp 
            }))
          );
        }

        // Marcar como migrado para não rodar mais
        localStorage.setItem("acola_cloud_migrated", "true");
        console.log("✅ Auto-migração concluída com sucesso.");
        
      } catch (e) {
        console.error("Falha na auto-migração:", e);
      }
    };

    runMigrate();
  }, []);
}

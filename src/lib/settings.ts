import { supabase } from "./supabase";

export interface AppSettings {
  markup: number;
  indirect_cost_pct: number;
  card_fee_pct: number;
  categories: string[];
  base_unit: "g" | "ml" | "un";
  business_name: string;
  business_slogan?: string;
  whatsapp?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  markup: 100,
  indirect_cost_pct: 10,
  card_fee_pct: 5,
  categories: ["Geladinho", "Trufa"],
  base_unit: "g",
  business_name: "Meu Atelier",
  business_slogan: "Doces feitos com amor",
  whatsapp: ""
};

/**
 * Carrega as configurações priorizando Supabase -> LocalStorage -> Defaults
 */
export async function getSettings(): Promise<AppSettings> {
  try {
    // 1. Tenta Supabase
    const { data, error } = await supabase
      .from('app_configs')
      .select('*')
      .eq('id', 'global')
      .single();

    if (data) {
      return {
        markup: data.markup ?? DEFAULT_SETTINGS.markup,
        indirect_cost_pct: data.indirect_cost_pct ?? DEFAULT_SETTINGS.indirect_cost_pct,
        card_fee_pct: data.card_fee_pct ?? DEFAULT_SETTINGS.card_fee_pct,
        categories: data.categories ?? DEFAULT_SETTINGS.categories,
        base_unit: data.base_unit ?? DEFAULT_SETTINGS.base_unit,
        business_name: data.business_name ?? DEFAULT_SETTINGS.business_name,
        business_slogan: data.business_slogan ?? DEFAULT_SETTINGS.business_slogan,
        whatsapp: data.whatsapp ?? DEFAULT_SETTINGS.whatsapp
      };
    }
  } catch (e) {
    console.warn("Erro ao buscar configurações no Supabase, tentando local...");
  }

  // 2. Fallback LocalStorage
  if (typeof window !== "undefined") {
    const local = localStorage.getItem("acola_settings");
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
  }

  return DEFAULT_SETTINGS;
}

/**
 * Salva as configurações em ambos os destinos
 */
export async function saveSettings(settings: AppSettings) {
  if (typeof window !== "undefined") {
    localStorage.setItem("acola_settings", JSON.stringify(settings));
  }

  try {
    await supabase.from('app_configs').upsert({
      id: 'global',
      ...settings,
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Erro ao salvar no Supabase:", e);
  }
}

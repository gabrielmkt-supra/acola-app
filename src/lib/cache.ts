/**
 * Cache inteligente para o Acolá App
 * 
 * Estratégia:
 * - Uma única chave no localStorage: "acola_cache"
 * - O objeto armazena produtos + timestamp de expiração
 * - TTL: 5 minutos (configurável)
 * - Invalidação manual ao salvar/editar produto
 */

const CACHE_KEY = "acola_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface AcolaCache {
  products: any[];
  expiresAt: number;
}

export function getCachedProducts(): any[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cache: AcolaCache = JSON.parse(raw);
    if (Date.now() > cache.expiresAt) {
      localStorage.removeItem(CACHE_KEY); // Cache expirado: limpa
      return null;
    }
    return cache.products;
  } catch {
    return null;
  }
}

export function setCachedProducts(products: any[]): void {
  if (!products || products.length === 0) return; // Nunca grava array vazio
  try {
    const cache: AcolaCache = {
      products,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Em caso de storage cheio, ignora silenciosamente
  }
}

export function invalidateProductsCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

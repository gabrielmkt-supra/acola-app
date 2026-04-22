import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for conditional classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUnitCost(value: number) {
  if (value === 0) return "0,00";
  
  // Padrão de 2 casas decimais para moeda brasileira
  const formatted2 = value.toLocaleString("pt-BR", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  // Se o arredondamento para 2 casas resultar em zero, mas o valor for positivo,
  // ou se o valor for extremamente pequeno, expandimos a precisão para até 4 casas decimais.
  if ((formatted2 === "0,00" || (value > 0 && value < 0.01)) && value > 0) {
    return value.toLocaleString("pt-BR", { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4 
    });
  }
  return formatted2;
}

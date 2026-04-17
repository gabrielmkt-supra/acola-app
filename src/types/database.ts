export interface Product {
  id: string;
  name: string;
  category: 'Trufa' | 'Geladinho' | 'Outro';
  sale_price: number;
  initial_stock: number;
  current_stock: number;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeIngredient {
  id: string;
  product_id: string;
  name: string;
  buy_price: number;
  buy_qty: number;
  recipe_qty: number;
  calculated_cost: number;
  created_at?: string;
}

export type ProductWithRecipe = Product & {
  ingredients: RecipeIngredient[];
};

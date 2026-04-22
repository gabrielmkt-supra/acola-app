
import { supabase } from '../src/lib/supabase';

async function deepClean() {
  const productName = 'Ninho com Nutella';
  console.log(`Iniciando limpeza profunda de: ${productName}`);

  // 1. Achar o ID do produto
  const { data: product, error: pError } = await supabase
    .from('products')
    .select('id')
    .eq('name', productName)
    .single();

  if (pError || !product) {
    console.error('Produto não encontrado ou erro ao buscar:', pError?.message);
    return;
  }

  const productId = product.id;
  console.log(`ID identificado: ${productId}`);

  // 2. Limpar Movimentações de Estoque
  console.log('Limpando movimentações...');
  const { error: mError } = await supabase
    .from('inventory_movements')
    .delete()
    .eq('product_id', productId);
  if (mError) console.error('Erro ao limpar movimentações:', mError.message);

  // 3. Limpar Compras
  console.log('Limpando compras...');
  const { error: cError } = await supabase
    .from('purchases')
    .delete()
    .eq('product_id', productId);
  if (cError) console.error('Erro ao limpar compras:', cError.message);

  // 4. Limpar Vendas (Orders)
  // Como 'items' é um JSONB, precisamos deletar pedidos que contenham esse item
  // Nota: Isso apagará o pedido INTEIRO que contenha este item.
  console.log('Limpando vendas vinculadas...');
  const { data: allOrders } = await supabase.from('orders').select('id, items');
  if (allOrders) {
    for (const order of allOrders) {
      const items = order.items as any[];
      if (items && items.some((item: any) => item.id === productId)) {
        console.log(`Deletando pedido #${order.id} por conter o item.`);
        await supabase.from('orders').delete().eq('id', order.id);
      }
    }
  }

  // 5. Deletar o Produto
  console.log('Deletando o produto definitivamente...');
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (deleteError) {
    console.error('Erro ao deletar produto:', deleteError.message);
  } else {
    console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
  }
}

deepClean();

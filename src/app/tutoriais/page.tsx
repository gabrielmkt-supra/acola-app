"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

const tutoriais = [
  {
    categoria: "Primeiros Passos",
    icon: "rocket_launch",
    videos: [
      {
        id: "t1",
        titulo: "Cadastrando seu primeiro produto",
        descricao: "Aprenda a adicionar produtos ao estoque, configurar preços e calcular custos com ingredientes.",
        duracao: "3:42",
        thumb: "",
        youtubeId: "",
      },
      {
        id: "t2",
        titulo: "Importando sua planilha de estoque",
        descricao: "Veja como exportar do Excel ou Google Sheets e importar todos os seus produtos de uma vez.",
        duracao: "2:15",
        thumb: "",
        youtubeId: "",
      },
    ],
  },
  {
    categoria: "Vendas & PDV",
    icon: "point_of_sale",
    videos: [
      {
        id: "t3",
        titulo: "Realizando uma venda completa",
        descricao: "Do carrinho ao fechamento: como registrar clientes, aplicar pagamento e finalizar pedidos.",
        duracao: "4:10",
        thumb: "",
        youtubeId: "",
      },
      {
        id: "t4",
        titulo: "Combo promocional: 2 Premium + 1 Clássico",
        descricao: "Entenda como o sistema detecta o combo e aplica o desconto de R$24,90 automaticamente.",
        duracao: "1:58",
        thumb: "",
        youtubeId: "",
      },
    ],
  },
  {
    categoria: "Controle Financeiro",
    icon: "query_stats",
    videos: [
      {
        id: "t5",
        titulo: "Entendendo o Fluxo de Caixa",
        descricao: "Como interpretar entradas, saídas e o saldo do seu caixa em tempo real.",
        duracao: "5:00",
        thumb: "",
        youtubeId: "",
      },
      {
        id: "t6",
        titulo: "Registrando compras de ingredientes",
        descricao: "Mantenha o custo dos seus insumos atualizado e acompanhe seus gastos mensais.",
        duracao: "2:40",
        thumb: "",
        youtubeId: "",
      },
    ],
  },
];

export default function Tutoriais() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = tutoriais.map(cat => ({
    ...cat,
    videos: cat.videos.filter(v =>
      v.titulo.toLowerCase().includes(search.toLowerCase()) ||
      v.descricao.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.videos.length > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-8 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-10">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-1">Central de Aprendizado</p>
              <h1 className="text-4xl font-black text-primary uppercase italic tracking-tight leading-none">
                Tutoriais
              </h1>
              <p className="text-sm text-primary/50 font-medium mt-2">
                Aprenda a usar cada funcionalidade da Acolá no seu ritmo.
              </p>
            </div>

            {/* Busca */}
            <div className="relative w-full md:w-64 shrink-0">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 text-lg">search</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar tutorial..."
                className="w-full pl-11 pr-4 py-3 bg-surface border border-primary/5 rounded-2xl text-sm font-bold text-primary placeholder-primary/20 focus:outline-none focus:ring-2 focus:ring-secondary/40 transition-all"
              />
            </div>
          </div>

          {/* Stats rápidos */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total de Vídeos", value: tutoriais.reduce((a, c) => a + c.videos.length, 0).toString().padStart(2, "0"), icon: "play_circle" },
              { label: "Categorias",       value: tutoriais.length.toString().padStart(2, "0"),                                  icon: "folder_open" },
              { label: "Tempo Estimado",   value: "~24 min",                                                                      icon: "schedule" },
            ].map(s => (
              <div key={s.label} className="bg-surface rounded-2xl p-5 border border-primary/5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">{s.icon}</span>
                </div>
                <div>
                  <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest">{s.label}</p>
                  <p className="text-xl font-black text-primary">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Grid de categorias + vídeos */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-primary/20 gap-4">
              <span className="material-symbols-outlined text-6xl">search_off</span>
              <p className="font-black uppercase tracking-widest text-sm">Nenhum tutorial encontrado</p>
            </div>
          ) : (
            filtered.map((cat, catIdx) => (
              <motion.section
                key={cat.categoria}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: catIdx * 0.08 }}
                className="flex flex-col gap-4"
              >
                {/* Cabeçalho da categoria */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                    <span className="material-symbols-outlined text-base">{cat.icon}</span>
                  </div>
                  <h2 className="text-xs font-black text-primary uppercase tracking-[0.2em]">{cat.categoria}</h2>
                  <div className="flex-1 h-px bg-primary/5" />
                  <span className="text-[9px] font-black text-primary/25 uppercase tracking-widest">{cat.videos.length} vídeo{cat.videos.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Cards de vídeo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cat.videos.map((video, vIdx) => (
                    <motion.div
                      key={video.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: catIdx * 0.08 + vIdx * 0.05 }}
                      className="group bg-surface border border-primary/5 rounded-2xl overflow-hidden hover:border-secondary/30 hover:shadow-lg transition-all duration-300"
                    >
                      {/* Thumbnail / Player */}
                      <div
                        className="relative w-full aspect-video bg-surface-variant flex items-center justify-center cursor-pointer overflow-hidden"
                        onClick={() => setActiveVideo(activeVideo === video.id ? null : video.id)}
                      >
                        {/* Gradiente de fundo */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/10" />

                        {video.youtubeId ? (
                          activeVideo === video.id ? (
                            <iframe
                              className="absolute inset-0 w-full h-full"
                              src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
                              allow="autoplay; encrypted-media"
                              allowFullScreen
                            />
                          ) : (
                            <img
                              src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                              className="absolute inset-0 w-full h-full object-cover"
                              alt={video.titulo}
                            />
                          )
                        ) : (
                          /* Placeholder quando ainda não tem vídeo */
                          <div className="relative z-10 flex flex-col items-center gap-2 text-primary/20 select-none">
                            <span className="material-symbols-outlined text-5xl group-hover:text-secondary/60 transition-colors">smart_display</span>
                            <p className="text-[9px] font-black uppercase tracking-widest">Em breve</p>
                          </div>
                        )}

                        {/* Botão de play overlay */}
                        {video.youtubeId && activeVideo !== video.id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-all">
                            <div className="w-14 h-14 rounded-full bg-secondary/90 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                            </div>
                          </div>
                        )}

                        {/* Badge de duração */}
                        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black px-2 py-1 rounded-md tracking-widest">
                          {video.duracao}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-5">
                        <h3 className="font-black text-primary text-sm leading-snug mb-1">{video.titulo}</h3>
                        <p className="text-[10px] text-primary/50 font-medium leading-relaxed">{video.descricao}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            ))
          )}

          {/* Rodapé de suporte */}
          <div className="bg-surface border border-primary/5 rounded-2xl p-6 flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">support_agent</span>
            </div>
            <div className="flex-1">
              <p className="font-black text-primary text-sm">Não encontrou o que precisava?</p>
              <p className="text-[10px] text-primary/50 font-medium mt-0.5">Entre em contato com o suporte da Acolá para ajuda personalizada.</p>
            </div>
            <div className="text-[9px] font-black text-secondary uppercase tracking-widest">Em breve →</div>
          </div>

        </div>
      </div>
    </div>
  );
}

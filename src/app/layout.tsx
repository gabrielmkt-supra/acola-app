import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Acolá - Gestão Inteligente de Alimentos",
  description: "Sistema inteligente para gestão de estoque, vendas e produção de geladinhos e trufas.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Acolá Gestão",
  },
};

export const viewport: Viewport = {
  themeColor: "#35160d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { CloudSync } from "@/components/CloudSync";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('acola_theme') || 'light';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=account_balance_wallet,add_box,arrow_back,arrow_forward,assignment,check,check_circle,close,cloud_done,delete,edit,edit_square,inventory_2,keyboard_arrow_down,local_offer,menu_book,payments,post_add,query_stats,receipt_long,schedule_send,shopping_basket,shopping_cart,smart_display,swap_horiz,sync,trending_up,upload,upload_file,warning"
        />
      </head>
      <body className="min-h-full flex bg-background text-primary font-sans overflow-hidden transition-colors duration-300">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen transition-all duration-300 bg-surface rounded-tl-[40px] shadow-2xl my-2 mr-2 overflow-hidden border-l border-t border-primary/5">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <CloudSync />
      </body>
    </html>
  );
}

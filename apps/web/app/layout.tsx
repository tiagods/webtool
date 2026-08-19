import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import TermoCienciaModal from "@/components/TermoCienciaModal";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Prolink Contábil | Ficha Cadastral Digital",
  description: "Ficha cadastral digital para abertura e alteração de empresas.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const mostrarTermo = headersList.get("x-aceite-pendente") === "1";

  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        {mostrarTermo && <TermoCienciaModal />}
      </body>
    </html>
  );
}

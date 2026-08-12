import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monitor ENSO — Pacífico equatorial",
  description:
    "SST e anomalias das regiões Niño, com o ONI oficial da NOAA CPC. Dado com fonte, data de observação e horário de coleta.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

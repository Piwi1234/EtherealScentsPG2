import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Historias de perfumes y casas | Ethereal Scents",
  description: "Casas, perfumistas, ingredientes y fragancias icónicas: las historias detrás de los perfumes. Ethereal Scents.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

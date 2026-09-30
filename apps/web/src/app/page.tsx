import { permanentRedirect } from "next/navigation";

// La landing page vive en /home (apps/web/src/app/home/page.tsx) — esto solo reenvía el dominio
// pelado ahí, para que la URL visible siempre sea "/home". Permanente (308, no 307): así Google no
// se queda dudando entre indexar "/" o "/home" por separado — ver sitemap.ts, que apunta a /home.
export default function RootPage() {
  permanentRedirect("/home");
}

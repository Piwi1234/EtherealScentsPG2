import { redirect } from "next/navigation";

// La landing page vive en /home (apps/web/src/app/home/page.tsx) — esto solo reenvía el dominio
// pelado ahí, para que la URL visible siempre sea "/home".
export default function RootPage() {
  redirect("/home");
}

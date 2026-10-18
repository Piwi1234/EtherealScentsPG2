import { getLandingImages } from "../../lib/api";
import { HomeClient } from "./HomeClient";

// Server Component a propósito (sin "use client") — trae las imágenes del Hero/Colección de la
// semana ANTES de mandar el HTML, así la URL real de la imagen del Hero (el elemento LCP del sitio,
// ver HomeClient.tsx) ya está en el HTML inicial en vez de aparecer recién después de hidratar y
// pedirla por useEffect. El resto de los datos de la página (categorías, marcas, ofertas, etc.)
// sigue armándose en el cliente como antes — solo esto importaba para el LCP.
export default async function HomePage() {
  const landingImages = await getLandingImages().catch(() => null);
  return <HomeClient initialLandingImages={landingImages} />;
}

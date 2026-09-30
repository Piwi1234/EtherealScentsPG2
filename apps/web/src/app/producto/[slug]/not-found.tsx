import Link from "next/link";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";

/** Se renderiza automáticamente cuando page.tsx llama a notFound() — a diferencia del branch
 * inline que tenía la versión "use client" anterior, esto sí devuelve un 404 HTTP real. */
export default function ProductoNotFound() {
  return (
    <div className="landing-page landing-product-page">
      <LandingNavbar variant="dark" />
      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-category-lead" style={{ margin: 0 }}>
            Producto no encontrado. <Link href="/home">Volvé al inicio</Link>.
          </p>
        </div>
      </div>
      <LandingFooter />
    </div>
  );
}

import type { MetadataRoute } from "next";

const SITE_ORIGIN = "https://www.etherealscents-bo.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Panel interno y flujos de cuenta/autenticación — nada de esto es contenido para buscar.
      disallow: [
        "/dashboard",
        "/cuenta",
        "/login",
        "/ingresar",
        "/registro",
        "/olvide-contrasena",
        "/restablecer-contrasena",
      ],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}

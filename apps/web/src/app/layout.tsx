import "./globals.css";

export const metadata = {
  title: "Nuevo Proyecto",
  description: "Esqueleto técnico: monorepo pnpm + Turborepo, NestJS, Next.js, Prisma.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

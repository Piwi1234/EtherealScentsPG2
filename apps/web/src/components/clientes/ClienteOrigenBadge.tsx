import type { OrigenCliente } from "../../lib/types";

export function ClienteOrigenBadge({ origen }: { origen: OrigenCliente }) {
  return (
    <span className={`badge${origen === "WEB" ? " badge-accent" : " badge-muted"}`}>
      {origen === "WEB" ? "Web" : "Manual"}
    </span>
  );
}

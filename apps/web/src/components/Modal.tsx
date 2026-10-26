"use client";

export function Modal({
  title,
  onClose,
  children,
  maxWidth,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Ancho máximo en px (por defecto 480, el del .modal-panel) — para modales con filas de varios datos. */
  maxWidth?: number;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={maxWidth ? { maxWidth } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button type="button" className="link-button" onClick={onClose}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

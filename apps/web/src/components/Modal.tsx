"use client";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button type="button" className="link-button" onClick={onClose}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

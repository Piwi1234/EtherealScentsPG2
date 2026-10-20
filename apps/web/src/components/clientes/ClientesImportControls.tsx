"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, downloadClientesImportTemplate, importClientesFromFile } from "../../lib/api";
import type { ClienteImportReport } from "../../lib/types";
import { Modal } from "../Modal";

/** "Descargar plantilla" / "Importar clientes" — mismo patrón que el bloque equivalente de
 * dashboard/brands/page.tsx, adaptado a que /dashboard/clientes es un Server Component que pagina
 * vía searchParams: en vez de un loadClientes() local, usa router.refresh() tras una importación sin
 * errores (mismo recurso que ya usa ClienteAcciones.tsx para refrescar esta misma lista). */
export function ClientesImportControls() {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ClienteImportReport | null>(null);
  const [importReportError, setImportReportError] = useState("");

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    try {
      await downloadClientesImportTemplate();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportReportError("");
    setImportReport(null);
    try {
      const report = await importClientesFromFile(file);
      setImportReport(report);
      if (report.errors.length === 0) router.refresh();
    } catch (e) {
      setImportReportError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button type="button" className="action-btn" onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
        {downloadingTemplate ? "Descargando..." : "Descargar plantilla"}
      </button>
      <button type="button" className="action-btn" onClick={() => importInputRef.current?.click()} disabled={importing}>
        {importing ? "Importando..." : "Importar clientes"}
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleImportFile(file);
        }}
      />
      {importReportError && <p className="error-text">{importReportError}</p>}

      {importReport && (
        <Modal title="Resultado de la importación" onClose={() => setImportReport(null)}>
          {importReport.errors.length === 0 ? (
            <p>
              Listo: {importReport.created} cliente{importReport.created === 1 ? "" : "s"} creado
              {importReport.created === 1 ? "" : "s"} y {importReport.updated} actualizado
              {importReport.updated === 1 ? "" : "s"}.
            </p>
          ) : (
            <>
              <p className="error-text">
                No se importó nada — hay {importReport.errors.length} error{importReport.errors.length === 1 ? "" : "es"} en la
                planilla. Corregilos y volvé a subir el archivo.
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {importReport.errors.map((err, i) => (
                  <li key={i}>
                    Fila {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="form-actions">
            <button type="button" className="button" onClick={() => setImportReport(null)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

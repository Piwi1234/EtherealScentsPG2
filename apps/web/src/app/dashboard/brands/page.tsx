"use client";

import { useRef, useEffect, useState } from "react";
import {
  API_ORIGIN,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiUpload,
  ApiError,
  downloadBrandsImportTemplate,
  importBrandsFromFile,
} from "../../../lib/api";
import type { Brand, BrandImportReport, Category } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

// Marcas sembradas antes de este cambio podrían tener logoUrl absoluto; los subidos desde acá en
// adelante son siempre relativos ("/uploads/brands/...").
function logoSrc(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  return logoUrl.startsWith("http") ? logoUrl : `${API_ORIGIN}${logoUrl}`;
}

const PAGE_SIZE = 20;

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importReport, setImportReport] = useState<BrandImportReport | null>(null);
  const [importReportError, setImportReportError] = useState("");

  function handleLogoSelect(file: File | null, currentLogoUrl: string | null) {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : logoSrc(currentLogoUrl));
  }

  function loadBrands() {
    apiGet<Brand[]>("/brands")
      .then(setBrands)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    loadBrands();
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setCategoryIds(new Set());
    setLogoFile(null);
    setLogoPreview(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setName(brand.name);
    setCategoryIds(new Set(brand.categories.map((c) => c.categoryId)));
    setLogoFile(null);
    setLogoPreview(logoSrc(brand.logoUrl));
    setFormError("");
    setModalOpen(true);
  }

  // Una marca solo se asigna a subcategorías, no a categorías raíz; se agrupan por su categoría padre.
  const parentNameById = new Map(categories.map((cat) => [cat.id, cat.name]));
  const subcategoryGroups = Array.from(
    categories
      .filter((cat) => cat.parentId !== null)
      .reduce<Map<string, Category[]>>((groups, cat) => {
        const parentId = cat.parentId as string;
        const list = groups.get(parentId) ?? [];
        list.push(cat);
        groups.set(parentId, list);
        return groups;
      }, new Map())
      .entries(),
  )
    .map(([parentId, subs]) => ({ parentId, parentName: parentNameById.get(parentId) ?? "Otra", subs }))
    .sort((a, b) => a.parentName.localeCompare(b.parentName));

  const filteredBrands = (brands ?? []).filter((brand) =>
    brand.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedBrands = filteredBrands.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggleCategory(id: string) {
    setCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    try {
      await downloadBrandsImportTemplate();
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
      const report = await importBrandsFromFile(file);
      setImportReport(report);
      if (report.errors.length === 0) loadBrands();
    } catch (e) {
      setImportReportError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(brand: Brand) {
    if (!confirm(`¿Eliminar la marca "${brand.name}"?`)) return;
    try {
      await apiDelete(`/brands/${brand.id}`);
      loadBrands();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const payload = { name, categoryIds: Array.from(categoryIds) };
      const saved = editing ? await apiPatch<Brand>(`/brands/${editing.id}`, payload) : await apiPost<Brand>("/brands", payload);
      if (logoFile) {
        await apiUpload(`/brands/${saved.id}/logo`, logoFile);
      }
      setModalOpen(false);
      loadBrands();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Marcas</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="action-btn" onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
            {downloadingTemplate ? "Descargando..." : "Descargar plantilla"}
          </button>
          <button type="button" className="action-btn" onClick={() => importInputRef.current?.click()} disabled={importing}>
            {importing ? "Importando..." : "Importar marcas"}
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
          <button type="button" className="btn-cta" onClick={openCreate}>
            <span className="btn-cta-icon">+</span> Nueva marca
          </button>
        </div>
      </div>
      {importReportError && <p className="error-text">{importReportError}</p>}
      {error && <p className="error-text">{error}</p>}
      {!brands && !error && <p>Cargando...</p>}
      {brands && brands.length === 0 && <p>No hay marcas todavía.</p>}
      {brands && brands.length > 0 && (
        <div className="filters-bar" style={{ marginBottom: 16 }}>
          <div className="filter-field" style={{ minWidth: 240, flex: 1 }}>
            <label className="filter-label">Buscar por nombre</label>
            <input
              className="field"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Nombre de la marca"
            />
          </div>
        </div>
      )}
      {brands && brands.length > 0 && filteredBrands.length === 0 && <p>Ninguna marca coincide con "{search}".</p>}
      {brands && filteredBrands.length > 0 && (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Nombre</th>
              <th>Subcategorías asignadas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedBrands.map((brand) => (
              <tr key={brand.id}>
                <td>
                  {logoSrc(brand.logoUrl) ? (
                    <img src={logoSrc(brand.logoUrl)!} alt={brand.name} style={{ width: 32, height: 32, objectFit: "contain" }} />
                  ) : (
                    <span className="cell-muted">—</span>
                  )}
                </td>
                <td className="cell-primary">{brand.name}</td>
                <td>
                  {brand.categories.length === 0
                    ? <span className="cell-muted">—</span>
                    : brand.categories.map((c) => (
                        <span key={c.categoryId} className="badge">{c.category.name}</span>
                      ))}
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="action-btn" onClick={() => openEdit(brand)}>Editar</button>
                    <button type="button" className="action-btn danger" onClick={() => handleDelete(brand)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className={`pagination-btn${currentPage <= 1 ? " disabled" : ""}`}
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ← Anterior
          </button>
          <span className="pagination-info">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className={`pagination-btn${currentPage >= totalPages ? " disabled" : ""}`}
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? "Editar marca" : "Nueva marca"} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label>Logo (opcional)</label>
              <div className="image-uploader">
                {logoPreview ? (
                  <img src={logoPreview} alt="Vista previa" />
                ) : (
                  <div className="image-uploader-placeholder">Sin logo</div>
                )}
                <input
                  className="field"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => handleLogoSelect(e.target.files?.[0] ?? null, editing?.logoUrl ?? null)}
                  style={{ background: "transparent", border: 0, padding: 0 }}
                />
              </div>
            </div>
            <div>
              <label>Subcategorías</label>
              <div className="checkbox-list">
                {subcategoryGroups.length === 0 && (
                  <span style={{ color: "var(--muted)" }}>No hay subcategorías creadas todavía.</span>
                )}
                {subcategoryGroups.map((group) => (
                  <div key={group.parentId} className="checkbox-group">
                    <div className="checkbox-group-title">{group.parentName}</div>
                    <div className="checkbox-group-items">
                      {group.subs.map((cat) => (
                        <label key={cat.id} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={categoryIds.has(cat.id)}
                            onChange={() => toggleCategory(cat.id)}
                          />
                          {cat.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {importReport && (
        <Modal title="Resultado de la importación" onClose={() => setImportReport(null)}>
          {importReport.errors.length === 0 ? (
            <p>
              Listo: {importReport.created} marca{importReport.created === 1 ? "" : "s"} creada
              {importReport.created === 1 ? "" : "s"} y {importReport.updated} actualizada
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
    </div>
  );
}

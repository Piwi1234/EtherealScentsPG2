"use client";

import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../../lib/api";
import type { CategoryTreeNode } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

type FlatOption = { id: string; label: string };

function flatten(nodes: CategoryTreeNode[], depth = 0): FlatOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.name}` },
    ...flatten(node.children, depth + 1),
  ]);
}

function descendantIds(node: CategoryTreeNode): string[] {
  return [node.id, ...node.children.flatMap(descendantIds)];
}

function CostChips({ node }: { node: CategoryTreeNode }) {
  if (!node.parentId) return <span className="cell-muted">—</span>;
  const costs = [
    { label: "Log", value: node.logisticsCost },
    { label: "Envío", value: node.shippingCost },
    { label: "Seg", value: node.securityCost },
  ].filter((c) => c.value !== null);
  if (costs.length === 0) return <span className="cell-muted">—</span>;
  return (
    <div className="cost-chip-row">
      {costs.map((c) => (
        <span key={c.label} className="cost-chip">
          <span className="cost-chip-label">{c.label}</span>
          <span className="cost-chip-value">${c.value}</span>
        </span>
      ))}
    </div>
  );
}

function CategoryRow({
  node,
  depth,
  onEdit,
  onDelete,
}: {
  node: CategoryTreeNode;
  depth: number;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
}) {
  return (
    <>
      <tr>
        <td className="cell-primary" style={{ paddingLeft: depth * 24 }}>{depth > 0 ? "↳ " : ""}{node.name}</td>
        <td className="cell-code">{node.slug}</td>
        <td>{node.children.length}</td>
        <td><CostChips node={node} /></td>
        <td>
          <div className="row-actions">
            <button type="button" className="action-btn" onClick={() => onEdit(node)}>Editar</button>
            <button type="button" className="action-btn danger" onClick={() => onDelete(node)}>Eliminar</button>
          </div>
        </td>
      </tr>
      {node.children.map((child) => (
        <CategoryRow key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

export default function CategoriesPage() {
  const [tree, setTree] = useState<CategoryTreeNode[] | null>(null);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryTreeNode | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [logisticsCost, setLogisticsCost] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [securityCost, setSecurityCost] = useState("");
  const [comentario, setComentario] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadTree() {
    apiGet<CategoryTreeNode[]>("/categories?tree=true")
      .then(setTree)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(loadTree, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setParentId("");
    setLogisticsCost("");
    setShippingCost("");
    setSecurityCost("");
    setComentario("");
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(node: CategoryTreeNode) {
    setEditing(node);
    setName(node.name);
    setParentId(node.parentId ?? "");
    setLogisticsCost(node.logisticsCost ?? "");
    setShippingCost(node.shippingCost ?? "");
    setSecurityCost(node.securityCost ?? "");
    setComentario(node.comentario ?? "");
    setFormError("");
    setModalOpen(true);
  }

  async function handleDelete(node: CategoryTreeNode) {
    if (!confirm(`¿Eliminar la categoría "${node.name}"?`)) return;
    try {
      await apiDelete(`/categories/${node.id}`);
      loadTree();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  function parseCost(value: string): number | undefined {
    return value.trim() === "" ? undefined : Number(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      // Los costos solo aplican a subcategorías (con padre elegido en el formulario); el comentario
      // es al revés, solo aplica a categorías raíz (sin padre).
      const costs = parentId
        ? {
            logisticsCost: parseCost(logisticsCost),
            shippingCost: parseCost(shippingCost),
            securityCost: parseCost(securityCost),
          }
        : {};
      const comentarioField = parentId ? {} : { comentario: comentario.trim() || null };
      const payload = { name, parentId: parentId || undefined, ...costs, ...comentarioField };
      if (editing) {
        await apiPatch(`/categories/${editing.id}`, { ...payload, parentId: parentId || null });
      } else {
        await apiPost("/categories", payload);
      }
      setModalOpen(false);
      loadTree();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function handleParentChange(value: string) {
    setParentId(value);
    if (!value) {
      setLogisticsCost("");
      setShippingCost("");
      setSecurityCost("");
    } else {
      setComentario("");
    }
  }

  const excluded = editing ? new Set(descendantIds(editing)) : new Set<string>();
  const parentOptions = tree ? flatten(tree).filter((opt) => !excluded.has(opt.id)) : [];

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Categorías</h1>
        <button type="button" className="btn-cta" onClick={openCreate}>
          <span className="btn-cta-icon">+</span> Nueva categoría
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!tree && !error && <p>Cargando...</p>}
      {tree && tree.length === 0 && <p>No hay categorías todavía.</p>}
      {tree && tree.length > 0 && (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Subcategorías</th>
              <th>Costos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tree.map((node) => (
              <CategoryRow key={node.id} node={node} depth={0} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal title={editing ? "Editar categoría" : "Nueva categoría"} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label>Categoría padre</label>
              <select className="field" value={parentId} onChange={(e) => handleParentChange(e.target.value)}>
                <option value="">— Sin padre —</option>
                {parentOptions
                  .filter((opt) => !editing || opt.id !== editing.id)
                  .map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
              </select>
            </div>
            {!parentId && (
              <div>
                <label>Comentario (opcional)</label>
                <textarea
                  className="field"
                  rows={3}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              </div>
            )}
            {parentId && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <label style={{ display: "block", marginBottom: 8 }}>
                  Costos heredados por los productos de esta subcategoría
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: "var(--muted)" }}>Logística</label>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="0.01"
                      value={logisticsCost}
                      onChange={(e) => setLogisticsCost(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: "var(--muted)" }}>Envío</label>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="0.01"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: "var(--muted)" }}>Seguridad</label>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="0.01"
                      value={securityCost}
                      onChange={(e) => setSecurityCost(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
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
    </div>
  );
}

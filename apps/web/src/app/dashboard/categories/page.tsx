"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../lib/api";
import type { CategoryTreeNode } from "../../../lib/types";

function CategoryRow({ node, depth }: { node: CategoryTreeNode; depth: number }) {
  return (
    <>
      <tr>
        <td style={{ paddingLeft: depth * 24 }}>{depth > 0 ? "↳ " : ""}{node.name}</td>
        <td>{node.slug}</td>
        <td>{node.children.length}</td>
      </tr>
      {node.children.map((child) => (
        <CategoryRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default function CategoriesPage() {
  const [tree, setTree] = useState<CategoryTreeNode[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<CategoryTreeNode[]>("/categories?tree=true")
      .then(setTree)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Categorías</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!tree && !error && <p>Cargando...</p>}
      {tree && tree.length === 0 && <p>No hay categorías todavía.</p>}
      {tree && tree.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Subcategorías</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((node) => (
              <CategoryRow key={node.id} node={node} depth={0} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

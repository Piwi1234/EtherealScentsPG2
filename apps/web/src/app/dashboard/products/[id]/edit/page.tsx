"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, ApiError } from "../../../../../lib/api";
import type { Product } from "../../../../../lib/types";
import { ProductForm } from "../../ProductForm";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Product>(`/products/${id}`)
      .then(setProduct)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
        <button type="button" className="link-button" onClick={() => router.push("/dashboard/products")}>
          Volver
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="card">
        <p>Cargando...</p>
      </div>
    );
  }

  return <ProductForm key={product.id} initialProduct={product} />;
}

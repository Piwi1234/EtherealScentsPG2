"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  // productId + variantId (o "base" si el producto no tiene variantes con precio propio) — identifica
  // la línea de forma única para poder acumular cantidad al agregar el mismo producto/variante de nuevo.
  key: string;
  productId: string;
  productSlug: string;
  variantId: string | null;
  name: string;
  code: string;
  // "Val1, Val2" de los atributos mostrarEnProforma=true — mismo criterio que la ficha del producto
  // en una proforma (ver formatAtributosVisiblesValores). Vacío si el producto no tiene ninguno.
  atributos: string;
  imageUrl: string | null;
  unitPriceBs: number;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  totalItems: number;
  totalBs: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "ethereal-scents-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  // Evita pisar localStorage con [] durante el primer render (antes de leerlo) — solo se persiste
  // después de que la carga inicial ya corrió.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // localStorage no disponible (ej. modo privado) — el carrito simplemente no persiste.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ídem arriba.
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.key === item.key);
      if (existing) return prev.map((i) => (i.key === item.key ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { ...item, qty }];
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, qty } : i))));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const totalBs = useMemo(() => items.reduce((sum, i) => sum + i.unitPriceBs * i.qty, 0), [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      addItem,
      removeItem,
      setQty,
      clear,
      totalItems,
      totalBs,
    }),
    [items, isOpen, addItem, removeItem, setQty, clear, totalItems, totalBs],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}

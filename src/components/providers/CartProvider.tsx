"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import useSWR, { mutate } from "swr";

export interface CartItem {
  id: number | string; // DB id (number) or local id (string) for guest
  planId: string;
  planName: string;
  price: number;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id">) => Promise<void>;
  removeItem: (id: number | string) => Promise<void>;
  updateQuantity: (id: number | string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  total: number;
  isLoading: boolean;
  isSyncing: boolean;
  isProcessing: boolean; // Đang thực hiện action (add/update/remove/clear)
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const EMPTY_CART: CartItem[] = [];

// SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [localItems, setLocalItems] = useState<CartItem[]>(EMPTY_CART);
  const [mounted, setMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load từ localStorage khi mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cart");
      if (saved) {
        setLocalItems(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  // Save localStorage khi localItems thay đổi (chỉ cho guest)
  useEffect(() => {
    if (mounted && !user) {
      localStorage.setItem("cart", JSON.stringify(localItems));
    }
  }, [localItems, mounted, user]);

  // SWR cho cart từ server (chỉ khi user đã login)
  const { data: serverData, mutate: mutateServerCart, error } = useSWR<{ cartItems: CartItem[] }>(
    user ? "/api/cart" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Items hiển thị: memoize để tránh re-render không cần thiết
  const items = useMemo(() => 
    user ? (serverData?.cartItems || []) : localItems,
    [user, serverData, localItems]
  );

  // Tổng tiền
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Sync localStorage → server khi user vừa login
  useEffect(() => {
    if (user && mounted && localItems.length > 0) {
      syncLocalToServer();
    }
  }, [user]); // Chỉ chạy khi user thay đổi (cố ý)

  const syncLocalToServer = useCallback(async () => {
    if (localItems.length === 0) return;
    setIsSyncing(true);
    try {
      // Lấy cart hiện tại từ server để merge (fetch trực tiếp để tránh stale data)
      const syncRes = await fetch("/api/cart");
      const data = await syncRes.json() as { cartItems: CartItem[] };
      const currentServerItems = data.cartItems;

      const serverMap = new Map<string, CartItem>(currentServerItems.map((item: CartItem) => [item.planId, item]));

      // Merge: với mỗi local item
      const promises = localItems.map(async (localItem) => {
        const serverItem = serverMap.get(localItem.planId);
        if (serverItem) {
          // Cộng quantity
          const newQty = serverItem.quantity + localItem.quantity;
          return fetch(`/api/cart/${serverItem.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: newQty }),
          });
        } else {
          // Thêm mới
          return fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId: localItem.planId,
              planName: localItem.planName,
              price: localItem.price,
              quantity: localItem.quantity,
            }),
          });
        }
      });

      await Promise.all(promises);
      // Clear localStorage sau khi sync thành công
      localStorage.removeItem("cart");
      setLocalItems([]);
      // Refetch server cart để cập nhật SWR cache
      await mutateServerCart();
    } catch (error) {
      console.error("Sync cart failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [localItems, mutateServerCart]);

  // Optimistic remove (phải khai báo trước vì updateQuantity dùng nó)
  const removeItem = useCallback(async (id: number | string) => {
    setIsProcessing(true);
    try {
      if (!user) {
        setLocalItems(prev => prev.filter(i => i.id !== id));
        return;
      }

      // Optimistic
      mutateServerCart(
        (current) => {
          const cartItems = current?.cartItems || [];
          return { cartItems: cartItems.filter(i => i.id !== id) };
        },
        false
      );

      const res = await fetch(`/api/cart/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      await mutateServerCart();
    } catch (error) {
      console.error("Remove item failed:", error);
      await mutateServerCart();
    } finally {
      setIsProcessing(false);
    }
  }, [user, mutateServerCart]);

  // Optimistic add
  const addItem = useCallback(async (item: Omit<CartItem, "id">) => {
    setIsProcessing(true);
    try {
      if (!user) {
        // Guest: chỉ update local
        setLocalItems(prev => {
          const existing = prev.find(i => i.planId === item.planId);
          if (existing) {
            return prev.map(i => i.planId === item.planId ? { ...i, quantity: i.quantity + item.quantity } : i);
          }
          return [...prev, { ...item, id: `local-${Date.now()}` }];
        });
        return;
      }

      // User logged in: gọi API với optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticItem: CartItem = { ...item, id: tempId };
      
      // Optimistically update UI
      mutateServerCart(
        (current) => {
          const cartItems = current?.cartItems || [];
          const existing = cartItems.find(i => i.planId === item.planId);
          if (existing) {
            return {
              cartItems: cartItems.map(i =>
                i.planId === item.planId ? { ...i, quantity: i.quantity + item.quantity } : i
              )
            };
          } else {
            return { cartItems: [...cartItems, optimisticItem] };
          }
        },
        false
      );

      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error("Failed");
      // Refetch để có ID thật từ DB
      await mutateServerCart();
    } catch (error) {
      console.error("Add item failed:", error);
      // Rollback
      await mutateServerCart();
    } finally {
      setIsProcessing(false);
    }
  }, [user, mutateServerCart]);

  // Optimistic update quantity
  const updateQuantity = useCallback(async (id: number | string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(id);
      return;
    }

    setIsProcessing(true);
    try {
      if (!user) {
        setLocalItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
        return;
      }

      // Optimistic
      mutateServerCart(
        (current) => {
          const cartItems = current?.cartItems || [];
          return {
            cartItems: cartItems.map(i => i.id === id ? { ...i, quantity } : i)
          };
        },
        false
      );

      const res = await fetch(`/api/cart/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) throw new Error("Failed");
      await mutateServerCart();
    } catch (error) {
      console.error("Update quantity failed:", error);
      await mutateServerCart();
    } finally {
      setIsProcessing(false);
    }
  }, [user, mutateServerCart, removeItem]);

  // Clear cart
  const clearCart = useCallback(async () => {
    setIsProcessing(true);
    try {
      if (!user) {
        setLocalItems([]);
        localStorage.removeItem("cart");
        return;
      }

      // Optimistic: clear all
      mutateServerCart({ cartItems: [] }, false);

      // Delete all items one by one
      const promises = items.map(item => 
        fetch(`/api/cart/${item.id}`, { method: "DELETE" })
      );
      await Promise.all(promises);
      await mutateServerCart();
    } catch (error) {
      console.error("Clear cart failed:", error);
      await mutateServerCart();
    } finally {
      setIsProcessing(false);
    }
  }, [user, items, mutateServerCart]);

  const value: CartContextType = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    isLoading: !user ? false : !serverData && !error,
    isSyncing,
    isProcessing,
  };

  // Không render children cho đến khi mounted (tránh hydration mismatch)
  if (!mounted) {
    return null;
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}

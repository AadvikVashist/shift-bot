import { useCallback, useEffect, useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

export interface Engineer {
  id: string;
  name: string | null;
  email: string | null;
  is_on_call: boolean;
  active: boolean;
}

interface UseEngineersResult {
  engineers: Engineer[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleOnCall: (id: string, is_on_call: boolean) => Promise<void>;
  toggleActive: (id: string, active: boolean) => Promise<void>;
}

export function useEngineers(): UseEngineersResult {
  const { token } = useSupabaseAuth();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Determine the REST API base URL. When deploying the dashboard alongside the
  // backend the env var can be omitted and we'll fallback to the browser
  // origin.  In local development, however, the dashboard usually runs on
  // http://localhost:3000 while the Express backend listens on 3001, so we
  // provide that as a sensible default.
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  const fetchEngineers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/engineers`, {
        headers: {
          "x-auth-token": token,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch engineers: ${res.status}`);
      }
      const json = await res.json();
      setEngineers(json.engineers ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token, API_BASE]);

  useEffect(() => {
    void fetchEngineers();
  }, [fetchEngineers]);

  const toggleOnCall = useCallback(
    async (id: string, desired: boolean) => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/engineers/${id}/on_call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-auth-token": token,
          },
          body: JSON.stringify({ is_on_call: desired }),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        // Optimistically update local state
        setEngineers((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, is_on_call: desired } : e,
          ),
        );
      } catch (err) {
        console.error("Failed to toggle on_call", err);
        await fetchEngineers();
      }
    },
    [token, API_BASE, fetchEngineers],
  );

  const toggleActive = useCallback(
    async (id: string, desired: boolean) => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/engineers/${id}/active`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-auth-token": token,
          },
          body: JSON.stringify({ active: desired }),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        setEngineers((prev) =>
          prev.map((e) => (e.id === id ? { ...e, active: desired } : e)),
        );
      } catch (err) {
        console.error("Failed to toggle active", err);
        await fetchEngineers();
      }
    },
    [token, API_BASE, fetchEngineers],
  );

  return {
    engineers,
    loading,
    error,
    refresh: fetchEngineers,
    toggleOnCall,
    toggleActive,
  };
} 
"use client";

import { useEngineers } from "@/hooks/useEngineers";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, PhoneCall } from "lucide-react";

export function EngineerSidebar() {
  const { engineers, loading, error, toggleOnCall, toggleActive, refresh } = useEngineers();
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  // Fetch current user email once
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentEmail(data?.user?.email ?? null);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-sm">
        Failed to load engineers
        <Button variant="ghost" size="sm" onClick={refresh} className="ml-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <aside className="space-y-4">
      <h2 className="text-lg font-semibold">Engineers</h2>

      <div className="flex flex-col gap-2">
        {engineers.map((eng) => {
          const isCurrent = currentEmail && eng.email?.toLowerCase() === currentEmail.toLowerCase();
          return (
            <div
              key={eng.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{eng.name || eng.email}</span>
                <div className="flex items-center gap-1 mt-0.5">
                  {eng.is_on_call && (
                    <Badge variant="secondary" className="gap-1">
                      <PhoneCall className="w-3 h-3" /> On&nbsp;Call
                    </Badge>
                  )}
                  {isCurrent && eng.active && (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="w-3 h-3" /> Active
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* On-call toggle for any engineer */}
                <Button
                  size="sm"
                  variant={eng.is_on_call ? "secondary" : "outline"}
                  onClick={() => toggleOnCall(eng.id, !eng.is_on_call)}
                >
                  {eng.is_on_call ? "Unset On-Call" : "Set On-Call"}
                </Button>

                {/* Active toggle only for current engineer */}
                {isCurrent && (
                  <Button
                    size="sm"
                    variant={eng.active ? "default" : "outline"}
                    onClick={() => toggleActive(eng.id, !eng.active)}
                  >
                    {eng.active ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
} 
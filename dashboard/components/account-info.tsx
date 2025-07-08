"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface UserInfo {
  email: string | null;
  id: string;
}

export function AccountInfo() {
  const supabase = createClient();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Fetch current user from Supabase
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data?.user ?? null);
      })
      .finally(() => setLoading(false));
  }, [supabase]);

  if (loading) {
    return <Skeleton className="h-8 w-32 rounded-md" />;
  }

  if (!user) {
    return null;
  }

  const fallback = user.email ? user.email[0].toUpperCase() : "U";

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Avatar className="h-8 w-8 border">
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      <span className="hidden sm:block max-w-[12rem] truncate" title={user.email ?? undefined}>
        {user.email}
      </span>
    </div>
  );
} 
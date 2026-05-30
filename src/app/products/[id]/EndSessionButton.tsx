"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";

export function EndSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const end = async () => {
    if (!confirm("End this session? This cannot be undone.")) return;
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
    router.refresh();
  };

  return (
    <Button size="sm" variant="ghost" onClick={end} disabled={loading} title="End session">
      <Square className="w-3.5 h-3.5 text-red-400" />
    </Button>
  );
}

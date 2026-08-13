"use client";

import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface AdminStats {
  total: number;
  by_disease: Record<string, number>;
  by_grade: Record<string, number>;
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setStats(await api.adminStats(apiKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-3 sm:px-3 py-6">
      <header className="mb-4">
        <p className="text-xs font-semibold tracking-wide text-leaf-700 dark:text-leaf-300">
          Restricted
        </p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl tracking-tight">
          Admin console
        </h1>
        <p className="mt-2 text-[var(--fg-muted)] max-w-2xl">
          Aggregate counts across all predictions. Requires the admin API
          key configured on the backend.
        </p>
      </header>

      {!stats ? (
        <div className="max-w-md rounded border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded bg-leaf-100 text-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-300">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="mt-3 font-display text-2xl tracking-tight">
            Enter API key
          </h2>
          <form onSubmit={submit} className="mt-2 space-y-2.5">
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="x-api-key"
              className="w-full h-11 px-3 rounded-sm border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:border-leaf-600 font-mono"
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <Button isLoading={loading} className="w-full">
              <ShieldCheck className="h-4 w-4" />
              Authenticate
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="rounded border border-[var(--border)] bg-[var(--bg-elev)] p-3">
            <p className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">
              Total predictions
            </p>
            <p className="mt-2 font-display text-5xl tracking-tight">
              {stats.total.toLocaleString()}
            </p>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-2">
            <BreakdownCard title="By disease" data={stats.by_disease} />
            <BreakdownCard title="By grade" data={stats.by_grade} />
          </div>
        </div>
      )}
    </section>
  );
}

function BreakdownCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-elev)] p-3">
      <h3 className="font-display text-xl tracking-tight">{title}</h3>
      <div className="mt-2 space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">No data yet.</p>
        ) : (
          entries.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm">
                <span>{k}</span>
                <span className="font-mono tabular-nums text-[var(--fg-muted)]">
                  {v} · {((v / total) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full bg-leaf-700 dark:bg-leaf-300"
                  style={{ width: `${(v / total) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

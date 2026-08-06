import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)] mt-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-[var(--fg-muted)] leading-relaxed">
              Field-grade computer vision for tobacco growers. Detect leaf
              diseases early and grade quality with the precision of a master
              buyer.
            </p>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)] mb-4">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/upload" className="hover:text-leaf-700 dark:hover:text-leaf-300">Analyze a leaf</Link></li>
              <li><Link href="/dashboard" className="hover:text-leaf-700 dark:hover:text-leaf-300">Dashboard</Link></li>
              <li><Link href="/history" className="hover:text-leaf-700 dark:hover:text-leaf-300">History</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)] mb-4">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-leaf-700 dark:hover:text-leaf-300">About</Link></li>
              <li><a href="http://localhost:8000/docs" className="hover:text-leaf-700 dark:hover:text-leaf-300" target="_blank" rel="noreferrer">API docs</a></li>
              <li><Link href="/admin" className="hover:text-leaf-700 dark:hover:text-leaf-300">Admin</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-xs text-[var(--fg-muted)]">
          <p>© {new Date().getFullYear()} TobaccoScan. Built for the field.</p>
          <p className="font-mono">v1.0.0 · CNN · Keras / TensorFlow</p>
        </div>
      </div>
    </footer>
  );
}

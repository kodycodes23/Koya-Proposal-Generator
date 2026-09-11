"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserIcon, ShieldCheckIcon } from "@/components/icons";
import type { Role } from "@/lib/role";

const ROLES: {
  role: Role;
  title: string;
  description: string;
  bullets: string[];
  icon: React.ReactNode;
}[] = [
  {
    role: "salesperson",
    title: "Sales Rep",
    description: "Draft, edit, and prepare proposals for review.",
    bullets: ["Generate and edit proposal content", "Regenerate individual sections", "Submit a proposal for approval"],
    icon: <UserIcon className="w-5 h-5" />,
  },
  {
    role: "manager",
    title: "Manager",
    description: "Review proposals before they reach a client.",
    bullets: ["Everything a Sales Rep can do", "Approve or reject with a reason", "Send the approved proposal to the client"],
    icon: <ShieldCheckIcon className="w-5 h-5" />,
  },
];

export default function RolePage() {
  const router = useRouter();
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectRole(role: Role) {
    setBusy(role);
    setError(null);
    try {
      const res = await fetch("/api/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to set role");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set role");
      setBusy(null);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <Image src="/logo.png" alt="Koya Talent" width={40} height={40} className="rounded-xl mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight">Who&apos;s working right now?</h1>
          <p className="text-sm text-gray-500 mt-1.5 max-w-sm">
            This decides what you can do here — only Managers can approve, reject, or send proposals to a client.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => selectRole(r.role)}
              disabled={busy !== null}
              className="text-left rounded-2xl border border-black/[0.08] bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
                {r.icon}
              </span>
              <p className="font-semibold text-base">{r.title}</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">{r.description}</p>
              <ul className="space-y-1.5">
                {r.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    {b}
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-block text-xs font-semibold text-indigo-600">
                {busy === r.role ? "Continuing…" : `Continue as ${r.title} →`}
              </span>
            </button>
          ))}
        </div>

        {error && <p className="text-red-600 text-sm mt-4 text-center">{error}</p>}

        <p className="text-xs text-gray-400 text-center mt-8">
          This is a lightweight role selector for this device, not a login — you can switch roles anytime from the
          top nav.
        </p>
      </div>
    </main>
  );
}

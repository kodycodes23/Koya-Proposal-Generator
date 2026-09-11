"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { GridIcon, PlusIcon, ClockIcon, UserIcon, ShieldCheckIcon } from "@/components/icons";
import { ROLE_LABELS, type Role } from "@/lib/role";

export function TopNav({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const onDashboard = pathname === "/";
  const onActivity = pathname.startsWith("/activity");

  return (
    <header className="sticky top-0 z-10 bg-page/80 backdrop-blur border-b border-black/[0.06]">
      <div className="mx-auto max-w-6xl w-full px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[15px]">
          <Image src="/logo.png" alt="Koya Talent" width={28} height={28} className="rounded-lg" />
          Koya Proposals
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className={`flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-sm font-medium shadow-sm transition-colors ${
              onDashboard ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <GridIcon className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <Link
            href="/activity"
            className={`flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-sm font-medium shadow-sm transition-colors ${
              onActivity ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <ClockIcon className="w-3.5 h-3.5" />
            Activity
          </Link>
          <Link
            href="/new"
            className="flex items-center gap-1.5 rounded-full bg-indigo-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-indigo-700"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Proposal
          </Link>

          {role && (
            <Link
              href="/role"
              title="Switch role"
              className="flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-600 pl-2.5 pr-3 py-1.5 text-xs font-medium hover:bg-gray-200 transition-colors"
            >
              {role === "manager" ? <ShieldCheckIcon className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
              {ROLE_LABELS[role]}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

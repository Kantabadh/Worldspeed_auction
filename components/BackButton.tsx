"use client";

import { usePathname, useRouter } from "next/navigation";
import { isSafeInternalPath } from "@/lib/navigation";

type BackButtonProps = {
  fallbackHref?: string;
  href?: string;
  label?: string;
  className?: string;
};

export default function BackButton({
  fallbackHref,
  href,
  label = "←",
  className = "inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white text-2xl font-semibold shadow-sm hover:bg-gray-100",
}: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  function getDefaultFallback() {
    if (fallbackHref || href) return fallbackHref || href || "/";
    if (pathname.startsWith("/admin/")) return "/admin";
    if (pathname === "/summary" || pathname === "/success") return "/merchant";
    if (pathname === "/merchant") return "/";

    return "/";
  }

  function handleBack() {
    const from = new URLSearchParams(window.location.search).get("from");

    if (isSafeInternalPath(from)) {
      router.replace(from);
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace(getDefaultFallback());
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={className}
      aria-label="กลับ"
      title="กลับ"
    >
      {label}
    </button>
  );
}

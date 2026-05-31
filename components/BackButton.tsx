"use client";

import { usePathname, useRouter } from "next/navigation";

type BackButtonProps = {
  href?: string;
};

export default function BackButton({ href }: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleBack() {
    if (href) {
      router.push(href);
      return;
    }

    if (pathname.startsWith("/admin/")) {
      router.push("/admin");
      return;
    }

    if (pathname === "/summary" || pathname === "/success") {
      router.push("/merchant");
      return;
    }

    if (pathname === "/merchant") {
      router.push("/");
      return;
    }

    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white text-2xl font-semibold shadow-sm hover:bg-gray-100"
      aria-label="Back"
      title="Back"
    >
      ←
    </button>
  );
}

import { redirect } from "next/navigation";

type MerchantLoginRedirectPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

function getSafeInternalNext(value?: string) {
  if (!value) return "";
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  if (value.includes("http://") || value.includes("https://")) return "";

  return value;
}

export default async function MerchantLoginRedirectPage({
  searchParams,
}: MerchantLoginRedirectPageProps) {
  const params = searchParams ? await searchParams : {};
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const safeNext = getSafeInternalNext(next);

  redirect(safeNext ? `/?next=${encodeURIComponent(safeNext)}` : "/");
}

import { redirect } from "next/navigation";

type MerchantLoginRedirectPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

export default async function MerchantLoginRedirectPage({
  searchParams,
}: MerchantLoginRedirectPageProps) {
  const params = searchParams ? await searchParams : {};
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  redirect(next ? `/?next=${encodeURIComponent(next)}` : "/");
}

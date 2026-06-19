import { redirect } from "next/navigation";
import { getMerchantSessionFromRequestCookie } from "@/lib/merchantServerSession";

type QrEntryPageProps = {
  params: Promise<{
    motorcycleId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function QrEntryPage({ params }: QrEntryPageProps) {
  const { motorcycleId } = await params;
  const merchantUrl = `/merchant?motorcycleId=${encodeURIComponent(
    motorcycleId
  )}`;
  const session = await getMerchantSessionFromRequestCookie();

  if (session) {
    redirect(merchantUrl);
  }

  redirect(`/merchant-login?next=${encodeURIComponent(merchantUrl)}`);
}

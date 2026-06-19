import { NextResponse } from "next/server";
import {
  getMerchantSessionFromRequestCookie,
  getMerchantServerSessionCookieOptions,
  MERCHANT_SERVER_SESSION_COOKIE,
} from "@/lib/merchantServerSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getMerchantSessionFromRequestCookie();

  if (!session) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    response.cookies.set(MERCHANT_SERVER_SESSION_COOKIE, "", {
      ...getMerchantServerSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  }

  return NextResponse.json({ merchant: session });
}

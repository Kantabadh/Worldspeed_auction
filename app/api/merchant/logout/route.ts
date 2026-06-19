import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getMerchantServerSessionCookieOptions,
  MERCHANT_SERVER_SESSION_COOKIE,
  revokeMerchantServerSession,
} from "@/lib/merchantServerSession";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_SERVER_SESSION_COOKIE)?.value;

  await revokeMerchantServerSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(MERCHANT_SERVER_SESSION_COOKIE, "", {
    ...getMerchantServerSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}

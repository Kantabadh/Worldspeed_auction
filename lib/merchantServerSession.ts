import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

export const MERCHANT_SERVER_SESSION_COOKIE = "merchant_session_token";
export const MERCHANT_SERVER_SESSION_MAX_AGE_SECONDS = 2 * 24 * 60 * 60;

export type ServerMerchantSession = {
  merchantAccountId: number;
  merchantName: string;
  shopName: string;
  phone: string;
  merchantCode?: string;
  expiresAt: string;
};

type MerchantSessionRow = {
  id: string;
  merchant_account_id: number;
  expires_at: string;
  revoked_at: string | null;
};

type MerchantAccountRow = {
  id: number;
  merchant_code: string | null;
  merchant_name: string | null;
  shop_name: string | null;
  phone: string | null;
  active: boolean | null;
  approval_status: string | null;
};

export function createRawSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getMerchantServerSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MERCHANT_SERVER_SESSION_MAX_AGE_SECONDS,
  };
}

export async function createMerchantServerSession(merchantAccountId: number) {
  const token = createRawSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + MERCHANT_SERVER_SESSION_MAX_AGE_SECONDS * 1000
  ).toISOString();

  const { error } = await supabaseServer.from("merchant_sessions").insert({
    token_hash: tokenHash,
    merchant_account_id: merchantAccountId,
    expires_at: expiresAt,
  });

  if (error) throw error;

  return { token, expiresAt };
}

export async function getMerchantSessionFromToken(token?: string | null) {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const { data: sessionRow, error: sessionError } = await supabaseServer
    .from("merchant_sessions")
    .select("id, merchant_account_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError || !sessionRow) return null;

  const session = sessionRow as MerchantSessionRow;
  const { data: merchantRow, error: merchantError } = await supabaseServer
    .from("merchant_accounts")
    .select("id, merchant_code, merchant_name, shop_name, phone, active, approval_status")
    .eq("id", session.merchant_account_id)
    .eq("active", true)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (merchantError || !merchantRow) return null;

  const merchant = merchantRow as MerchantAccountRow;

  return {
    merchantAccountId: Number(merchant.id),
    merchantName: merchant.merchant_name || "",
    shopName: merchant.shop_name || "",
    phone: merchant.phone || "",
    merchantCode: merchant.merchant_code || "",
    expiresAt: session.expires_at,
  } satisfies ServerMerchantSession;
}

export async function getMerchantSessionFromRequestCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MERCHANT_SERVER_SESSION_COOKIE)?.value;

  return getMerchantSessionFromToken(token);
}

export async function revokeMerchantServerSession(token?: string | null) {
  if (!token) return;

  await supabaseServer
    .from("merchant_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashSessionToken(token))
    .is("revoked_at", null);
}

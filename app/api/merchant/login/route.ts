import { NextResponse } from "next/server";
import {
  createMerchantServerSession,
  getMerchantServerSessionCookieOptions,
  MERCHANT_SERVER_SESSION_COOKIE,
} from "@/lib/merchantServerSession";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type MerchantAccount = {
  id: number;
  merchant_code: string | null;
  merchant_name: string | null;
  shop_name: string | null;
  phone: string | null;
  active: boolean | null;
  approval_status: string | null;
};

function cleanPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, code: "", details: "", hint: "" };
  }

  if (!error || typeof error !== "object") {
    return { message: String(error || ""), code: "", details: "", hint: "" };
  }

  return {
    message: "message" in error ? String(error.message || "") : "",
    code: "code" in error ? String(error.code || "") : "",
    details: "details" in error ? String(error.details || "") : "",
    hint: "hint" in error ? String(error.hint || "") : "",
  };
}

function getErrorResponse(
  message: string,
  status = 400,
  details?: Record<string, string>
) {
  return NextResponse.json(
    {
      error: message,
      ...(process.env.NODE_ENV !== "production" && details
        ? { details }
        : {}),
    },
    { status }
  );
}

export async function POST(request: Request) {
  let body: { phone?: string; merchantCode?: string; code?: string };

  try {
    body = await request.json();
  } catch {
    return getErrorResponse("Invalid request body");
  }

  const phone = cleanPhone(String(body.phone || ""));
  const merchantCode = String(body.merchantCode || body.code || "").trim();

  if (!phone || !merchantCode) {
    return getErrorResponse("Phone and merchant code are required");
  }

  let supabaseServer;

  try {
    supabaseServer = getSupabaseServerClient();
  } catch (error) {
    const details = getErrorDetails(error);
    console.error("[MERCHANT LOGIN SERVER CLIENT ERROR]", details);
    return getErrorResponse(
      "Merchant session server is not configured",
      500,
      details
    );
  }

  const { data, error } = await supabaseServer
    .from("merchant_accounts")
    .select("id, merchant_code, merchant_name, shop_name, phone, active, approval_status")
    .eq("phone", phone)
    .eq("merchant_code", merchantCode)
    .limit(1)
    .maybeSingle();

  if (error) {
    const details = getErrorDetails(error);
    console.error("[MERCHANT LOGIN VALIDATION ERROR]", details);
    return getErrorResponse(details.message || "Merchant login failed", 500, details);
  }

  if (!data) {
    return getErrorResponse("Invalid phone or merchant code", 401);
  }

  const merchant = data as MerchantAccount;

  if (merchant.approval_status === "pending") {
    return getErrorResponse("Merchant account is pending approval", 403);
  }

  if (merchant.approval_status === "rejected") {
    return getErrorResponse("Merchant account was rejected", 403);
  }

  if (!merchant.active || merchant.approval_status !== "approved") {
    return getErrorResponse("Merchant account is inactive", 403);
  }

  try {
    const serverSession = await createMerchantServerSession(Number(merchant.id));
    const response = NextResponse.json({
      merchant: {
        merchantAccountId: Number(merchant.id),
        merchantName: merchant.merchant_name || "",
        shopName: merchant.shop_name || "",
        phone: merchant.phone || "",
        merchantCode: merchant.merchant_code || "",
      },
      expiresAt: serverSession.expiresAt,
    });

    response.cookies.set(
      MERCHANT_SERVER_SESSION_COOKIE,
      serverSession.token,
      getMerchantServerSessionCookieOptions()
    );

    return response;
  } catch (sessionError) {
    const details = getErrorDetails(sessionError);
    console.error("[MERCHANT SESSION CREATE ERROR]", details);

    return getErrorResponse(
      details.message || "Could not create merchant session",
      500,
      details
    );
  }
}

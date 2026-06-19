import type { SupabaseClient } from "@supabase/supabase-js";

type AuthArea = "staff" | "merchant";

const STAFF_SESSION_KEYS = ["staffProfile"];

const MERCHANT_SESSION_KEYS = [
  "merchantSession",
  "merchantPageDraft",
  "merchantOfferPrices",
  "draftSubmission",
];

function getErrorMessage(error: unknown) {
  if (!error) return "";

  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message;

  if (typeof error === "object" && "message" in error) {
    return String(error.message || "");
  }

  return "";
}

export function isInvalidRefreshTokenError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found")
  );
}

function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;

  const clearStorage = (storage: Storage) => {
    Object.keys(storage).forEach((key) => {
      const normalizedKey = key.toLowerCase();
      const isSupabaseAuthKey =
        (normalizedKey.startsWith("sb-") &&
          normalizedKey.includes("auth-token")) ||
        normalizedKey.includes("supabase.auth");

      if (isSupabaseAuthKey) {
        storage.removeItem(key);
      }
    });
  };

  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);
}

export function clearStaffAuthStorage() {
  if (typeof window === "undefined") return;

  STAFF_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  clearSupabaseAuthStorage();
}

export function clearMerchantAuthStorage() {
  if (typeof window === "undefined") return;

  MERCHANT_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));

  const secure =
    window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `merchantSession=; Max-Age=0; Path=/; SameSite=Lax${secure}`;

  clearSupabaseAuthStorage();
}

export async function signOutAfterInvalidAuth(
  supabase: SupabaseClient,
  area: AuthArea
) {
  if (area === "staff") {
    clearStaffAuthStorage();
  } else {
    clearMerchantAuthStorage();
  }

  try {
    await supabase.auth.signOut();
  } catch {
    clearSupabaseAuthStorage();
  }
}

export async function handleInvalidRefreshToken(
  error: unknown,
  supabase: SupabaseClient,
  area: AuthArea,
  redirectTo?: string
) {
  if (!isInvalidRefreshTokenError(error)) return false;

  await signOutAfterInvalidAuth(supabase, area);

  if (typeof window !== "undefined" && redirectTo) {
    window.location.replace(redirectTo);
  }

  return true;
}

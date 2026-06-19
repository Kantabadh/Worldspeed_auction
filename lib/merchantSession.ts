"use client";

export type MerchantSession = {
  merchantAccountId: number;
  merchantId?: number;
  merchant_account_id?: number;
  merchantName: string;
  shopName: string;
  phone: string;
  merchantCode?: string;
  loginAt?: number;
  expiresAt?: number;
};

export const MERCHANT_SESSION_KEY = "merchantSession";
export const MERCHANT_SESSION_COOKIE_NAME = "merchantSession";
export const MERCHANT_SESSION_DURATION_MS = 2 * 24 * 60 * 60 * 1000;
export const MERCHANT_SESSION_COOKIE_MAX_AGE_SECONDS = 2 * 24 * 60 * 60;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getSessionMerchantAccountId(session: MerchantSession | null) {
  const accountId = Number(
    session?.merchantAccountId ??
      session?.merchantId ??
      session?.merchant_account_id
  );

  return Number.isFinite(accountId) && accountId > 0 ? accountId : null;
}

function isValidMerchantSession(session: MerchantSession | null) {
  const expiresAt = Number(session?.expiresAt);

  return Boolean(
    getSessionMerchantAccountId(session) &&
      Number.isFinite(expiresAt) &&
      expiresAt > Date.now()
  );
}

function normalizeMerchantSession(session: MerchantSession) {
  return {
    ...session,
    merchantAccountId: getSessionMerchantAccountId(session) || 0,
    merchantName: session.merchantName || "",
    shopName: session.shopName || "",
    phone: session.phone || "",
  };
}

function readLocalStorageSession() {
  if (!isBrowser()) return null;

  try {
    const savedSession = localStorage.getItem(MERCHANT_SESSION_KEY);
    return savedSession ? (JSON.parse(savedSession) as MerchantSession) : null;
  } catch {
    return null;
  }
}

function readCookieSession() {
  if (!isBrowser()) return null;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${MERCHANT_SESSION_COOKIE_NAME}=`));

  if (!cookie) return null;

  try {
    const encodedValue = cookie.slice(MERCHANT_SESSION_COOKIE_NAME.length + 1);
    return JSON.parse(decodeURIComponent(encodedValue)) as MerchantSession;
  } catch {
    return null;
  }
}

function getCookieAttributes(maxAgeSeconds: number) {
  const secure =
    isBrowser() && window.location.protocol === "https:" ? "; Secure" : "";

  return `Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function writeCookieSession(
  session: MerchantSession,
  maxAgeSeconds = MERCHANT_SESSION_COOKIE_MAX_AGE_SECONDS
) {
  if (!isBrowser()) return;

  document.cookie = `${MERCHANT_SESSION_COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(session)
  )}; ${getCookieAttributes(maxAgeSeconds)}`;
}

function writeLocalStorageSession(session: MerchantSession) {
  if (!isBrowser()) return;

  localStorage.setItem(MERCHANT_SESSION_KEY, JSON.stringify(session));
}

function clearLocalStorageSession() {
  if (!isBrowser()) return;

  localStorage.removeItem(MERCHANT_SESSION_KEY);
}

function clearCookieSession() {
  if (!isBrowser()) return;

  document.cookie = `${MERCHANT_SESSION_COOKIE_NAME}=; ${getCookieAttributes(
    0
  )}`;
}

function persistMerchantSession(session: MerchantSession) {
  const maxAgeSeconds = Math.max(
    1,
    Math.floor(((session.expiresAt || 0) - Date.now()) / 1000)
  );

  writeLocalStorageSession(session);
  writeCookieSession(session, maxAgeSeconds);
}

export function saveMerchantSession(session: MerchantSession) {
  const now = Date.now();
  const nextSession = {
    ...normalizeMerchantSession(session),
    loginAt: session.loginAt || now,
    expiresAt: now + MERCHANT_SESSION_DURATION_MS,
  };

  writeLocalStorageSession(nextSession);
  writeCookieSession(nextSession);

  return nextSession;
}

export function getValidMerchantSession() {
  const localSession = readLocalStorageSession();

  if (localSession) {
    if (isValidMerchantSession(localSession)) {
      const normalizedSession = normalizeMerchantSession(localSession);
      persistMerchantSession(normalizedSession);
      return normalizedSession;
    }

    clearLocalStorageSession();
  }

  const cookieSession = readCookieSession();

  if (cookieSession) {
    if (isValidMerchantSession(cookieSession)) {
      const normalizedSession = normalizeMerchantSession(cookieSession);
      persistMerchantSession(normalizedSession);
      return normalizedSession;
    }

    clearCookieSession();
  }

  return null;
}

export const getMerchantSession = getValidMerchantSession;

export function clearMerchantSession() {
  if (!isBrowser()) return;

  clearLocalStorageSession();
  clearCookieSession();
}

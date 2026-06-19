"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  clearStaffAuthStorage,
  handleInvalidRefreshToken,
} from "@/lib/authRecovery";
import {
  clearCachedStaffProfile,
  getCachedStaffProfile,
  isStaffRoleAllowed,
  type StaffRole,
} from "@/lib/staffSession";

type StaffGuardProps = {
  children: React.ReactNode;
  allowedRoles?: StaffRole[];
};

type AccessState = "checking" | "allowed" | "redirecting" | "error";

const DEFAULT_ALLOWED_ROLES: StaffRole[] = ["owner", "admin"];
const AUTH_CHECK_TIMEOUT_MS = 5000;
const AUTH_ERROR_MESSAGE = "โหลดข้อมูลไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่";

export default function StaffGuard({
  children,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
}: StaffGuardProps) {
  const router = useRouter();
  const redirectStartedRef = useRef(false);
  const checkedRoleKeyRef = useRef("");
  const accessStateRef = useRef<AccessState>("checking");
  const [mounted, setMounted] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);
  const roleKey = allowedRoles.join("|");

  const setGuardState = useCallback((nextState: AccessState) => {
    accessStateRef.current = nextState;
    setAccessState(nextState);
  }, []);

  const safeRedirectToLogin = useCallback(() => {
    if (redirectStartedRef.current) return;

    redirectStartedRef.current = true;
    setGuardState("redirecting");
    setShouldRedirectToLogin(true);
  }, [setGuardState]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !shouldRedirectToLogin) return;

    router.replace("/staff-login");
  }, [mounted, router, shouldRedirectToLogin]);

  useEffect(() => {
    if (!mounted) return;
    if (
      checkedRoleKeyRef.current === roleKey &&
      accessStateRef.current !== "checking"
    ) {
      return;
    }

    let cancelled = false;
    const allowedRoleSet = new Set(roleKey.split("|"));
    const timeoutId = window.setTimeout(() => {
      if (!cancelled && accessStateRef.current === "checking") {
        setGuardState("error");
      }
    }, AUTH_CHECK_TIMEOUT_MS);

    const checkAccess = async () => {
      try {
        if (accessStateRef.current !== "allowed") {
          setGuardState("checking");
        }

        const cachedProfile = getCachedStaffProfile();

        if (!cachedProfile) {
          clearCachedStaffProfile();
          safeRedirectToLogin();
          return;
        }

        if (!allowedRoleSet.has(cachedProfile.role)) {
          clearCachedStaffProfile();
          safeRedirectToLogin();
          return;
        }

        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (cancelled) return;

        if (
          await handleInvalidRefreshToken(
            userError,
            supabase,
            "staff",
            "/staff-login"
          )
        ) {
          clearCachedStaffProfile();
          setGuardState("redirecting");
          return;
        }

        if (userError || !userData.user) {
          clearCachedStaffProfile();
          clearStaffAuthStorage();
          safeRedirectToLogin();
          return;
        }

        checkedRoleKeyRef.current = roleKey;
        setGuardState("allowed");
      } catch (error) {
        if (cancelled) return;

        if (
          await handleInvalidRefreshToken(
            error,
            supabase,
            "staff",
            "/staff-login"
          )
        ) {
          clearCachedStaffProfile();
          setGuardState("redirecting");
          return;
        }

        clearCachedStaffProfile();
        setGuardState("error");
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    checkAccess();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [mounted, roleKey, safeRedirectToLogin, setGuardState]);

  if (accessState === "allowed") {
    return <>{children}</>;
  }

  if (accessState === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="flex min-h-[300px] w-full max-w-md flex-col items-center justify-center gap-4 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-semibold text-red-700">
            {AUTH_ERROR_MESSAGE}
          </p>
          <a
            href="/staff-login"
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </a>
        </section>
      </main>
    );
  }

  if (accessState === "redirecting") {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="flex min-h-[300px] w-full max-w-md items-center justify-center rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </section>
    </main>
  );
}

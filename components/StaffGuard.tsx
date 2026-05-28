"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StaffRole = "owner" | "admin" | "stock_staff";

type StaffProfile = {
  id: string;
  email: string;
  role: StaffRole;
  active: boolean;
  expiresAt?: number;
};

type StaffGuardProps = {
  children: React.ReactNode;
  allowedRoles?: StaffRole[];
};

const STAFF_TIMEOUT_MS = 10 * 60 * 1000;

const DEFAULT_ALLOWED_ROLES: StaffRole[] = ["owner", "admin"];

export default function StaffGuard({
  children,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
}: StaffGuardProps) {
  const [isAllowed, setIsAllowed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState("Checking staff access...");

  function saveStaffSession(profile: StaffProfile) {
    localStorage.setItem(
      "staffProfile",
      JSON.stringify({
        ...profile,
        expiresAt: Date.now() + STAFF_TIMEOUT_MS,
      })
    );
  }

  async function logoutStaff() {
    localStorage.removeItem("staffProfile");
    await supabase.auth.signOut();
    window.location.href = "/staff-login";
  }

  async function denyAccess(reason: string) {
    localStorage.removeItem("staffProfile");
    setIsAllowed(false);
    setIsChecking(false);
    setMessage(reason);

    setTimeout(() => {
      window.location.href = "/staff-login";
    }, 900);
  }

  async function checkStaff() {
    setIsChecking(true);
    setIsAllowed(false);
    setMessage("Checking staff access...");

    const savedProfileText = localStorage.getItem("staffProfile");

    if (!savedProfileText) {
      window.location.href = "/staff-login";
      return;
    }

    let savedProfile: StaffProfile;

    try {
      savedProfile = JSON.parse(savedProfileText) as StaffProfile;
    } catch {
      await denyAccess("Staff session is invalid. Redirecting...");
      return;
    }

    if (savedProfile.expiresAt && Date.now() > savedProfile.expiresAt) {
      await logoutStaff();
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      await logoutStaff();
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id, email, role, active")
      .eq("id", userData.user.id)
      .eq("active", true)
      .limit(1);

    if (profileError || !profile || profile.length === 0) {
      await logoutStaff();
      return;
    }

    const verifiedProfile = profile[0] as StaffProfile;

    if (!allowedRoles.includes(verifiedProfile.role)) {
      await denyAccess("You do not have permission to open this page.");
      return;
    }

    saveStaffSession({
      id: verifiedProfile.id,
      email: verifiedProfile.email,
      role: verifiedProfile.role,
      active: verifiedProfile.active,
    });

    setIsAllowed(true);
    setIsChecking(false);
  }

  function refreshStaffActivity() {
    const savedProfileText = localStorage.getItem("staffProfile");

    if (!savedProfileText) return;

    try {
      const savedProfile = JSON.parse(savedProfileText) as StaffProfile;
      saveStaffSession(savedProfile);
    } catch {
      localStorage.removeItem("staffProfile");
    }
  }

  useEffect(() => {
    checkStaff();
  }, []);

  useEffect(() => {
    if (!isAllowed) return;

    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, refreshStaffActivity);
    });

    const interval = setInterval(() => {
      const savedProfileText = localStorage.getItem("staffProfile");

      if (!savedProfileText) {
        logoutStaff();
        return;
      }

      try {
        const savedProfile = JSON.parse(savedProfileText) as StaffProfile;

        if (savedProfile.expiresAt && Date.now() > savedProfile.expiresAt) {
          logoutStaff();
        }
      } catch {
        logoutStaff();
      }
    }, 5000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, refreshStaffActivity);
      });

      clearInterval(interval);
    };
  }, [isAllowed]);

  if (isChecking || !isAllowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
          <p className="font-semibold text-gray-900">{message}</p>
          <p className="mt-2 text-sm text-gray-500">
            กรุณารอสักครู่ ระบบกำลังตรวจสอบสิทธิ์
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
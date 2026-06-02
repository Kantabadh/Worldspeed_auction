"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  clearCachedStaffProfile,
  getCachedStaffProfile,
  isStaffRoleAllowed,
  saveCachedStaffProfile,
  type StaffProfile,
  type StaffRole,
} from "@/lib/staffSession";

type StaffGuardProps = {
  children: React.ReactNode;
  allowedRoles?: StaffRole[];
};

const DEFAULT_ALLOWED_ROLES: StaffRole[] = ["owner", "admin"];

export default function StaffGuard({
  children,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
}: StaffGuardProps) {
  const [isAllowed, setIsAllowed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  async function logoutStaff() {
    clearCachedStaffProfile();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function denyAccess() {
    clearCachedStaffProfile();
    setIsAllowed(false);
    setIsChecking(false);

    setTimeout(() => {
      window.location.href = "/";
    }, 900);
  }

  async function verifyStaffInBackground(showLoading: boolean) {
    if (showLoading) {
      setIsChecking(true);
      setIsAllowed(false);
    }

    const savedProfile = getCachedStaffProfile();

    if (!savedProfile) {
      window.location.href = "/";
      return;
    }

    if (!isStaffRoleAllowed(savedProfile, allowedRoles)) {
      await denyAccess();
      return;
    }

    setIsAllowed(true);
    setIsChecking(false);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      await logoutStaff();
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id, email, role, active, branch_code, branch_name")
      .eq("id", userData.user.id)
      .eq("active", true)
      .limit(1);

    if (profileError || !profile || profile.length === 0) {
      await logoutStaff();
      return;
    }

    const verifiedProfile = profile[0] as StaffProfile;

    if (!isStaffRoleAllowed(verifiedProfile, allowedRoles)) {
      await denyAccess();
      return;
    }

    saveCachedStaffProfile({
      id: verifiedProfile.id,
      email: verifiedProfile.email,
      role: verifiedProfile.role,
      active: verifiedProfile.active,
      branch_code: verifiedProfile.branch_code,
      branch_name: verifiedProfile.branch_name,
    });

    setIsAllowed(true);
    setIsChecking(false);
  }

  function refreshStaffActivity() {
    const savedProfileText = localStorage.getItem("staffProfile");

    if (!savedProfileText) return;

    try {
      const savedProfile = JSON.parse(savedProfileText) as StaffProfile;
      saveCachedStaffProfile(savedProfile);
    } catch {
      clearCachedStaffProfile();
    }
  }

  useEffect(() => {
    const cachedProfile = getCachedStaffProfile();

    if (isStaffRoleAllowed(cachedProfile, allowedRoles)) {
      setIsAllowed(true);
      setIsChecking(false);
      verifyStaffInBackground(false);
      return;
    }

    verifyStaffInBackground(true);
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
        <section className="flex min-h-[300px] w-full max-w-md items-center justify-center rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

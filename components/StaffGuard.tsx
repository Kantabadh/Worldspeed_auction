"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  expiresAt?: number;
};

const STAFF_TIMEOUT_MS = 10 * 60 * 1000;

export default function StaffGuard({ children }: { children: React.ReactNode }) {
  const [isAllowed, setIsAllowed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

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

async function checkStaff() {
  const savedProfileText = localStorage.getItem("staffProfile");

  if (!savedProfileText) {
    window.location.href = "/staff-login";
    return;
  }

  const savedProfile = JSON.parse(savedProfileText) as StaffProfile;

  if (savedProfile.expiresAt && Date.now() > savedProfile.expiresAt) {
    await logoutStaff();
    return;
  }

  // Allow page to show immediately.
  setIsAllowed(true);
  setIsChecking(false);

  // Verify with Supabase in the background.
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

  saveStaffSession({
    id: profile[0].id,
    email: profile[0].email,
    role: profile[0].role,
    active: profile[0].active,
  });
}

  function refreshStaffActivity() {
    const savedProfileText = localStorage.getItem("staffProfile");

    if (!savedProfileText) return;

    const savedProfile = JSON.parse(savedProfileText) as StaffProfile;
    saveStaffSession(savedProfile);
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

      const savedProfile = JSON.parse(savedProfileText) as StaffProfile;

      if (savedProfile.expiresAt && Date.now() > savedProfile.expiresAt) {
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

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-700">Checking staff access...</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
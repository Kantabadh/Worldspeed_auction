"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type StaffProfile = {
  id: string;
  email: string;
  role: "owner" | "admin";
  active: boolean;
  created_at: string;
};

export default function AdminStaffPage() {
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadStaffProfiles() {
    setIsLoading(true);
    setErrorMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setErrorMessage("Staff login not found.");
      setIsLoading(false);
      return;
    }

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("staff_profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (currentProfileError || !currentProfile) {
      setErrorMessage("Current staff profile not found.");
      setIsLoading(false);
      return;
    }

    setCurrentStaff(currentProfile as StaffProfile);

    if (currentProfile.role !== "owner") {
      setErrorMessage("Owner access only.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("staff_profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setStaffProfiles((data as StaffProfile[]) || []);
    setIsLoading(false);
  }

  async function toggleStaffActive(staff: StaffProfile) {
    if (currentStaff?.id === staff.id) {
      alert("You cannot deactivate your own owner account.");
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("staff_profiles")
      .update({
        active: !staff.active,
      })
      .eq("id", staff.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadStaffProfiles();
  }

  useEffect(() => {
    loadStaffProfiles();
  }, []);

  const ownerCount = staffProfiles.filter((staff) => staff.role === "owner")
    .length;
  const adminCount = staffProfiles.filter((staff) => staff.role === "admin")
    .length;
  const activeCount = staffProfiles.filter((staff) => staff.active).length;

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-4 py-6">
          <BackButton />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Owner Management
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Staff Accounts
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                View staff roles and activate or deactivate admin access.
              </p>
            </div>

            <button
              onClick={loadStaffProfiles}
              className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">Notice</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <section className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Total Staff</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {staffProfiles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Active Staff</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {activeCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Roles</p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                Owners: {ownerCount}
              </p>
              <p className="text-sm text-gray-600">Admins: {adminCount}</p>
            </div>
          </section>

          <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Staff Profile List
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Staff users must first be created in Supabase Authentication, then
              added to the staff_profiles table.
            </p>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">Loading staff profiles...</p>
              </div>
            )}

            {!isLoading && staffProfiles.length === 0 && !errorMessage && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">No staff profiles found.</p>
              </div>
            )}

            {!isLoading && staffProfiles.length > 0 && (
              <div className="mt-5 space-y-4">
                {staffProfiles.map((staff) => (
                  <article
                    key={staff.id}
                    className="rounded-2xl border bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          {staff.role}
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-gray-900">
                          {staff.email}
                        </h3>

                        <p className="mt-1 text-sm text-gray-600">
                          Created: {new Date(staff.created_at).toLocaleString()}
                        </p>
                      </div>

                      {staff.active ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => toggleStaffActive(staff)}
                        disabled={currentStaff?.id === staff.id}
                        className={
                          staff.active
                            ? "rounded-xl bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600 disabled:bg-gray-400"
                            : "rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:bg-gray-400"
                        }
                      >
                        {staff.active ? "Deactivate" : "Activate"}
                      </button>

                      {currentStaff?.id === staff.id && (
                        <span className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600">
                          Current account
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}
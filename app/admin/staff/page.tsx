"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type StaffRole = "owner" | "admin";

type StaffProfile = {
  id: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
};

export default function AdminStaffPage() {
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);

  const [newStaffId, setNewStaffId] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>("admin");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<StaffRole>("admin");

  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
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
      .limit(1);

    if (
      currentProfileError ||
      !currentProfile ||
      currentProfile.length === 0
    ) {
      setErrorMessage("Current staff profile not found.");
      setIsLoading(false);
      return;
    }

    const currentProfileData = currentProfile[0] as StaffProfile;
    setCurrentStaff(currentProfileData);

    if (currentProfileData.role !== "owner") {
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

  async function addStaffProfile() {
    if (!newStaffId || !newStaffEmail || !newStaffRole) {
      alert("Please fill Auth User UID, email, and role.");
      return;
    }

    setIsAdding(true);
    setErrorMessage("");

    const { error } = await supabase.from("staff_profiles").insert({
      id: newStaffId.trim(),
      email: newStaffEmail.trim(),
      role: newStaffRole,
      active: true,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsAdding(false);
      return;
    }

    setNewStaffId("");
    setNewStaffEmail("");
    setNewStaffRole("admin");
    setIsAdding(false);
    loadStaffProfiles();
  }

  function startEditing(staff: StaffProfile) {
    setEditingId(staff.id);
    setEditEmail(staff.email);
    setEditRole(staff.role);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditEmail("");
    setEditRole("admin");
  }

  async function saveEdit(staff: StaffProfile) {
    if (!editEmail || !editRole) {
      alert("Please fill email and role.");
      return;
    }

    if (currentStaff?.id === staff.id && editRole !== "owner") {
      alert("You cannot remove owner role from your own account.");
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("staff_profiles")
      .update({
        email: editEmail.trim(),
        role: editRole,
      })
      .eq("id", staff.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    cancelEditing();
    loadStaffProfiles();
  }

  async function toggleStaffActive(staff: StaffProfile) {
    if (currentStaff?.id === staff.id) {
      alert("You cannot deactivate your own account.");
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

  const ownerCount = staffProfiles.filter((staff) => staff.role === "owner")
    .length;

  const adminCount = staffProfiles.filter((staff) => staff.role === "admin")
    .length;

  const activeCount = staffProfiles.filter((staff) => staff.active).length;

  useEffect(() => {
    loadStaffProfiles();
  }, []);

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-4 py-6">
          <BackButton />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Owner Settings
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Admin & Staff Access
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                Owner-only page for managing admin accounts, roles, and access
                status.
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
              <p className="text-sm font-medium text-gray-500">Total Accounts</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {staffProfiles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Active Accounts</p>
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

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Add Admin Profile
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              First create the staff user in Supabase Authentication, then copy
              the Auth User UID here.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Auth User UID
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={newStaffId}
                  onChange={(e) => setNewStaffId(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Staff Email
                </label>

                <input
                  type="email"
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="staff@example.com"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Role</label>

                <select
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                >
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>

            <button
              onClick={addStaffProfile}
              disabled={isAdding}
              className="mt-5 rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isAdding ? "Adding..." : "Add Admin Profile"}
            </button>
          </section>

          <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Admin Account List
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Staff login accounts are created in Supabase Auth. This page
              controls whether those accounts can access admin pages.
            </p>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">Loading admin profiles...</p>
              </div>
            )}

            {!isLoading && staffProfiles.length === 0 && !errorMessage && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">No admin profiles found.</p>
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

                        <p className="mt-1 break-all text-xs text-gray-500">
                          UID: {staff.id}
                        </p>

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

                    {editingId === staff.id ? (
                      <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                        <h4 className="font-semibold text-gray-900">
                          Edit Admin Profile
                        </h4>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="text-sm font-medium text-gray-700">
                              Email
                            </label>

                            <input
                              type="email"
                              className="mt-1 w-full rounded-xl border p-3"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700">
                              Role
                            </label>

                            <select
                              className="mt-1 w-full rounded-xl border p-3"
                              value={editRole}
                              onChange={(e) =>
                                setEditRole(e.target.value as StaffRole)
                              }
                            >
                              <option value="admin">Admin</option>
                              <option value="owner">Owner</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => saveEdit(staff)}
                            className="rounded-xl bg-black px-4 py-2 font-semibold text-white"
                          >
                            Save
                          </button>

                          <button
                            onClick={cancelEditing}
                            className="rounded-xl border bg-white px-4 py-2 font-semibold hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() => startEditing(staff)}
                          className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                        >
                          Edit
                        </button>

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
                    )}
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
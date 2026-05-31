"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

type StaffRole = "owner" | "admin" | "stock_staff";

type StaffProfile = {
  id: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
};

function getStaffRoleLabel(role: StaffRole | string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "stock_staff") return "เจ้าหน้าที่รับรถ";
  return role || "-";
}

function getStaffRoleDescription(role: StaffRole | string) {
  if (role === "owner") return "สิทธิ์สูงสุด จัดการทุกอย่างได้";
  if (role === "admin") return "จัดการรอบเสนอราคา ร้านค้า ราคาเสนอ และดาวน์โหลดไฟล์";
  if (role === "stock_staff") return "เพิ่ม/แก้ไขข้อมูลรถในคลังเท่านั้น";
  return "-";
}

function getRoleBadgeClass(role: StaffRole | string) {
  if (role === "owner") return "bg-black text-white";
  if (role === "admin") return "bg-blue-100 text-blue-700";
  if (role === "stock_staff") return "bg-green-100 text-green-700";
  return "bg-gray-100 text-gray-700";
}

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
      setErrorMessage("ไม่พบข้อมูลเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่");
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
      setErrorMessage("ไม่พบข้อมูลผู้ดูแลระบบของบัญชีนี้");
      setIsLoading(false);
      return;
    }

    const currentProfileData = currentProfile[0] as StaffProfile;
    setCurrentStaff(currentProfileData);

    if (currentProfileData.role !== "owner") {
      setErrorMessage("หน้านี้สำหรับ Owner เท่านั้น");
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
      alert("กรุณากรอก UID, อีเมล และสิทธิ์ผู้ใช้งาน");
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
      alert("กรุณากรอกอีเมลและสิทธิ์ผู้ใช้งาน");
      return;
    }

    if (currentStaff?.id === staff.id && editRole !== "owner") {
      alert("ไม่สามารถถอดสิทธิ์ Owner ของบัญชีตัวเองได้");
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
      alert("ไม่สามารถปิดใช้งานบัญชีตัวเองได้");
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

  const stockStaffCount = staffProfiles.filter(
    (staff) => staff.role === "stock_staff"
  ).length;

  const activeCount = staffProfiles.filter((staff) => staff.active).length;

  useEffect(() => {
    loadStaffProfiles();
  }, []);

  return (
    <StaffGuard allowedRoles={["owner"]}>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
          <BackButton />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                จัดการผู้ดูแลระบบ
              </h1>
            </div>

            <button
              onClick={loadStaffProfiles}
              className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
            >
              โหลดใหม่
            </button>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">แจ้งเตือน</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
              <p className="text-sm font-medium text-gray-500">บัญชีทั้งหมด</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
                {staffProfiles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
              <p className="text-sm font-medium text-gray-500">ใช้งานอยู่</p>
              <p className="mt-2 text-2xl font-bold text-green-600 sm:text-3xl">
                {activeCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
              <p className="text-sm font-medium text-gray-500">Owner/Admin</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
                {ownerCount}/{adminCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
              <p className="text-sm font-medium text-gray-500">
                เจ้าหน้าที่รับรถ
              </p>
              <p className="mt-2 text-2xl font-bold text-green-700 sm:text-3xl">
                {stockStaffCount}
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <h2 className="text-xl font-bold text-gray-900">
              เพิ่มบัญชีผู้ใช้งานภายใน
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              ต้องสร้างบัญชีใน Supabase Authentication ก่อน แล้วนำ UID มาใส่ที่นี่
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
                  onChange={(event) => setNewStaffId(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  อีเมล
                </label>

                <input
                  type="email"
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="staff@example.com"
                  value={newStaffEmail}
                  onChange={(event) => setNewStaffEmail(event.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  สิทธิ์
                </label>

                <select
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  value={newStaffRole}
                  onChange={(event) =>
                    setNewStaffRole(event.target.value as StaffRole)
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                  <option value="stock_staff">เจ้าหน้าที่รับรถ</option>
                </select>

                <p className="mt-2 text-xs text-gray-500">
                  {getStaffRoleDescription(newStaffRole)}
                </p>
              </div>
            </div>

            <button
              onClick={addStaffProfile}
              disabled={isAdding}
              className="mt-5 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400 sm:w-auto"
            >
              {isAdding ? "กำลังเพิ่ม..." : "เพิ่มผู้ใช้งาน"}
            </button>
          </section>

          <section className="mt-8 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <h2 className="text-xl font-bold text-gray-900">
              รายชื่อผู้ใช้งานภายใน
            </h2>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            )}

            {!isLoading && staffProfiles.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">ยังไม่มีบัญชีผู้ใช้งาน</p>
              </div>
            )}

            {!isLoading && staffProfiles.length > 0 && (
              <div className="mt-4 space-y-3">
                {staffProfiles.map((staff) => {
                  const isEditing = editingId === staff.id;

                  return (
                    <article
                      key={staff.id}
                      className="rounded-2xl border bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${getRoleBadgeClass(
                                staff.role
                              )}`}
                            >
                              {getStaffRoleLabel(staff.role)}
                            </span>

                            {staff.active ? (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                                ใช้งานอยู่
                              </span>
                            ) : (
                              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                ปิดใช้งาน
                              </span>
                            )}

                            {currentStaff?.id === staff.id && (
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                                บัญชีของคุณ
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 break-all text-lg font-bold text-gray-900">
                            {staff.email}
                          </h3>

                          <p className="mt-1 text-sm text-gray-600">
                            {getStaffRoleDescription(staff.role)}
                          </p>
                        </div>

                        {!isEditing && (
                          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                            <button
                              onClick={() => startEditing(staff)}
                              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-100"
                            >
                              แก้ไข
                            </button>

                            <button
                              onClick={() => toggleStaffActive(staff)}
                              className={
                                staff.active
                                  ? "rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                                  : "rounded-xl border border-green-200 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                              }
                            >
                              {staff.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                อีเมล
                              </label>

                              <input
                                type="email"
                                className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                                value={editEmail}
                                onChange={(event) =>
                                  setEditEmail(event.target.value)
                                }
                              />
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                สิทธิ์
                              </label>

                              <select
                                className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                                value={editRole}
                                onChange={(event) =>
                                  setEditRole(event.target.value as StaffRole)
                                }
                              >
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                                <option value="stock_staff">
                                  เจ้าหน้าที่รับรถ
                                </option>
                              </select>

                              <p className="mt-2 text-xs text-gray-500">
                                {getStaffRoleDescription(editRole)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => saveEdit(staff)}
                              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                            >
                              บันทึก
                            </button>

                            <button
                              onClick={cancelEditing}
                              className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-100"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}

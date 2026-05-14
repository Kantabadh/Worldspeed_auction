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

type AuctionRound = {
  id: number;
  round_name: string;
  auction_status: string | null;
  exported_by_email: string | null;
  created_by_email: string | null;
  total_lots_with_offers: number;
  total_merchants: number;
  total_offers: number;
  total_highest_value: number;
  total_cost: number;
  total_gross_profit: number;
  created_at: string;
};

const STAFF_TIMEOUT_MS = 10 * 60 * 1000;

export default function AdminHistoryPage() {
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isCheckingStaff, setIsCheckingStaff] = useState(true);

  const [rounds, setRounds] = useState<AuctionRound[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  function saveStaffSessionToStorage(profile: StaffProfile) {
    const updatedProfile = {
      ...profile,
      expiresAt: Date.now() + STAFF_TIMEOUT_MS,
    };

    localStorage.setItem("staffProfile", JSON.stringify(updatedProfile));

    return updatedProfile;
  }

  async function logoutStaff() {
    localStorage.removeItem("staffProfile");
    await supabase.auth.signOut();
    setStaffProfile(null);
    window.location.href = "/staff-login";
  }

  async function checkStaffSession() {
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

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      localStorage.removeItem("staffProfile");
      window.location.href = "/staff-login";
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

    const updatedProfile = saveStaffSessionToStorage({
      id: profile[0].id,
      email: profile[0].email,
      role: profile[0].role,
      active: profile[0].active,
    });

    setStaffProfile(updatedProfile);
    setIsCheckingStaff(false);
  }

  function refreshStaffActivity() {
    const savedProfileText = localStorage.getItem("staffProfile");

    if (!savedProfileText) return;

    const savedProfile = JSON.parse(savedProfileText) as StaffProfile;

    const updatedProfile = {
      ...savedProfile,
      expiresAt: Date.now() + STAFF_TIMEOUT_MS,
    };

    localStorage.setItem("staffProfile", JSON.stringify(updatedProfile));
  }

  async function loadAuctionRounds() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("auction_rounds")
      .select(`
        id,
        round_name,
        auction_status,
        exported_by_email,
        created_by_email,
        total_lots_with_offers,
        total_merchants,
        total_offers,
        total_highest_value,
        total_cost,
        total_gross_profit,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setRounds((data as AuctionRound[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    checkStaffSession();
  }, []);

  useEffect(() => {
    if (!staffProfile) return;

    loadAuctionRounds();
  }, [staffProfile?.id]);

  useEffect(() => {
    if (!staffProfile) return;

    const events = ["click", "keydown", "scroll", "touchstart"];

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
  }, [staffProfile?.id]);

  function formatThaiDateTime(dateInput: string) {
    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) return "-";

    const dateText = date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const timeText = date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return `${dateText} เวลา ${timeText}`;
  }

  function getThaiAuctionStatus(status: string | null) {
    if (status === "open") return "เปิดรับราคา";
    if (status === "closed") return "ปิดรับราคา";
    return "-";
  }

  const totalRounds = rounds.length;

  const totalHighestValueAllRounds = rounds.reduce((sum, round) => {
    return sum + Number(round.total_highest_value || 0);
  }, 0);

  const totalCostAllRounds = rounds.reduce((sum, round) => {
    return sum + Number(round.total_cost || 0);
  }, 0);

  const totalGrossProfitAllRounds = rounds.reduce((sum, round) => {
    return sum + Number(round.total_gross_profit || 0);
  }, 0);

  if (isCheckingStaff) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-700">กำลังตรวจสอบสิทธิ์...</p>
        </section>
      </main>
    );
  }

  if (!staffProfile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-gray-700">กำลังไปหน้าเข้าสู่ระบบ...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <header className="border-b bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
              ประวัติการเสนอราคา
            </p>

            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              ประวัติรอบการเสนอราคา
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              เข้าสู่ระบบโดย {staffProfile.email} • {staffProfile.role}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/admin"
              className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            >
              กลับหน้าหลัก Admin
            </a>

            <button
              onClick={logoutStaff}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">เกิดข้อผิดพลาด</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">
              จำนวนรอบที่บันทึก
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalRounds}
            </p>

            <p className="text-sm text-gray-500">รอบ</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">
              มูลค่าสูงสุดรวม
            </p>

            <p className="mt-2 text-2xl font-bold text-green-700">
              {totalHighestValueAllRounds.toLocaleString()}
            </p>

            <p className="text-sm text-gray-500">บาท</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">ต้นทุนรวม</p>

            <p className="mt-2 text-2xl font-bold text-orange-700">
              {totalCostAllRounds.toLocaleString()}
            </p>

            <p className="text-sm text-gray-500">บาท</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">
              กำไรขั้นต้นรวม
            </p>

            <p
              className={
                totalGrossProfitAllRounds >= 0
                  ? "mt-2 text-2xl font-bold text-green-700"
                  : "mt-2 text-2xl font-bold text-red-700"
              }
            >
              {totalGrossProfitAllRounds.toLocaleString()}
            </p>

            <p className="text-sm text-gray-500">บาท</p>
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">
                ข้อมูลประวัติรอบการเสนอราคา
              </p>

              <p className="mt-1 text-sm text-gray-600">
                ประวัติจะถูกสร้างเมื่อ Owner กดบันทึกประวัติและล้างข้อมูลจากหน้า Admin
              </p>
            </div>

            <button
              onClick={loadAuctionRounds}
              className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
            >
              โหลดใหม่
            </button>
          </div>
        </section>

        {isLoading && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-gray-600">กำลังโหลดประวัติ...</p>
          </div>
        )}

        {!isLoading && rounds.length === 0 && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-semibold text-gray-900">
              ยังไม่มีประวัติรอบการเสนอราคา
            </p>

            <p className="mt-1 text-sm text-gray-600">
              ประวัติจะถูกสร้างเมื่อ Owner กดบันทึกประวัติและล้างข้อมูล
            </p>
          </div>
        )}

        {!isLoading && rounds.length > 0 && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              รายการประวัติทั้งหมด
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              เรียงจากรอบล่าสุดไปเก่าสุด
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-100 text-gray-800">
                    <th className="p-3">รอบ</th>
                    <th className="p-3">วันที่บันทึก</th>
                    <th className="p-3">สถานะตอนบันทึก</th>
                    <th className="p-3">Lot ที่มีราคา</th>
                    <th className="p-3">ร้านค้า</th>
                    <th className="p-3">ราคาทั้งหมด</th>
                    <th className="p-3">มูลค่าสูงสุดรวม</th>
                    <th className="p-3">ต้นทุนรวม</th>
                    <th className="p-3">กำไรขั้นต้น</th>
                    <th className="p-3">ผู้บันทึก</th>
                    <th className="w-[130px] p-3">รายละเอียด</th>
                  </tr>
                </thead>

                <tbody>
                  {rounds.map((round) => (
                    <tr key={round.id} className="border-b align-top">
                      <td className="p-3 font-semibold text-gray-900">
                        {round.round_name}
                      </td>

                      <td className="p-3 text-gray-700">
                        {formatThaiDateTime(round.created_at)}
                      </td>

                      <td className="p-3">
                        <span
                          className={
                            round.auction_status === "open"
                              ? "inline-flex whitespace-nowrap rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                              : "inline-flex whitespace-nowrap rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                          }
                        >
                          {getThaiAuctionStatus(round.auction_status)}
                        </span>
                      </td>

                      <td className="p-3 font-semibold">
                        {Number(round.total_lots_with_offers || 0).toLocaleString()}
                      </td>

                      <td className="p-3 font-semibold">
                        {Number(round.total_merchants || 0).toLocaleString()}
                      </td>

                      <td className="p-3 font-semibold">
                        {Number(round.total_offers || 0).toLocaleString()}
                      </td>

                      <td className="p-3 font-bold text-green-700">
                        {Number(round.total_highest_value || 0).toLocaleString()}{" "}
                        บาท
                      </td>

                      <td className="p-3 font-semibold text-orange-700">
                        {Number(round.total_cost || 0).toLocaleString()} บาท
                      </td>

                      <td
                        className={
                          Number(round.total_gross_profit || 0) >= 0
                            ? "p-3 font-bold text-green-700"
                            : "p-3 font-bold text-red-700"
                        }
                      >
                        {Number(round.total_gross_profit || 0).toLocaleString()}{" "}
                        บาท
                      </td>

                      <td className="p-3 text-gray-700">
                        {round.created_by_email || round.exported_by_email || "-"}
                      </td>

                      <td className="p-3">
                        <a
                          href={`/admin/history/${round.id}`}
                          className="inline-flex min-w-[110px] justify-center whitespace-nowrap rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                          ดูรายละเอียด
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
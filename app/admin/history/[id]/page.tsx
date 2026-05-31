"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMemoryCachedStaffProfile } from "@/lib/staffSession";
import BackButton from "@/components/BackButton";
import * as XLSX from "xlsx";

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
  total_lots_with_offers: number;
  total_merchants: number;
  total_offers: number;
  created_at: string;
};

type AuctionRoundOffer = {
  id: number;
  auction_round_id: number;
  lot_number: string;
  motorcycle_name: string;
  cost_price: number;
  merchant_name: string;
  shop_name: string;
  phone: string;
  offer_price: number;
  submitted_at: string | null;
  rank_number: number;
  is_tied: boolean;
  gross_profit: number;
};

type LotGroup = {
  lot_number: string;
  motorcycle_name: string;
  cost_price: number;
  highest_offer: number;
  gross_profit_from_highest: number;
  offers: AuctionRoundOffer[];
};

const STAFF_TIMEOUT_MS = 10 * 60 * 1000;

export default function AdminHistoryDetailPage() {
  const params = useParams();
  const roundId = Number(params?.id);

  const cachedStaffProfile = getMemoryCachedStaffProfile();
  const canUseCachedStaffProfile = Boolean(
    cachedStaffProfile &&
      (cachedStaffProfile.role === "owner" || cachedStaffProfile.role === "admin")
  );

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(
    canUseCachedStaffProfile ? (cachedStaffProfile as StaffProfile) : null
  );
  const [isCheckingStaff, setIsCheckingStaff] = useState(
    !canUseCachedStaffProfile
  );

  const [round, setRound] = useState<AuctionRound | null>(null);
  const [offers, setOffers] = useState<AuctionRoundOffer[]>([]);
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

    if (updatedProfile.role !== "owner" && updatedProfile.role !== "admin") {
      localStorage.removeItem("staffProfile");
      window.location.href = "/staff-login";
      return;
    }

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

  async function loadRoundDetail() {
    if (!roundId || Number.isNaN(roundId)) {
      setErrorMessage("ไม่พบรหัสรอบประวัติ");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { data: roundData, error: roundError } = await supabase
      .from("auction_rounds")
      .select(`
        id,
        round_name,
        auction_status,
        total_lots_with_offers,
        total_merchants,
        total_offers,
        created_at
      `)
      .eq("id", roundId)
      .limit(1);

    if (roundError) {
      setErrorMessage(roundError.message);
      setIsLoading(false);
      return;
    }

    if (!roundData || roundData.length === 0) {
      setErrorMessage("ไม่พบข้อมูลรอบประวัตินี้");
      setIsLoading(false);
      return;
    }

    const { data: offerData, error: offerError } = await supabase
      .from("auction_round_offers")
      .select(`
       id,
        auction_round_id,
       lot_number,
        motorcycle_name,
        cost_price,
        merchant_name,
        shop_name,
        phone,
        offer_price,
        submitted_at,
        rank_number,
        is_tied,
        gross_profit
      `)
      .eq("auction_round_id", roundId)
      .order("lot_number", { ascending: true })
      .order("rank_number", { ascending: true })
      .order("offer_price", { ascending: false });

    if (offerError) {
      setErrorMessage(offerError.message);
      setIsLoading(false);
      return;
    }

    setRound(roundData[0] as AuctionRound);
    setOffers((offerData as AuctionRoundOffer[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    checkStaffSession();
  }, []);

  useEffect(() => {
    if (!staffProfile?.id) return;

    loadRoundDetail();
  }, [staffProfile?.id, roundId]);

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

  function formatThaiDateTime(dateInput: string | null) {
    if (!dateInput) return "-";

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

  function formatThaiDateForFileName(dateInput: string | null) {
    const date = dateInput ? new Date(dateInput) : new Date();

    if (Number.isNaN(date.getTime())) {
      return "ไม่ทราบวันที่";
    }

    const year = date.getFullYear() + 543;
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}_${hour}-${minute}`;
  }

  function getThaiAuctionStatus(status: string | null) {
    if (status === "open") return "เปิดรับราคา";
    if (status === "closed") return "ปิดรับราคา";
    if (status === "finished") return "จบรอบแล้ว";
    if (status === "archived") return "บันทึกประวัติแล้ว";
    return "-";
  }

  function getRankText(offer: AuctionRoundOffer) {
    if (offer.is_tied) return `อันดับ ${offer.rank_number} ร่วม`;

    return `อันดับ ${offer.rank_number}`;
  }

  const lotGroups = useMemo(() => {
    const groupMap = new Map<string, LotGroup>();

    offers.forEach((offer) => {
      const key = `${offer.lot_number}-${offer.motorcycle_name}`;

      const existingGroup = groupMap.get(key);

      if (!existingGroup) {
        groupMap.set(key, {
          lot_number: offer.lot_number,
          motorcycle_name: offer.motorcycle_name,
          cost_price: Number(offer.cost_price || 0),
          highest_offer: Number(offer.offer_price || 0),
          gross_profit_from_highest: Number(offer.gross_profit || 0),
          offers: [offer],
        });

        return;
      }

      existingGroup.offers.push(offer);

      if (Number(offer.offer_price || 0) > existingGroup.highest_offer) {
        existingGroup.highest_offer = Number(offer.offer_price || 0);
        existingGroup.gross_profit_from_highest = Number(
          offer.gross_profit || 0
        );
      }
    });

    return Array.from(groupMap.values()).map((group) => ({
      ...group,
      offers: group.offers.sort((a, b) => {
        if (Number(a.rank_number || 0) !== Number(b.rank_number || 0)) {
          return Number(a.rank_number || 0) - Number(b.rank_number || 0);
        }

        return Number(b.offer_price || 0) - Number(a.offer_price || 0);
      }),
    }));
  }, [offers]);

  const topThreeOffers = offers.filter((offer) => {
    return (
      Number(offer.rank_number || 0) >= 1 &&
      Number(offer.rank_number || 0) <= 3
    );
  });

  const totalLots = lotGroups.length;

  function exportExcel() {
    if (!round) {
      alert("ไม่พบข้อมูลรอบประวัติ");
      return;
    }

    if (offers.length === 0) {
      alert("ไม่มีข้อมูลราคาสำหรับดาวน์โหลด");
      return;
    }

    const summaryRows = lotGroups.flatMap((lot) => {
      const rankedOffers = lot.offers.filter((offer) => {
        return (
          Number(offer.rank_number || 0) >= 1 &&
          Number(offer.rank_number || 0) <= 3
        );
      });

      return rankedOffers.map((offer) => ({
        รอบประวัติ: round.round_name,
        Lot: lot.lot_number,
        รายการรถ: lot.motorcycle_name,
        อันดับ: getRankText(offer),
        ชื่อร้าน: offer.shop_name || "-",
        ผู้ติดต่อ: offer.merchant_name || "-",
        เบอร์โทร: offer.phone || "-",
        ราคาเสนอ: Number(offer.offer_price || 0),
        ต้นทุน: Number(offer.cost_price || 0),
        กำไรขั้นต้น: Number(offer.gross_profit || 0),
        วันที่เสนอราคา: formatThaiDateTime(offer.submitted_at),
      }));
    });

    const detailRows = offers.map((offer) => ({
      รอบประวัติ: round.round_name,
      Lot: offer.lot_number,
      รายการรถ: offer.motorcycle_name,
      อันดับ: getRankText(offer),
      ชื่อร้าน: offer.shop_name || "-",
      ผู้ติดต่อ: offer.merchant_name || "-",
      เบอร์โทร: offer.phone || "-",
      ราคาเสนอ: Number(offer.offer_price || 0),
      ต้นทุน: Number(offer.cost_price || 0),
      กำไรขั้นต้น: Number(offer.gross_profit || 0),
      วันที่เสนอราคา: formatThaiDateTime(offer.submitted_at),
    }));

    const infoRows = [
      {
        รายการ: "ชื่อรอบ",
        ข้อมูล: round.round_name,
      },
      {
        รายการ: "วันที่บันทึกประวัติ",
        ข้อมูล: formatThaiDateTime(round.created_at),
      },
      {
        รายการ: "สถานะรอบเสนอราคาตอนบันทึก",
        ข้อมูล: getThaiAuctionStatus(round.auction_status),
      },
      {
        รายการ: "จำนวนล็อตที่มีราคา",
        ข้อมูล: totalLots,
      },
      {
        รายการ: "จำนวนร้านค้า",
        ข้อมูล: round.total_merchants || 0,
      },
      {
        รายการ: "จำนวนราคาเสนอทั้งหมด",
        ข้อมูล: offers.length,
      },
      {
        รายการ: "วันที่ดาวน์โหลด",
        ข้อมูล: formatThaiDateTime(new Date().toISOString()),
      },
    ];

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    const infoSheet = XLSX.utils.json_to_sheet(infoRows);

    XLSX.utils.book_append_sheet(workbook, summarySheet, "สรุปอันดับ 1-3");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "รายละเอียดราคาทั้งหมด");
    XLSX.utils.book_append_sheet(workbook, infoSheet, "ข้อมูลการดาวน์โหลด");

    const fileDate = formatThaiDateForFileName(round.created_at);
    const safeRoundName = round.round_name.replace(/[\\/:*?"<>|]/g, "-");

    XLSX.writeFile(
      workbook,
      `ประวัติรอบเสนอราคา_${safeRoundName}_${fileDate}.xlsx`
    );
  }

  if (isCheckingStaff) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <section className="flex min-h-[300px] w-full max-w-md items-center justify-center rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
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
          <div className="flex min-w-0 items-start gap-3">
            <BackButton href="/admin/history" />

            <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
              รายละเอียดประวัติการเสนอราคา
            </p>

            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {round?.round_name || "ประวัติรอบการเสนอราคา"}
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              เข้าสู่ระบบโดย {staffProfile.email} • {staffProfile.role}
            </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
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

        {isLoading && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-gray-600">กำลังโหลดรายละเอียดประวัติ...</p>
          </div>
        )}

        {!isLoading && round && (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <p className="text-sm font-medium text-gray-500">
                  ล็อตที่มีราคา
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {totalLots.toLocaleString()}
                </p>

                <p className="text-sm text-gray-500">ล็อต</p>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <p className="text-sm font-medium text-gray-500">
                  ราคาทั้งหมด
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {offers.length.toLocaleString()}
                </p>

                <p className="text-sm text-gray-500">รายการ</p>
              </div>

            </section>

            <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    ข้อมูลรอบประวัติ
                  </h2>

                  <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                    <p>
                      <span className="font-semibold">ชื่อรอบ:</span>{" "}
                      {round.round_name}
                    </p>

                    <p>
                      <span className="font-semibold">วันที่บันทึก:</span>{" "}
                      {formatThaiDateTime(round.created_at)}
                    </p>

                    <p>
                      <span className="font-semibold">สถานะตอนบันทึก:</span>{" "}
                      {getThaiAuctionStatus(round.auction_status)}
                    </p>

                    <p>
                      <span className="font-semibold">จำนวนร้านค้า:</span>{" "}
                      {Number(round.total_merchants || 0).toLocaleString()} ร้าน
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={loadRoundDetail}
                    className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                  >
                    โหลดใหม่
                  </button>
                </div>
              </div>
            </section>

            {offers.length === 0 && (
              <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
                <p className="font-semibold text-gray-900">
                  ไม่มีข้อมูลราคาในรอบนี้
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  อาจเป็นรอบที่ถูกบันทึกตอนยังไม่มีราคาเสนอ
                </p>
              </div>
            )}

            {topThreeOffers.length > 0 && (
              <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  สรุปอันดับ 1-3
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  แสดงเฉพาะอันดับ 1 ถึง 3 ของแต่ละล็อต รวมกรณีราคาเท่ากัน
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-100 text-gray-800">
                        <th className="p-3">ล็อต</th>
                        <th className="p-3">รายการรถ</th>
                        <th className="p-3">อันดับ</th>
                        <th className="p-3">ชื่อร้าน</th>
                        <th className="p-3">ผู้ติดต่อ</th>
                        <th className="p-3">เบอร์โทร</th>
                        <th className="p-3">ราคาเสนอ</th>
                        <th className="p-3">ต้นทุน</th>
                        <th className="p-3">กำไรขั้นต้น</th>
                      </tr>
                    </thead>

                    <tbody>
                      {topThreeOffers.map((offer) => (
                        <tr key={offer.id} className="border-b align-top">
                          <td className="p-3 font-semibold text-gray-900">
                            {offer.lot_number}
                          </td>

                          <td className="p-3 text-gray-700">
                            {offer.motorcycle_name}
                          </td>

                          <td className="p-3">
                            <span
                              className={
                                offer.rank_number === 1
                                  ? "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                  : offer.rank_number === 2
                                    ? "inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
                                    : "inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700"
                              }
                            >
                              {getRankText(offer)}
                            </span>
                          </td>

                          <td className="p-3 font-semibold text-gray-900">
                            {offer.shop_name || "-"}
                          </td>

                          <td className="p-3 text-gray-700">
                            {offer.merchant_name || "-"}
                          </td>

                          <td className="p-3 text-gray-700">
                            {offer.phone || "-"}
                          </td>

                          <td className="p-3 font-bold text-green-700">
                            {Number(offer.offer_price || 0).toLocaleString()} บาท
                          </td>

                          <td className="p-3 font-semibold text-orange-700">
                            {Number(offer.cost_price || 0).toLocaleString()} บาท
                          </td>

                          <td
                            className={
                              Number(offer.gross_profit || 0) >= 0
                                ? "p-3 font-bold text-green-700"
                                : "p-3 font-bold text-red-700"
                            }
                          >
                            {Number(offer.gross_profit || 0).toLocaleString()} บาท
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {lotGroups.length > 0 && (
              <section className="mt-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    รายละเอียดราคาแยกตามล็อต
                  </h2>

                  <p className="mt-1 text-sm text-gray-600">
                    แสดงราคาทั้งหมดของรอบประวัตินี้ โดยไม่แสดงรหัสผ่านร้านค้า
                  </p>
                </div>

                {lotGroups.map((lot) => (
                  <article
                    key={`${lot.lot_number}-${lot.motorcycle_name}`}
                    className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                          ล็อต {lot.lot_number}
                        </p>

                        <h3 className="mt-1 text-xl font-bold text-gray-900">
                          {lot.motorcycle_name}
                        </h3>

                        <p className="mt-1 text-sm text-gray-600">
                          มีราคาเสนอทั้งหมด{" "}
                          {lot.offers.length.toLocaleString()} รายการ
                        </p>
                      </div>

                      <div className="grid gap-2 text-right text-sm">
                        <p className="font-semibold text-green-700">
                          ราคาสูงสุด{" "}
                          {Number(lot.highest_offer || 0).toLocaleString()} บาท
                        </p>

                        <p className="font-semibold text-orange-700">
                          ต้นทุน {Number(lot.cost_price || 0).toLocaleString()}{" "}
                          บาท
                        </p>

                        <p
                          className={
                            Number(lot.gross_profit_from_highest || 0) >= 0
                              ? "font-bold text-green-700"
                              : "font-bold text-red-700"
                          }
                        >
                          กำไรขั้นต้น{" "}
                          {Number(
                            lot.gross_profit_from_highest || 0
                          ).toLocaleString()}{" "}
                          บาท
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b bg-gray-100 text-gray-800">
                            <th className="p-3">อันดับ</th>
                            <th className="p-3">ชื่อร้าน</th>
                            <th className="p-3">ผู้ติดต่อ</th>
                            <th className="p-3">เบอร์โทร</th>
                            <th className="p-3">ราคาเสนอ</th>
                            <th className="p-3">ต้นทุน</th>
                            <th className="p-3">กำไรขั้นต้น</th>
                            <th className="p-3">วันที่เสนอ</th>
                          </tr>
                        </thead>

                        <tbody>
                          {lot.offers.map((offer) => (
                            <tr key={offer.id} className="border-b align-top">
                              <td className="p-3">
                                <span
                                  className={
                                    offer.rank_number === 1
                                      ? "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                      : "inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
                                  }
                                >
                                  {getRankText(offer)}
                                </span>
                              </td>

                              <td className="p-3 font-semibold text-gray-900">
                                {offer.shop_name || "-"}
                              </td>

                              <td className="p-3 text-gray-700">
                                {offer.merchant_name || "-"}
                              </td>

                              <td className="p-3 text-gray-700">
                                {offer.phone || "-"}
                              </td>

                              <td className="p-3 font-bold text-green-700">
                                {Number(offer.offer_price || 0).toLocaleString()}{" "}
                                บาท
                              </td>

                              <td className="p-3 font-semibold text-orange-700">
                                {Number(offer.cost_price || 0).toLocaleString()}{" "}
                                บาท
                              </td>

                              <td
                                className={
                                  Number(offer.gross_profit || 0) >= 0
                                    ? "p-3 font-bold text-green-700"
                                    : "p-3 font-bold text-red-700"
                                }
                              >
                                {Number(offer.gross_profit || 0).toLocaleString()}{" "}
                                บาท
                              </td>

                              <td className="p-3 text-gray-700">
                                {formatThaiDateTime(offer.submitted_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

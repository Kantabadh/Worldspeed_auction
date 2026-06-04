"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StaffGuard from "@/components/StaffGuard";
import { getMemoryCachedStaffProfile } from "@/lib/staffSession";

type AdminOffer = {
  id: number;
  merchant_id: number;
  motorcycle_id: number;
  auction_round_id: number | null;
  offer_price: number;
  submitted_at: string;
  was_edited: boolean | null;
  original_offer_price: number | null;
  updated_at: string | null;
  merchants: {
    name: string;
    shop_name: string;
    phone: string;
  } | null;
  motorcycles: {
    id: number;
    lot_number: string;
    motorcycle_name: string;
    cost_price: number | null;
    brand: string | null;
    model: string | null;
    year: string | null;
    license_plate: string | null;
    frame_number: string | null;
    engine_number: string | null;
    purchase_date: string | null;
    acquisition_type: string | null;
    source_name: string | null;
  } | null;
};

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  branch_code?: string | null;
  branch_name?: string | null;
  expiresAt?: number;
};

type LotResult = {
  lotKey: string;
  motorcycle: AdminOffer["motorcycles"];
  offers: AdminOffer[];
  topOffers: AdminOffer[];
  highestPrice: number;
};

type AuditLogInput = {
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
};

type ArchiveResult = {
  roundId: number;
  roundName: string;
  archivedLotCount: number;
  archivedOfferCount: number;
} | null;

type CurrentAuctionRound = {
  id: number;
  round_name: string | null;
  auction_date: string | null;
  status: string | null;
  is_current: boolean | null;
  created_at: string | null;
  opened_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
};

const ADMIN_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const STAFF_TIMEOUT_MS = ADMIN_SESSION_TIMEOUT_MS;

function getStaffRoleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "stock_staff") return "เจ้าหน้าที่รับรถ";
  return role || "-";
}

export default function AdminPage() {
  const cachedStaffProfile = getMemoryCachedStaffProfile();
  const canUseCachedStaffProfile = Boolean(
    cachedStaffProfile &&
      (cachedStaffProfile.role === "owner" || cachedStaffProfile.role === "admin")
  );

  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [totalMotorcycles, setTotalMotorcycles] = useState(0);
  const [pendingMerchantRequests, setPendingMerchantRequests] = useState(0);

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(
    canUseCachedStaffProfile ? (cachedStaffProfile as StaffProfile) : null
  );
  const [isCheckingStaff, setIsCheckingStaff] = useState(
    !canUseCachedStaffProfile
  );

  const [resetPassword, setResetPassword] = useState("");
  const [resetPhrase, setResetPhrase] = useState("");

  const [currentRound, setCurrentRound] = useState<CurrentAuctionRound | null>(
    null
  );
  const [newRoundDate, setNewRoundDate] = useState("");
  const [isRoundUpdating, setIsRoundUpdating] = useState(false);
  const [isRoundRefreshing, setIsRoundRefreshing] = useState(false);

  function saveStaffSession(profile: StaffProfile) {
    const updatedProfile = {
      ...profile,
      expiresAt: Date.now() + STAFF_TIMEOUT_MS,
    };

    localStorage.setItem("staffProfile", JSON.stringify(updatedProfile));
    setStaffProfile(updatedProfile);
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
      .select("id, email, role, active, branch_code, branch_name")
      .eq("id", userData.user.id)
      .eq("active", true)
      .limit(1);

    if (profileError || !profile || profile.length === 0) {
      await logoutStaff();
      return;
    }

    const verifiedProfile: StaffProfile = {
      id: profile[0].id,
      email: profile[0].email,
      role: profile[0].role,
      active: profile[0].active,
      branch_code: profile[0].branch_code,
      branch_name: profile[0].branch_name,
    };

    saveStaffSession(verifiedProfile);

    if (verifiedProfile.role === "stock_staff") {
      window.location.href = "/admin/stock";
      return;
    }

    setIsCheckingStaff(false);
  }

  function refreshStaffActivity() {
    const savedProfileText = localStorage.getItem("staffProfile");

    if (!savedProfileText) return;

    const savedProfile = JSON.parse(savedProfileText) as StaffProfile;
    saveStaffSession(savedProfile);
  }

  useEffect(() => {
    checkStaffSession();
  }, []);

  useEffect(() => {
    if (!staffProfile) return;

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
  }, [staffProfile]);

  async function createAuditLog({
    action,
    targetType,
    targetId,
    targetName,
    details,
  }: AuditLogInput) {
    const { error } = await supabase.from("admin_audit_logs").insert({
      staff_id: staffProfile?.id || null,
      staff_email: staffProfile?.email || null,
      staff_role: staffProfile?.role || null,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      target_name: targetName || null,
      details: details || {},
    });

    if (error) {
      console.error("Audit log error:", error.message);
    }
  }

  async function loadOffers(roundId?: number | null) {
    setIsLoading(true);
    setErrorMessage("");

    if (!roundId) {
      setOffers([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("offers")
      .select(`
        id,
        merchant_id,
        motorcycle_id,
        auction_round_id,
        offer_price,
        submitted_at,
        was_edited,
        original_offer_price,
        updated_at,
        merchants (
          name,
          shop_name,
          phone
        ),
        motorcycles (
          id,
          lot_number,
          motorcycle_name,
          cost_price,
          brand,
          model,
          year,
          license_plate,
          frame_number,
          engine_number,
          purchase_date,
          acquisition_type,
          source_name
        )
      `)
      .eq("auction_round_id", roundId)
      .order("offer_price", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setOffers((data as unknown as AdminOffer[]) || []);
    setIsLoading(false);
  }

  async function loadMotorcycleCounts(roundId?: number | null) {
    if (!roundId) {
      setTotalMotorcycles(0);
      return;
    }

    const { data, error } = await supabase
      .from("motorcycles")
      .select("id")
      .eq("auction_round_id", roundId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const motorcycles = data || [];

    setTotalMotorcycles(motorcycles.length);
  }

  async function loadPendingMerchantRequests() {
    const { data, error } = await supabase
      .from("merchant_accounts")
      .select("id")
      .eq("approval_status", "pending");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setPendingMerchantRequests(data?.length || 0);
  }

  async function loadDashboardData() {
    setIsLoading(true);

    const round = await loadCurrentAuctionRound();

    await Promise.all([
      loadOffers(round?.id || null),
      loadMotorcycleCounts(round?.id || null),
      loadPendingMerchantRequests(),
    ]);
  }

  async function loadCurrentAuctionRound() {
    const { data, error } = await supabase
      .from("auction_rounds")
      .select(
        `
        id,
        round_name,
        auction_date,
        status,
        is_current,
        created_at,
        opened_at,
        closed_at,
        archived_at
      `
      )
      .eq("is_current", true)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      setCurrentRound(null);
      return null;
    }

    const round = (data as CurrentAuctionRound) || null;
    setCurrentRound(round);
    return round;
  }

  async function refreshRoundSection() {
    setIsRoundRefreshing(true);
    setErrorMessage("");

    try {
      await loadCurrentAuctionRound();
    } finally {
      setIsRoundRefreshing(false);
    }
  }

  async function createNewAuctionRound() {
    if (staffProfile?.role !== "owner" && staffProfile?.role !== "admin") {
      setErrorMessage("เฉพาะ Owner/Admin เท่านั้นที่สร้างรอบเสนอราคาได้");
      return;
    }

    if (!newRoundDate) {
      alert("กรุณาเลือกวันที่ประมูล");
      return;
    }

    const [selectedYear, selectedMonth, selectedDay] = newRoundDate
      .split("-")
      .map(Number);
    const selectedDate = new Date(
      selectedYear,
      selectedMonth - 1,
      selectedDay
    );
    const autoRoundName = `รอบวันที่ ${selectedDate.toLocaleDateString(
      "th-TH",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    )}`;

    const confirmCreate = confirm(
      "ต้องการสร้างรอบเสนอราคาใหม่และตั้งเป็นรอบปัจจุบันใช่หรือไม่?"
    );

    if (!confirmCreate) return;

    setIsRoundUpdating(true);
    setErrorMessage("");

    try {
      const { error: clearCurrentError } = await supabase
        .from("auction_rounds")
        .update({
          is_current: false,
        })
        .eq("is_current", true);

      if (clearCurrentError) {
        throw new Error(clearCurrentError.message);
      }

      const { data: roundData, error: createError } = await supabase
        .from("auction_rounds")
        .insert({
          round_name: autoRoundName,
          auction_date: newRoundDate,
          status: "draft",
          is_current: true,
          note: "สร้างเป็นรอบเสนอราคาปัจจุบัน",
        })
        .select("id, round_name")
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      await createAuditLog({
        action: "auction_round_created",
        targetType: "auction_round",
        targetId: roundData?.id ? String(roundData.id) : undefined,
        targetName: roundData?.round_name || autoRoundName,
        details: {
          round_name: autoRoundName,
          auction_date: newRoundDate,
          status: "draft",
          is_current: true,
        },
      });

      setNewRoundDate("");

      await refreshRoundSection();

      alert("สร้างรอบเสนอราคาใหม่เรียบร้อยแล้ว");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "สร้างรอบเสนอราคาไม่สำเร็จ";

      setErrorMessage(message);
    }

    setIsRoundUpdating(false);
  }

  async function updateCurrentRoundStatus(
    newStatus: "draft" | "open" | "closed" | "finished"
  ) {
    if (!currentRound) {
      alert("ยังไม่มีรอบเสนอราคาปัจจุบัน");
      return;
    }

    if (currentRound.status === "finished" || currentRound.status === "archived") {
      alert("รอบนี้จบแล้ว ไม่สามารถเปลี่ยนสถานะได้");
      return;
    }

    if (staffProfile?.role !== "owner" && staffProfile?.role !== "admin") {
      setErrorMessage("เฉพาะ Owner/Admin เท่านั้นที่เปลี่ยนสถานะรอบได้");
      return;
    }

    if (newStatus === "finished" && currentRound.status !== "closed") {
      alert("ต้องปิดรอบก่อนจบรอบประมูล");
      return;
    }

    const confirmUpdate =
      newStatus === "finished"
        ? confirm("ยืนยันจบรอบประมูลนี้?")
        : confirm(
            `ต้องการเปลี่ยนสถานะรอบนี้เป็น "${getRoundStatusLabel(newStatus)}" ใช่หรือไม่?`
          );

    if (!confirmUpdate) return;

    setIsRoundUpdating(true);
    setErrorMessage("");

    try {
      const updatePayload: {
        status: string;
        is_current: boolean;
        opened_at?: string | null;
        closed_at?: string | null;
      } = {
        status: newStatus,
        is_current: true,
      };

      if (newStatus === "open") {
        updatePayload.opened_at = new Date().toISOString();
        updatePayload.closed_at = null;
      }

      if (newStatus === "closed") {
        updatePayload.closed_at = new Date().toISOString();
      }

      if (newStatus === "finished" && !currentRound.closed_at) {
        updatePayload.closed_at = new Date().toISOString();
      }

      const { error: roundError } = await supabase
        .from("auction_rounds")
        .update(updatePayload)
        .eq("id", currentRound.id);

      if (roundError) {
        throw new Error(roundError.message);
      }

      if (newStatus === "open" || newStatus === "closed") {
        const { error: settingError } = await supabase
          .from("auction_settings")
          .update({
            status: newStatus === "open" ? "open" : "closed",
          })
          .eq("auction_name", "Main Motorcycle Auction");

        if (settingError) {
          throw new Error(settingError.message);
        }
      }

      await createAuditLog({
        action: "auction_round_status_changed",
        targetType: "auction_round",
        targetId: String(currentRound.id),
        targetName: currentRound.round_name || `รอบ #${currentRound.id}`,
        details: {
          old_status: currentRound.status,
          new_status: newStatus,
          old_status_thai: getRoundStatusLabel(currentRound.status),
          new_status_thai: getRoundStatusLabel(newStatus),
        },
      });

      await refreshRoundSection();

      alert(`เปลี่ยนสถานะเป็น ${getRoundStatusLabel(newStatus)} แล้ว`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "เปลี่ยนสถานะรอบไม่สำเร็จ";

      setErrorMessage(message);
    }

    setIsRoundUpdating(false);
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const groupedLots = offers.reduce((summary, offer) => {
    const lotKey =
      offer.motorcycles?.id?.toString() ||
      offer.motorcycles?.lot_number ||
      `unknown-${offer.id}`;

    if (!summary[lotKey]) {
      summary[lotKey] = {
        lotKey,
        motorcycle: offer.motorcycles,
        offers: [],
        topOffers: [],
        highestPrice: 0,
      };
    }

    summary[lotKey].offers.push(offer);

    return summary;
  }, {} as Record<string, LotResult>);

  const lotResults = Object.values(groupedLots)
    .map((lot) => {
      const sortedOffers = [...lot.offers].sort(
        (a, b) => Number(b.offer_price) - Number(a.offer_price)
      );

      const highestPrice =
        sortedOffers.length > 0 ? Number(sortedOffers[0].offer_price) : 0;

      const topOffers = sortedOffers.filter(
        (offer) => Number(offer.offer_price) === highestPrice
      );

      return {
        ...lot,
        offers: sortedOffers,
        topOffers,
        highestPrice,
      };
    })
    .sort((a, b) => {
      const lotA = a.motorcycle?.lot_number || "";
      const lotB = b.motorcycle?.lot_number || "";

      return lotA.localeCompare(lotB);
    });

  const uniqueMerchants = new Set(
    offers.map((offer) => offer.merchants?.phone).filter(Boolean)
  );

  const uniqueMotorcycles = new Set(
    offers.map((offer) => offer.motorcycles?.id).filter(Boolean)
  );

  const totalHighestOfferValue = lotResults.reduce((sum, lot) => {
    return sum + Number(lot.highestPrice || 0);
  }, 0);

  const totalCostForSubmittedLots = lotResults.reduce((sum, lot) => {
    return sum + Number(lot.motorcycle?.cost_price || 0);
  }, 0);

  const totalGrossProfit = totalHighestOfferValue - totalCostForSubmittedLots;

  function getRoundStatusLabel(status?: string | null) {
    if (status === "draft" || status === "prepared" || status === "preparing") {
      return "เตรียมรอบ";
    }
    if (status === "open") return "เปิดรับราคา";
    if (status === "closed") return "ปิดรับราคา";
    if (status === "finished") return "จบรอบแล้ว";
    if (status === "archived") return "บันทึกประวัติแล้ว";
    return status || "-";
  }

  function getRoundStatusBadgeClass(status?: string | null) {
    if (status === "draft" || status === "prepared" || status === "preparing") {
      return "bg-gray-100 text-gray-900 ring-gray-200";
    }

    if (status === "open") {
      return "bg-blue-50 text-blue-700 ring-blue-200";
    }

    if (status === "closed") {
      return "bg-red-50 text-red-700 ring-red-200";
    }

    if (status === "finished") {
      return "bg-purple-50 text-purple-700 ring-purple-200";
    }

    return "bg-gray-100 text-gray-700 ring-gray-200";
  }

  function formatThaiDate(dateInput: string | Date) {
    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }

    return chunks;
  }

  async function archiveCurrentAuctionBeforeReset(): Promise<ArchiveResult> {
    if (!currentRound || totalMotorcycles === 0) {
      return null;
    }

    const { data, error } = await supabase.rpc("archive_current_auction", {
      p_email: staffProfile?.email || null,
      p_role: staffProfile?.role || null,
      p_note: "บันทึกจากหน้า Admin Dashboard",
    });

    if (error) {
      throw new Error(error.message);
    }

    const archiveRow = Array.isArray(data) ? data[0] : data;

    if (!archiveRow) {
      throw new Error("บันทึกประวัติไม่สำเร็จ: ไม่พบข้อมูลที่ส่งกลับจากฐานข้อมูล");
    }

    return {
      roundId: Number(archiveRow.round_id),
      roundName: String(archiveRow.round_name || "รอบเสนอราคา"),
      archivedLotCount: Number(archiveRow.archived_lot_count || 0),
      archivedOfferCount: Number(archiveRow.archived_offer_count || 0),
    };
  }

  async function archiveCurrentAuctionOnly() {
    if (staffProfile?.role !== "owner") {
      setErrorMessage("เฉพาะบัญชี Owner เท่านั้นที่บันทึกประวัติรอบได้");
      return;
    }

    if (offers.length === 0) {
      alert("ยังไม่มีข้อมูลเสนอราคาให้บันทึกประวัติ");
      return;
    }

    const confirmArchive = confirm(
      "ต้องการบันทึกประวัติรอบเสนอราคาปัจจุบันใช่หรือไม่? ระบบจะยังไม่ล้างข้อมูลปัจจุบัน"
    );

    if (!confirmArchive) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const archiveResult = await archiveCurrentAuctionBeforeReset();

      await createAuditLog({
        action: "auction_archived_only",
        targetType: "auction_round",
        targetId: archiveResult ? String(archiveResult.roundId) : undefined,
        targetName: archiveResult?.roundName || "รอบเสนอราคา",
        details: {
          archived_round_id: archiveResult?.roundId || null,
          archived_round_name: archiveResult?.roundName || null,
          archived_lot_count: archiveResult?.archivedLotCount || 0,
          archived_offer_count: archiveResult?.archivedOfferCount || 0,
          total_lots_with_offers: uniqueMotorcycles.size,
          total_merchants: uniqueMerchants.size,
          total_offers: offers.length,
          total_highest_value: totalHighestOfferValue,
          total_cost: totalCostForSubmittedLots,
          total_gross_profit: totalGrossProfit,
          reset_after_archive: false,
        },
      });

      alert(
        `บันทึกประวัติเรียบร้อยแล้ว\n${
          archiveResult?.roundName || ""
        }\nจำนวน Lot: ${
          archiveResult?.archivedLotCount || 0
        }\nจำนวนราคาเสนอ: ${archiveResult?.archivedOfferCount || 0}`
      );

      await loadDashboardData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดระหว่างบันทึกประวัติ";

      setErrorMessage(message);
      setIsLoading(false);
    }
  }

  async function resetAuctionData() {
    if (staffProfile?.role !== "owner") {
      setErrorMessage("เฉพาะบัญชี Owner เท่านั้นที่ล้างข้อมูลได้");
      return;
    }

    if (!staffProfile?.email) {
      setErrorMessage("ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่");
      return;
    }

    if (!resetPassword) {
      alert("กรุณาใส่รหัสผ่าน Owner ก่อนล้างข้อมูล");
      return;
    }

    if (resetPhrase !== "RESET AUCTION") {
      alert('กรุณาพิมพ์ให้ตรงว่า "RESET AUCTION"');
      return;
    }

    const confirmReset = confirm(
  `ต้องการบันทึกประวัติรอบนี้ แล้วล้างข้อมูลรอบเสนอราคาปัจจุบันใช่หรือไม่?

ระบบจะเก็บประวัติก่อน แล้วล้างราคา รายการส่งราคา และรายการรถในรอบเสนอราคาปัจจุบัน

ระบบจะไม่ลบบัญชีร้านค้า บัญชีแอดมิน คลังรถ และประวัติรอบเก่า`
);

    if (!confirmReset) return;

    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: staffProfile.email,
      password: resetPassword,
    });

    if (passwordError) {
      setErrorMessage("รหัสผ่านไม่ถูกต้อง ยกเลิกการล้างข้อมูล");
      setResetPassword("");
      return;
    }

    const secondConfirm = confirm(
      "ยืนยันครั้งสุดท้าย: ระบบจะบันทึกประวัติรอบนี้ก่อน แล้วจึงล้างรอบเสนอราคาปัจจุบัน ต้องการทำต่อหรือไม่?"
    );

    if (!secondConfirm) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const archiveResult = await archiveCurrentAuctionBeforeReset();
      const now = new Date().toISOString();

      const { error: clearStockLinkError } = await supabase
        .from("stock_motorcycles")
        .update({
          current_auction_motorcycle_id: null,
          current_auction_round_id: null,
          updated_at: now,
        })
        .not("current_auction_motorcycle_id", "is", null);

      if (clearStockLinkError) {
        throw new Error(`ล้างลิงก์รถในคลังไม่สำเร็จ: ${clearStockLinkError.message}`);
      }

      const { error: clearStockStatusError } = await supabase
        .from("stock_motorcycles")
        .update({
          stock_status: "ready_to_sell",
          updated_at: now,
        })
        .eq("stock_status", "in_auction");

      if (clearStockStatusError) {
        throw new Error(`อัปเดตสถานะรถในคลังไม่สำเร็จ: ${clearStockStatusError.message}`);
      }

      const { error: permissionsError } = await supabase
        .from("merchant_lot_edit_permissions")
        .delete()
        .not("id", "is", null);

      if (permissionsError) {
        throw new Error(`ล้างสิทธิ์แก้ไขราคาไม่สำเร็จ: ${permissionsError.message}`);
      }

      const { error: offersError } = await supabase
        .from("offers")
        .delete()
        .not("id", "is", null);

      if (offersError) {
        throw new Error(`ล้างราคาเสนอไม่สำเร็จ: ${offersError.message}`);
      }

      const { error: merchantsError } = await supabase
        .from("merchants")
        .delete()
        .not("id", "is", null);

      if (merchantsError) {
        throw new Error(`ล้างรายการส่งราคาของร้านค้าไม่สำเร็จ: ${merchantsError.message}`);
      }

      const { error: motorcyclePhotosError } = await supabase
        .from("motorcycle_photos")
        .delete()
        .not("id", "is", null);

      if (motorcyclePhotosError) {
        throw new Error(`ล้างรูปรายการรถในรอบเสนอราคาไม่สำเร็จ: ${motorcyclePhotosError.message}`);
      }

      const { error: motorcyclesError } = await supabase
        .from("motorcycles")
        .delete()
        .not("id", "is", null);

      if (motorcyclesError) {
        throw new Error(`ล้างรายการรถในรอบเสนอราคาไม่สำเร็จ: ${motorcyclesError.message}`);
      }

      const { error: merchantAccountResetError } = await supabase
        .from("merchant_accounts")
        .update({
          can_edit_submission: false,
        })
        .not("id", "is", null);

      if (merchantAccountResetError) {
        throw new Error(
          `รีเซ็ตสถานะบัญชีร้านค้าไม่สำเร็จ: ${merchantAccountResetError.message}`
        );
      }

      const { error: auctionSettingError } = await supabase
        .from("auction_settings")
        .update({
          status: "closed",
        })
        .not("id", "is", null);

      if (auctionSettingError) {
        throw new Error(`ปิดรอบเสนอราคาไม่สำเร็จ: ${auctionSettingError.message}`);
      }

      if (currentRound) {
        await supabase
          .from("auction_rounds")
          .update({
            status: "closed",
            closed_at: now,
          })
          .eq("id", currentRound.id);
      }

      await createAuditLog({
        action: archiveResult ? "auction_reset_archived" : "auction_reset_empty",
        targetType: archiveResult ? "auction_round" : "auction",
        targetId: archiveResult
          ? String(archiveResult.roundId)
          : "Main Motorcycle Auction",
        targetName: archiveResult
          ? archiveResult.roundName
          : "รอบเสนอราคาหลัก",
        details: {
          archived_round_id: archiveResult?.roundId || null,
          archived_round_name: archiveResult?.roundName || null,
          archived_lot_count: archiveResult?.archivedLotCount || 0,
          archived_offer_count: archiveResult?.archivedOfferCount || 0,
          total_lots_with_offers_before_reset: uniqueMotorcycles.size,
          total_merchants_before_reset: uniqueMerchants.size,
          total_offers_before_reset: offers.length,
          total_highest_value_before_reset: totalHighestOfferValue,
          total_cost_before_reset: totalCostForSubmittedLots,
          total_gross_profit_before_reset: totalGrossProfit,
          cleared_current_offers: true,
          cleared_current_merchant_submissions: true,
          cleared_current_lot_edit_permissions: true,
          cleared_current_auction_motorcycles: true,
          cleared_current_auction_photos: true,
          kept_merchant_accounts: true,
          kept_staff_accounts: true,
          kept_stock_motorcycles: true,
          kept_archive_history: true,
          auction_status_after_reset: "closed",
        },
      });

      setResetPassword("");
      setResetPhrase("");

      alert(
        archiveResult
          ? `บันทึกประวัติและล้างรอบเสนอราคาปัจจุบันเรียบร้อยแล้ว
${archiveResult.roundName}
Lot ที่บันทึก: ${archiveResult.archivedLotCount}
ราคาเสนอที่บันทึก: ${archiveResult.archivedOfferCount}`
          : "ล้างรอบเสนอราคาปัจจุบันเรียบร้อยแล้ว"
      );

      await loadDashboardData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดระหว่างบันทึกประวัติและล้างข้อมูล";

      setErrorMessage(message);
      setIsLoading(false);
    }
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
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
              ระบบเสนอราคารถจักรยานยนต์
            </h1>

            <p className="mt-1 truncate text-xs text-gray-600 sm:text-sm">
              เข้าสู่ระบบโดย {staffProfile.email} •{" "}
              {getStaffRoleLabel(staffProfile.role)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshRoundSection}
              disabled={isRoundRefreshing}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {isRoundRefreshing ? "กำลังโหลด..." : "โหลดใหม่"}
            </button>

            <button
              onClick={logoutStaff}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-semibold">เกิดข้อผิดพลาด</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        {pendingMerchantRequests > 0 && (
          <section className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide sm:text-sm">
                  ร้านค้ารออนุมัติ
                </p>

                <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                  มีร้านค้ารออนุมัติ {pendingMerchantRequests} ราย
                </h2>
              </div>

              <a
                href="/admin/merchants"
                className="rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white shadow hover:bg-red-700"
              >
                ตรวจสอบ
              </a>
            </div>
          </section>
        )}


        <section className="mb-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                รอบเสนอราคาปัจจุบัน
              </h2>
            </div>

          </div>

          {currentRound ? (
            <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">ชื่อรอบ</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {currentRound.round_name || `รอบ #${currentRound.id}`}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-sm text-gray-500">สถานะรอบ</p>
                  <p
                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ${getRoundStatusBadgeClass(
                      currentRound.status
                    )}`}
                  >
                    {getRoundStatusLabel(currentRound.status)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateCurrentRoundStatus("draft")}
                  disabled={isRoundUpdating}
                  className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
                >
                  เตรียมรอบ
                </button>

                <button
                  type="button"
                  onClick={() => updateCurrentRoundStatus("open")}
                  disabled={isRoundUpdating}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
                >
                  เปิดรอบ
                </button>

                <button
                  type="button"
                  onClick={() => updateCurrentRoundStatus("closed")}
                  disabled={isRoundUpdating}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-gray-400"
                >
                  ปิดรอบ
                </button>

                <button
                  type="button"
                  onClick={() => updateCurrentRoundStatus("finished")}
                  disabled={isRoundUpdating || currentRound.status !== "closed"}
                  className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:bg-gray-400"
                >
                  จบรอบประมูล
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
              <p className="font-bold">ยังไม่มีรอบเสนอราคาปัจจุบัน</p>
              <p className="mt-1 text-sm">
                สร้างรอบใหม่ก่อน แล้วค่อยนำรถจากคลังเข้าสู่รอบนั้น
              </p>
            </div>
          )}

          <div className="mt-4 rounded-2xl border bg-white p-3 sm:p-4">
            <h3 className="font-bold text-gray-900">สร้างรอบเสนอราคาใหม่</h3>

            <div className="mt-2 grid gap-3 md:grid-cols-[220px_auto] md:items-end">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  วันที่ประมูล
                </label>

                <input
                  type="date"
                  className="mt-2 w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  value={newRoundDate}
                  onChange={(event) => setNewRoundDate(event.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={createNewAuctionRound}
                disabled={isRoundUpdating}
                className="w-full rounded-xl bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400 md:w-auto"
              >
                สร้างรอบใหม่
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <h3 className="font-bold text-gray-900">เตรียมก่อนประมูล</h3>

              <div className="mt-3 grid gap-3">
                <a
                  href="/admin/stock"
                  className="rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  เพิ่มรถเข้าคลังสาขา
                </a>

                <a
                  href="/admin/stock/branch"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                >
                  คลังสาขา
                </a>

                {staffProfile?.role !== "stock_staff" && (
                  <a
                    href="/admin/stock-list"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    คลังกลาง
                  </a>
                )}

                <a
                  href="/admin/motorcycles"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                >
                  รายการรถในรอบประมูล
                </a>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <h3 className="font-bold text-gray-900">ระหว่างเสนอราคา / จบรอบ</h3>

              <div className="mt-3 grid gap-3">
                <a
                  href="/admin/rounds"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                >
                  จัดการรอบปัจจุบัน
                </a>

                <a
                  href="/admin/merchants"
                  className="relative rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                >
                  ร้านค้า

                  {pendingMerchantRequests > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                      {pendingMerchantRequests}
                    </span>
                  )}
                </a>

                <a
                  href="/admin/merchant-receipts"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                >
                  พิมพ์ใบเสนอราคา
                </a>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <h3 className="font-bold text-gray-900">ประวัติและระบบ</h3>

              <div className="mt-3 grid gap-3">
                <a
                  href="/admin/history"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                >
                  ประวัติรอบเสนอราคา
                </a>

                <a
                  href="/admin/audit-logs"
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                >
                  ประวัติการทำงาน
                </a>

                {staffProfile?.role === "owner" && (
                  <a
                    href="/admin/staff"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800 shadow-sm hover:border-gray-300 hover:bg-gray-50"
                  >
                    ตั้งค่า Owner
                  </a>
                )}

              </div>
            </div>
          </div>
        </section>

        {isLoading && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        )}

      </section>
      </main>
    </StaffGuard>
  );
}

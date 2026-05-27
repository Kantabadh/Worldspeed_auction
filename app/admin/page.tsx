"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

type AdminOffer = {
  id: number;
  merchant_id: number;
  motorcycle_id: number;
  offer_price: number;
  submitted_at: string;
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
  expiresAt?: number;
};

type LotResult = {
  lotKey: string;
  motorcycle: AdminOffer["motorcycles"];
  offers: AdminOffer[];
  topOffers: AdminOffer[];
  highestPrice: number;
};

type StockMotorcycleSummary = {
  id: number;
  cost_price: number | null;
  stock_status: string;
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
  archivedOfferCount: number;
} | null;

const STAFF_TIMEOUT_MS = 10 * 60 * 1000;

function getStaffRoleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "stock_staff") return "เจ้าหน้าที่รับรถ";
  return role || "-";
}

export default function AdminPage() {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [totalMotorcycles, setTotalMotorcycles] = useState(0);
  const [activeMotorcycles, setActiveMotorcycles] = useState(0);
  const [pendingMerchantRequests, setPendingMerchantRequests] = useState(0);

  const [totalStockMotorcycles, setTotalStockMotorcycles] = useState(0);
  const [readyStockMotorcycles, setReadyStockMotorcycles] = useState(0);
  const [inAuctionStockMotorcycles, setInAuctionStockMotorcycles] = useState(0);
  const [soldStockMotorcycles, setSoldStockMotorcycles] = useState(0);
  const [totalStockCost, setTotalStockCost] = useState(0);

  const [auctionStatus, setAuctionStatus] = useState("open");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isCheckingStaff, setIsCheckingStaff] = useState(true);

  const [resetPassword, setResetPassword] = useState("");
  const [resetPhrase, setResetPhrase] = useState("");

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
      .select("id, email, role, active")
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

  async function loadAuctionStatus() {
    const { data, error } = await supabase
      .from("auction_settings")
      .select("id, status")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (!data) {
      setErrorMessage("ไม่พบสถานะการเสนอราคา");
      return;
    }

    setAuctionStatus(data.status);
  }

  async function toggleAuctionStatus() {
    setIsUpdatingStatus(true);
    setErrorMessage("");

    const oldStatus = auctionStatus;
    const newStatus = auctionStatus === "open" ? "closed" : "open";

    const { error } = await supabase
      .from("auction_settings")
      .update({ status: newStatus })
      .eq("auction_name", "Main Motorcycle Auction");

    if (error) {
      setErrorMessage(error.message);
      setIsUpdatingStatus(false);
      return;
    }

    await createAuditLog({
      action: "auction_status_changed",
      targetType: "auction",
      targetId: "Main Motorcycle Auction",
      targetName: "Main Motorcycle Auction",
      details: {
        old_status: oldStatus,
        new_status: newStatus,
        old_status_thai: getThaiAuctionStatus(oldStatus),
        new_status_thai: getThaiAuctionStatus(newStatus),
      },
    });

    setAuctionStatus(newStatus);
    setIsUpdatingStatus(false);
  }

  async function loadOffers() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("offers")
      .select(`
        id,
        merchant_id,
        motorcycle_id,
        offer_price,
        submitted_at,
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
      .order("offer_price", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setOffers((data as unknown as AdminOffer[]) || []);
    setIsLoading(false);
  }

  async function loadMotorcycleCounts() {
    const { data, error } = await supabase
      .from("motorcycles")
      .select("id, active");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const motorcycles = data || [];

    setTotalMotorcycles(motorcycles.length);
    setActiveMotorcycles(
      motorcycles.filter((motorcycle) => motorcycle.active).length
    );
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

  async function loadStockSummary() {
    const { data, error } = await supabase
      .from("stock_motorcycles")
      .select("id, cost_price, stock_status");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const stockMotorcycles = (data as StockMotorcycleSummary[]) || [];

    setTotalStockMotorcycles(stockMotorcycles.length);

    setReadyStockMotorcycles(
      stockMotorcycles.filter(
        (motorcycle) => motorcycle.stock_status === "ready_to_sell"
      ).length
    );

    setInAuctionStockMotorcycles(
      stockMotorcycles.filter(
        (motorcycle) => motorcycle.stock_status === "in_auction"
      ).length
    );

    setSoldStockMotorcycles(
      stockMotorcycles.filter(
        (motorcycle) => motorcycle.stock_status === "sold"
      ).length
    );

    const totalCost = stockMotorcycles.reduce((sum, motorcycle) => {
      return sum + Number(motorcycle.cost_price || 0);
    }, 0);

    setTotalStockCost(totalCost);
  }

  async function loadDashboardData() {
    await Promise.all([
      loadAuctionStatus(),
      loadOffers(),
      loadMotorcycleCounts(),
      loadPendingMerchantRequests(),
      loadStockSummary(),
    ]);
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

  function getOfferGroupsByPrice(offerList: AdminOffer[]) {
    const sortedOffers = [...offerList].sort(
      (a, b) => Number(b.offer_price) - Number(a.offer_price)
    );

    const groups: AdminOffer[][] = [];

    sortedOffers.forEach((offer) => {
      const lastGroup = groups[groups.length - 1];

      if (
        lastGroup &&
        Number(lastGroup[0].offer_price) === Number(offer.offer_price)
      ) {
        lastGroup.push(offer);
      } else {
        groups.push([offer]);
      }
    });

    return groups;
  }

  function getGroupText(group?: AdminOffer[]) {
    if (!group || group.length === 0) return "";

    return group
      .map((offer) => {
        const shop = offer.merchants?.shop_name || "-";
        const contact = offer.merchants?.name || "-";
        const phone = offer.merchants?.phone || "-";

        return `${shop} (${contact}, ${phone})`;
      })
      .join(" / ");
  }

  function getGroupPrice(group?: AdminOffer[]) {
    if (!group || group.length === 0) return "";

    return Number(group[0].offer_price || 0);
  }

  function getGrossProfit(price: number | string, cost: number) {
    const numericPrice = Number(price || 0);

    if (!numericPrice) return "";

    return numericPrice - cost;
  }

  function getTieNote(groups: AdminOffer[][]) {
    const notes = groups
      .slice(0, 3)
      .map((group, index) => {
        if (group.length >= 2) {
          return `อันดับ ${index + 1} ร่วม ${group.length} ราย`;
        }

        return "";
      })
      .filter(Boolean);

    return notes.join(" / ");
  }

  function getThaiAuctionStatus(status: string) {
    if (status === "open") return "เปิดรับราคา";
    if (status === "closed") return "ปิดรับราคา";
    return status || "-";
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

  function formatThaiTime(dateInput: string | Date) {
    const date = new Date(dateInput);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function formatExcelFileDateTime(dateInput: Date) {
    const buddhistYear = dateInput.getFullYear() + 543;
    const month = String(dateInput.getMonth() + 1).padStart(2, "0");
    const day = String(dateInput.getDate()).padStart(2, "0");
    const hour = String(dateInput.getHours()).padStart(2, "0");
    const minute = String(dateInput.getMinutes()).padStart(2, "0");

    return `${buddhistYear}-${month}-${day}_${hour}-${minute}`;
  }

  function chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }

    return chunks;
  }

  async function archiveCurrentAuctionBeforeReset(): Promise<ArchiveResult> {
    if (offers.length === 0) {
      return null;
    }

    const archiveDate = new Date();
    const roundName = `รอบวันที่ ${formatThaiDate(
      archiveDate
    )} เวลา ${formatThaiTime(archiveDate)}`;

    const { data: roundData, error: roundError } = await supabase
      .from("auction_rounds")
      .insert({
        round_name: roundName,
        auction_status: auctionStatus,
        exported_by_email: staffProfile?.email || null,
        created_by_email: staffProfile?.email || null,
        total_lots_with_offers: uniqueMotorcycles.size,
        total_merchants: uniqueMerchants.size,
        total_offers: offers.length,
        total_highest_value: totalHighestOfferValue,
        total_cost: totalCostForSubmittedLots,
        total_gross_profit: totalGrossProfit,
      })
      .select("id")
      .single();

    if (roundError || !roundData) {
      throw new Error(
        roundError?.message || "ไม่สามารถสร้างประวัติรอบการเสนอราคาได้"
      );
    }

    const archiveRows = lotResults.flatMap((lot) => {
      const groups = getOfferGroupsByPrice(lot.offers);
      const cost = Number(lot.motorcycle?.cost_price || 0);

      return groups.flatMap((group, groupIndex) => {
        const rankNumber = groupIndex + 1;
        const isTied = group.length >= 2;

        return group.map((offer) => ({
          auction_round_id: roundData.id,

          original_offer_id: Number(offer.id),
          original_merchant_id: Number(offer.merchant_id),
          original_motorcycle_id: Number(offer.motorcycle_id),

          lot_number: lot.motorcycle?.lot_number || "",
          motorcycle_name: lot.motorcycle?.motorcycle_name || "",
          cost_price: cost,

          merchant_name: offer.merchants?.name || "",
          shop_name: offer.merchants?.shop_name || "",
          phone: offer.merchants?.phone || "",

          offer_price: Number(offer.offer_price || 0),
          submitted_at: offer.submitted_at,
          rank_number: rankNumber,
          is_tied: isTied,
          gross_profit: Number(offer.offer_price || 0) - cost,
        }));
      });
    });

    const chunks = chunkArray(archiveRows, 500);

    for (const chunk of chunks) {
      const { error: archiveOffersError } = await supabase
        .from("auction_round_offers")
        .insert(chunk);

      if (archiveOffersError) {
        throw new Error(archiveOffersError.message);
      }
    }

    return {
      roundId: Number(roundData.id),
      roundName,
      archivedOfferCount: archiveRows.length,
    };
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
      "ต้องการบันทึกประวัติรอบนี้ แล้วล้างข้อมูลการเสนอราคาปัจจุบันใช่หรือไม่? ระบบจะเก็บประวัติราคาไว้ก่อน จากนั้นจะลบราคาและรายการส่งราคาปัจจุบัน แต่จะไม่ลบรายการรถ รูปภาพ บัญชีร้านค้า และบัญชีแอดมิน"
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
      "ยืนยันครั้งสุดท้าย: ระบบจะบันทึกประวัติรอบนี้ก่อน แล้วจึงล้างข้อมูลปัจจุบัน ต้องการทำต่อหรือไม่?"
    );

    if (!secondConfirm) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const archiveResult = await archiveCurrentAuctionBeforeReset();

      const { error: offersError } = await supabase
        .from("offers")
        .delete()
        .neq("id", 0);

      if (offersError) {
        throw new Error(offersError.message);
      }

      const { error: merchantsError } = await supabase
        .from("merchants")
        .delete()
        .neq("id", 0);

      if (merchantsError) {
        throw new Error(merchantsError.message);
      }

      const { error: permissionsError } = await supabase
        .from("merchant_lot_edit_permissions")
        .delete()
        .neq("id", 0);

      if (permissionsError) {
        throw new Error(permissionsError.message);
      }

      await createAuditLog({
        action: archiveResult
          ? "auction_reset_archived"
          : "auction_reset_empty",
        targetType: archiveResult ? "auction_round" : "auction",
        targetId: archiveResult
          ? String(archiveResult.roundId)
          : "Main Motorcycle Auction",
        targetName: archiveResult
          ? archiveResult.roundName
          : "Main Motorcycle Auction",
        details: {
          archived_round_id: archiveResult?.roundId || null,
          archived_round_name: archiveResult?.roundName || null,
          archived_offer_count: archiveResult?.archivedOfferCount || 0,
          total_lots_with_offers_before_reset: uniqueMotorcycles.size,
          total_merchants_before_reset: uniqueMerchants.size,
          total_offers_before_reset: offers.length,
          total_highest_value_before_reset: totalHighestOfferValue,
          total_cost_before_reset: totalCostForSubmittedLots,
          total_gross_profit_before_reset: totalGrossProfit,
          deleted_current_offers: true,
          deleted_current_merchant_submissions: true,
          deleted_current_lot_edit_permissions: true,
        },
      });

      setResetPassword("");
      setResetPhrase("");

      alert("บันทึกประวัติรอบนี้และล้างข้อมูลปัจจุบันเรียบร้อยแล้ว");

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

  function getMerchantKey(offer: AdminOffer) {
    return (
      offer.merchants?.phone ||
      offer.merchants?.shop_name ||
      offer.merchants?.name ||
      `merchant-${offer.merchant_id}`
    );
  }

  function getMerchantLabel(offer: AdminOffer) {
    return (
      offer.merchants?.shop_name ||
      offer.merchants?.name ||
      offer.merchants?.phone ||
      `ร้านค้า ${offer.merchant_id}`
    );
  }

  function getUniqueMerchantColumns() {
    const merchantMap = new Map<string, string>();
    const usedLabels = new Map<string, number>();

    offers.forEach((offer) => {
      const key = getMerchantKey(offer);
      const baseLabel = getMerchantLabel(offer);

      if (merchantMap.has(key)) return;

      const usedCount = usedLabels.get(baseLabel) || 0;
      usedLabels.set(baseLabel, usedCount + 1);

      const label =
        usedCount === 0 ? baseLabel : `${baseLabel} (${usedCount + 1})`;

      merchantMap.set(key, label);
    });

    return Array.from(merchantMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"));
  }

  function getShopOnlyText(group?: AdminOffer[]) {
    if (!group || group.length === 0) return "";

    return group
      .map((offer) => offer.merchants?.shop_name || offer.merchants?.name || "-")
      .join(" / ");
  }

  function getRankText(group?: AdminOffer[]) {
    if (!group || group.length === 0) return "";

    const price = Number(group[0].offer_price || 0).toLocaleString();

    return group
      .map((offer) => {
        const shop = offer.merchants?.shop_name || offer.merchants?.name || "-";
        return `${shop} ${price}`;
      })
      .join(" / ");
  }

  function exportAuctionExcel() {
    const exportDate = new Date();
    const exportFileDateTime = formatExcelFileDateTime(exportDate);

    const merchantColumns = getUniqueMerchantColumns();

    const headers = [
      "ลำดับ",
      "ยี่ห้อ",
      "รุ่น",
      "รหัสรุ่น",
      "เลขถัง",
      "ทะเบียน",
      "วันจดทะเบียน",
      "ปี",
      "ซื้อ/เทิร์น",
      "มาจาก",
      "ทุน",
      ...merchantColumns.map((merchant) => merchant.label),
      "MAX",
      "WINNER",
      "อันดับ 2",
      "diff",
    ];

    const rows = lotResults.map((lot, index) => {
      const motorcycle = lot.motorcycle;
      const cost = Number(motorcycle?.cost_price || 0);
      const groups = getOfferGroupsByPrice(lot.offers);

      const rank1 = groups[0];
      const rank2 = groups[1];

      const row: (string | number)[] = [
        index + 1,
        motorcycle?.brand || "",
        motorcycle?.model || motorcycle?.motorcycle_name || "",
        motorcycle?.engine_number || "",
        motorcycle?.frame_number || "",
        motorcycle?.license_plate || "",
        motorcycle?.purchase_date ? formatThaiDate(motorcycle.purchase_date) : "",
        motorcycle?.year || "",
        motorcycle?.acquisition_type || "",
        motorcycle?.source_name || "",
        cost || "",
      ];

      merchantColumns.forEach((merchant) => {
        const merchantOffers = lot.offers.filter(
          (offer) => getMerchantKey(offer) === merchant.key
        );

        if (merchantOffers.length === 0) {
          row.push("");
          return;
        }

        const highestMerchantOffer = merchantOffers.reduce(
          (bestOffer, offer) => {
            return Number(offer.offer_price || 0) >
              Number(bestOffer.offer_price || 0)
              ? offer
              : bestOffer;
          },
          merchantOffers[0]
        );

        row.push(Number(highestMerchantOffer.offer_price || 0));
      });

      row.push(lot.highestPrice || "");
      row.push(getShopOnlyText(rank1));
      row.push(getRankText(rank2));
      row.push(lot.highestPrice ? lot.highestPrice - cost : "");

      return row;
    });

    const exportInfoRows = [
      ["วันที่ Export", formatThaiDate(exportDate)],
      ["เวลา Export", formatThaiTime(exportDate)],
      ["ผู้ Export", staffProfile?.email || "-"],
      ["สิทธิ์ผู้ Export", staffProfile?.role || "-"],
      ["สถานะการเสนอราคา", getThaiAuctionStatus(auctionStatus)],
      ["จำนวน Lot ที่มีราคา", uniqueMotorcycles.size],
      ["จำนวนร้านค้าที่ส่งราคา", uniqueMerchants.size],
      ["จำนวนราคาที่ส่งทั้งหมด", offers.length],
      ["มูลค่าสูงสุดรวม", totalHighestOfferValue],
      ["ต้นทุนรวม", totalCostForSubmittedLots],
      ["กำไรขั้นต้นรวม", totalGrossProfit],
    ];

    const workbook = XLSX.utils.book_new();

    const resultSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const exportInfoSheet = XLSX.utils.aoa_to_sheet([
      ["รายการ", "ข้อมูล"],
      ...exportInfoRows,
    ]);

    resultSheet["!cols"] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      ...merchantColumns.map(() => ({ wch: 14 })),
      { wch: 14 },
      { wch: 22 },
      { wch: 24 },
      { wch: 14 },
    ];

    exportInfoSheet["!cols"] = [{ wch: 28 }, { wch: 36 }];

    resultSheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(rows.length, 1), c: headers.length - 1 },
      }),
    };

    XLSX.utils.book_append_sheet(workbook, resultSheet, "ผลเสนอราคา");
    XLSX.utils.book_append_sheet(workbook, exportInfoSheet, "ข้อมูลการ Export");

    XLSX.writeFile(workbook, `ผลเสนอราคา_รูปแบบบริษัท_${exportFileDateTime}.xlsx`);
  }

  function SummaryCard({
    label,
    value,
    subText,
    valueClassName = "text-gray-900",
  }: {
    label: string;
    value: string | number;
    subText?: string;
    valueClassName?: string;
  }) {
    return (
      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200 sm:p-4 xl:p-5">
        <p className="text-xs font-medium leading-5 text-gray-500 sm:text-sm">
          {label}
        </p>

        <p
          className={`mt-1 break-words text-2xl font-bold leading-tight sm:text-3xl ${valueClassName}`}
        >
          {value}
        </p>

        {subText && (
          <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">
            {subText}
          </p>
        )}
      </div>
    );
  }

  function StockCard({
    label,
    value,
    unit,
    className,
    valueClassName,
  }: {
    label: string;
    value: string | number;
    unit: string;
    className: string;
    valueClassName: string;
  }) {
    return (
      <div className={`rounded-2xl p-3 ring-1 sm:p-4 ${className}`}>
        <p className="text-xs font-medium leading-5 sm:text-sm">{label}</p>

        <p
          className={`mt-1 break-words text-2xl font-bold sm:text-3xl ${valueClassName}`}
        >
          {value}
        </p>

        <p className="mt-1 text-xs sm:text-sm">{unit}</p>
      </div>
    );
  }

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
      <header className="border-b bg-white px-4 py-4 shadow-sm sm:py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">
              หน้าจัดการ
            </p>

            <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
              ระบบเสนอราคารถจักรยานยนต์
            </h1>

            <p className="mt-1 truncate text-xs text-gray-600 sm:text-sm">
              เข้าสู่ระบบโดย {staffProfile.email} •{" "}
              {getStaffRoleLabel(staffProfile.role)}
            </p>
          </div>

          <button
            onClick={logoutStaff}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100"
          >
            ออกจากระบบ
          </button>
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

                <p className="mt-1 text-sm">
                  ตรวจสอบและอนุมัติร้านค้าก่อนให้เข้าสู่ระบบ
                </p>
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

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">
                สถานะการเสนอราคา
              </p>

              <h2
                className={
                  auctionStatus === "open"
                    ? "mt-1 text-2xl font-bold text-green-600 sm:text-3xl"
                    : "mt-1 text-2xl font-bold text-red-600 sm:text-3xl"
                }
              >
                {auctionStatus === "open" ? "เปิดรับราคา" : "ปิดรับราคา"}
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                {auctionStatus === "open"
                  ? "ร้านค้าสามารถส่งราคาได้"
                  : "ร้านค้าไม่สามารถส่งราคาได้"}
              </p>
            </div>

            <button
              onClick={toggleAuctionStatus}
              disabled={isUpdatingStatus}
              className={
                auctionStatus === "open"
                  ? "w-full rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400 sm:w-auto"
                  : "w-full rounded-2xl bg-green-600 px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400 sm:w-auto"
              }
            >
              {isUpdatingStatus
                ? "กำลังอัปเดต..."
                : auctionStatus === "open"
                  ? "ปิดรับราคา"
                  : "เปิดรับราคา"}
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <SummaryCard label="ราคาที่ส่งทั้งหมด" value={offers.length} />
          <SummaryCard label="ร้านค้าที่ส่ง" value={uniqueMerchants.size} />
          <SummaryCard label="Lot ที่มีราคา" value={uniqueMotorcycles.size} />
          <SummaryCard
            label="Lot ทั้งหมด"
            value={totalMotorcycles}
            subText={`เปิดอยู่: ${activeMotorcycles}`}
          />
          <SummaryCard
            label="รออนุมัติ"
            value={pendingMerchantRequests}
            subText="ร้านค้า"
            valueClassName={
              pendingMerchantRequests > 0 ? "text-red-600" : "text-gray-900"
            }
          />
          <SummaryCard
            label="มูลค่าสูงสุด"
            value={totalHighestOfferValue.toLocaleString()}
            subText="บาท"
          />
          <SummaryCard
            label="กำไรขั้นต้น"
            value={totalGrossProfit.toLocaleString()}
            subText="บาท"
            valueClassName={
              totalGrossProfit >= 0 ? "text-green-700" : "text-red-700"
            }
          />
        </section>

        <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm">
              Stock Summary
            </p>

            <h2 className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">
              สรุปคลังรถบริษัท
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              ภาพรวมรถทั้งหมดในคลังก่อนเลือกนำเข้า Auction
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StockCard
              label="รถในคลังทั้งหมด"
              value={totalStockMotorcycles}
              unit="คัน"
              className="bg-gray-50 text-gray-700 ring-gray-200"
              valueClassName="text-gray-900"
            />

            <StockCard
              label="พร้อมขาย"
              value={readyStockMotorcycles}
              unit="คัน"
              className="bg-green-50 text-green-700 ring-green-200"
              valueClassName="text-green-700"
            />

            <StockCard
              label="อยู่ในการประมูล"
              value={inAuctionStockMotorcycles}
              unit="คัน"
              className="bg-blue-50 text-blue-700 ring-blue-200"
              valueClassName="text-blue-700"
            />

            <StockCard
              label="ขายแล้ว"
              value={soldStockMotorcycles}
              unit="คัน"
              className="bg-purple-50 text-purple-700 ring-purple-200"
              valueClassName="text-purple-700"
            />

            <StockCard
              label="ต้นทุนรวมในคลัง"
              value={totalStockCost.toLocaleString()}
              unit="บาท"
              className="bg-orange-50 text-orange-700 ring-orange-200"
              valueClassName="text-xl text-orange-700 sm:text-2xl"
            />
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <a
              href="/admin/stock"
              className="rounded-xl bg-blue-600 px-4 py-3 text-center font-medium text-white hover:bg-blue-700 sm:py-2"
            >
              คลังรถบริษัท
            </a>

            <a
              href="/admin/motorcycles"
              className="rounded-xl border px-4 py-3 text-center font-medium hover:bg-gray-100 sm:py-2"
            >
              จัดการรถ Auction
            </a>

            <a
              href="/admin/merchants"
              className="relative rounded-xl border px-4 py-3 text-center font-medium hover:bg-gray-100 sm:py-2"
            >
              จัดการร้านค้า

              {pendingMerchantRequests > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingMerchantRequests}
                </span>
              )}
            </a>

            {staffProfile?.role === "owner" && (
              <a
                href="/admin/staff"
                className="rounded-xl border px-4 py-3 text-center font-medium hover:bg-gray-100 sm:py-2"
              >
                ตั้งค่า Owner
              </a>
            )}

            <a
              href="/admin/history"
              className="rounded-xl border px-4 py-3 text-center font-medium hover:bg-gray-100 sm:py-2"
            >
              ประวัติการเสนอราคา
            </a>

            <a
              href="/admin/audit-logs"
              className="rounded-xl border px-4 py-3 text-center font-medium hover:bg-gray-100 sm:py-2"
            >
              ประวัติการทำงาน
            </a>

            <button
              onClick={loadDashboardData}
              className="rounded-xl border px-4 py-3 font-medium hover:bg-gray-100 sm:py-2"
            >
              โหลดใหม่
            </button>

            {!isLoading && lotResults.length > 0 && (
              <button
                onClick={exportAuctionExcel}
                className="rounded-xl bg-black px-4 py-3 font-medium text-white sm:py-2"
              >
                Export Excel สรุปผล
              </button>
            )}
          </div>

          {staffProfile?.role === "owner" && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-800">
                Owner: บันทึกประวัติและล้างข้อมูล
              </p>

              <p className="mt-1 text-sm text-red-700">
                ใช้เมื่อจบรอบ Auction แล้ว ต้องการเก็บประวัติและล้างราคาปัจจุบัน
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input
                  type="password"
                  className="rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-red-600 md:py-2"
                  placeholder="รหัสผ่าน Owner"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />

                <input
                  type="text"
                  className="rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-red-600 md:py-2"
                  placeholder='พิมพ์ "RESET AUCTION"'
                  value={resetPhrase}
                  onChange={(event) => setResetPhrase(event.target.value)}
                />

                <button
                  onClick={resetAuctionData}
                  className="rounded-xl bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700 md:py-2"
                >
                  บันทึกและล้าง
                </button>
              </div>
            </div>
          )}
        </section>

        {isLoading && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {!isLoading && !errorMessage && offers.length === 0 && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-semibold text-gray-900">
              ยังไม่มีร้านค้าเสนอราคา
            </p>
            <p className="mt-1 text-sm text-gray-600">
              เมื่อร้านค้าส่งราคาแล้ว ข้อมูลสรุปจะแสดงที่นี่
            </p>
          </div>
        )}

        {!isLoading && lotResults.length > 0 && (
          <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  ราคาสูงสุดแต่ละ Lot
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  แสดงราคาสูงสุด ต้นทุน และกำไรขั้นต้นของแต่ละ Lot
                </p>
              </div>

              <button
                onClick={exportAuctionExcel}
                className="rounded-xl bg-black px-4 py-2 font-medium text-white"
              >
                Export Excel
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {lotResults.map((lot) => {
                const cost = Number(lot.motorcycle?.cost_price || 0);
                const profit = Number(lot.highestPrice || 0) - cost;
                const groups = getOfferGroupsByPrice(lot.offers);
                const tieNote = getTieNote(groups);

                return (
                  <article
                    key={lot.lotKey}
                    className="rounded-2xl border bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Lot {lot.motorcycle?.lot_number || "-"}
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-gray-900">
                          {lot.motorcycle?.motorcycle_name || "-"}
                        </h3>

                        {tieNote && (
                          <p className="mt-1 text-sm font-semibold text-orange-700">
                            {tieNote}
                          </p>
                        )}
                      </div>

                      {lot.motorcycle?.id && (
                        <a
                          href={`/admin/lots/${lot.motorcycle.id}`}
                          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-100"
                        >
                          ดูรายละเอียด
                        </a>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">ราคาสูงสุด</p>
                        <p className="mt-1 break-words text-xl font-bold text-green-700 sm:text-2xl">
                          {lot.highestPrice.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">บาท</p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">ต้นทุน</p>
                        <p className="mt-1 break-words text-xl font-bold text-gray-900 sm:text-2xl">
                          {cost.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">บาท</p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">กำไรขั้นต้น</p>
                        <p
                          className={
                            profit >= 0
                              ? "mt-1 break-words text-xl font-bold text-green-700 sm:text-2xl"
                              : "mt-1 break-words text-xl font-bold text-red-700 sm:text-2xl"
                          }
                        >
                          {profit.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">บาท</p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">จำนวนราคา</p>
                        <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
                          {lot.offers.length}
                        </p>
                        <p className="text-xs text-gray-500">รายการ</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {groups.slice(0, 3).map((group, groupIndex) => (
                        <div
                          key={`${lot.lotKey}-${groupIndex}`}
                          className={
                            groupIndex === 0
                              ? "rounded-2xl border border-green-200 bg-green-50 p-3"
                              : "rounded-2xl border bg-gray-50 p-3"
                          }
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p
                              className={
                                groupIndex === 0
                                  ? "font-bold text-green-800"
                                  : "font-bold text-gray-900"
                              }
                            >
                              อันดับ {groupIndex + 1}
                              {group.length >= 2
                                ? ` ร่วม ${group.length} ราย`
                                : ""}
                            </p>

                            <p
                              className={
                                groupIndex === 0
                                  ? "font-bold text-green-800"
                                  : "font-bold text-gray-900"
                              }
                            >
                              {Number(
                                group[0]?.offer_price || 0
                              ).toLocaleString()}{" "}
                              บาท
                            </p>
                          </div>

                          <div className="mt-2 space-y-1">
                            {group.map((offer) => (
                              <p
                                key={offer.id}
                                className="text-sm leading-6 text-gray-700"
                              >
                                {offer.merchants?.shop_name || "-"} •{" "}
                                {offer.merchants?.name || "-"} •{" "}
                                {offer.merchants?.phone || "-"}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
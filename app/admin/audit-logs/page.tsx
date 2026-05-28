"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import StaffGuard from "@/components/StaffGuard";

type StaffProfile = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  expiresAt?: number;
};

type AuditLog = {
  id: number;
  staff_id: string | null;
  staff_email: string | null;
  staff_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const STAFF_TIMEOUT_MS = 10 * 60 * 1000;

const ACTION_LABELS: Record<string, string> = {
  auction_round_status_changed: "เปลี่ยนสถานะรอบเสนอราคา",
  auction_status_changed: "เปลี่ยนสถานะรอบเสนอราคา",
  auction_round_set_current: "ตั้งรอบเสนอราคาปัจจุบัน",
  stock_motorcycle_sent_to_auction_round: "นำรถจากคลังเข้ารอบเสนอราคา",
  stock_motorcycle_sent_to_auction: "นำรถจากคลังเข้ารอบเสนอราคา",
  stock_motorcycle_updated: "แก้ไขข้อมูลรถในคลัง",
  merchant_edit_allowed: "เปิดให้ร้านค้าแก้ราคา",
  lot_edit_unlocked: "เปิดให้ร้านค้าแก้ราคา",
  lot_marked_sold: "ยืนยันขายล็อต",
  lot_marked_unsold: "ไม่ขาย / กลับเข้าสต็อก",
  auction_archived_only: "บันทึกประวัติรอบเสนอราคา",
  auction_reset_archived: "บันทึกประวัติและล้างรอบเสนอราคา",
  auction_reset_empty: "ล้างรอบเสนอราคาว่าง",
  stock_motorcycle_created: "เพิ่มรถเข้าคลัง",
  stock_motorcycle_deleted: "ลบรถในคลัง",
  motorcycle_created: "เพิ่มรายการรถในรอบเสนอราคา",
  motorcycle_updated: "แก้ไขรายการรถในรอบเสนอราคา",
  merchant_approved: "อนุมัติร้านค้า",
  merchant_rejected: "ปฏิเสธร้านค้า",
};

export default function AdminAuditLogsPage() {
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [isCheckingStaff, setIsCheckingStaff] = useState(true);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [actionFilter, setActionFilter] = useState("all");

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

  async function loadAuditLogs() {
    setIsLoading(true);
    setErrorMessage("");

    let query = supabase
      .from("admin_audit_logs")
      .select(`
        id,
        staff_id,
        staff_email,
        staff_role,
        action,
        target_type,
        target_id,
        target_name,
        details,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (actionFilter !== "all") {
      query = query.eq("action", actionFilter);
    }

    const { data, error } = await query;

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setLogs((data as AuditLog[]) || []);
    setIsLoading(false);
  }

  useEffect(() => {
    checkStaffSession();
  }, []);

  useEffect(() => {
    if (!staffProfile?.id) return;

    loadAuditLogs();
  }, [staffProfile?.id, actionFilter]);

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
      month: "short",
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

  function isStockAction(action: string) {
    return (
      action === "stock_motorcycle_created" ||
      action === "stock_motorcycle_updated" ||
      action === "stock_motorcycle_sent_to_auction" ||
      action === "stock_motorcycle_sent_to_auction_round" ||
      action === "stock_motorcycle_photo_deleted" ||
      action === "stock_motorcycle_deleted"
    );
  }

  function getActionText(action: string) {
    if (ACTION_LABELS[action]) {
      return ACTION_LABELS[action];
    }

    if (
      action === "auction_status_changed" ||
      action === "auction_reset_archived" ||
      action === "auction_reset_empty"
    ) {
      return "รอบเสนอราคา";
    }

    if (
      action === "merchant_approved" ||
      action === "merchant_rejected" ||
      action === "merchant_submission_cleared"
    ) {
      return "Merchant";
    }

    if (action === "lot_edit_unlocked" || action === "lot_edit_locked") {
      return "ล็อต";
    }

    if (
      action === "motorcycle_created" ||
      action === "motorcycle_updated" ||
      action === "motorcycle_active_changed" ||
      action === "motorcycle_deleted" ||
      action === "motorcycle_photo_deleted"
    ) {
      return "Motorcycle";
    }

    if (isStockAction(action)) {
      return "คลังรถ";
    }

    return action;
  }

  function getActionBadgeClass(action: string) {
    if (
      action === "auction_status_changed" ||
      action === "auction_round_status_changed" ||
      action === "auction_round_set_current"
    ) {
      return "bg-blue-100 text-blue-700";
    }

    if (
      action === "auction_archived_only" ||
      action === "auction_reset_archived" ||
      action === "auction_reset_empty"
    ) {
      return "bg-red-100 text-red-700";
    }

    if (
      action === "merchant_approved" ||
      action === "merchant_rejected" ||
      action === "merchant_submission_cleared"
    ) {
      return "bg-purple-100 text-purple-700";
    }

    if (
      action === "merchant_edit_allowed" ||
      action === "lot_marked_sold" ||
      action === "lot_marked_unsold" ||
      action === "lot_edit_unlocked" ||
      action === "lot_edit_locked"
    ) {
      return "bg-orange-100 text-orange-700";
    }

    if (
      action === "motorcycle_created" ||
      action === "motorcycle_updated" ||
      action === "motorcycle_active_changed" ||
      action === "motorcycle_deleted" ||
      action === "motorcycle_photo_deleted"
    ) {
      return "bg-green-100 text-green-700";
    }

    if (isStockAction(action)) {
      return "bg-cyan-100 text-cyan-700";
    }

    return "bg-gray-100 text-gray-700";
  }

  function getStringDetail(
    details: Record<string, unknown>,
    key: string,
    fallback = "-"
  ) {
    return typeof details[key] === "string" && details[key]
      ? details[key]
      : fallback;
  }

  function getNumberDetail(
    details: Record<string, unknown>,
    key: string,
    fallback: number | string = "-"
  ) {
    return typeof details[key] === "number" ? details[key] : fallback;
  }

  function getCleanDetailText(log: AuditLog) {
    const details = log.details || {};

    if (
      log.action === "auction_status_changed" ||
      log.action === "auction_round_status_changed"
    ) {
      const oldStatus = getStringDetail(details, "old_status_thai");
      const newStatus = getStringDetail(details, "new_status_thai");

      return `${oldStatus} → ${newStatus}`;
    }

    if (log.action === "auction_round_set_current") {
      return `ตั้งเป็นรอบปัจจุบัน: ${log.target_name || "-"}`;
    }

    if (log.action === "auction_archived_only") {
      const roundName = getStringDetail(
        details,
        "archived_round_name",
        log.target_name || "-"
      );

      return `บันทึกประวัติรอบเสนอราคา (${roundName})`;
    }

    if (log.action === "auction_reset_archived") {
      const roundName = getStringDetail(
        details,
        "archived_round_name",
        log.target_name || "-"
      );

      return `บันทึกประวัติและล้างข้อมูล (${roundName})`;
    }

    if (log.action === "auction_reset_empty") {
      return "ล้างข้อมูลตอนยังไม่มีราคา";
    }

    if (log.action === "merchant_approved") {
      return `อนุมัติร้านค้า ${log.target_name || "-"}`;
    }

    if (log.action === "merchant_rejected") {
      return `ปฏิเสธร้านค้า ${log.target_name || "-"}`;
    }

    if (log.action === "merchant_submission_cleared") {
      const clearedLotCount = getNumberDetail(details, "cleared_lot_count");

      return `ล้างราคาของร้านค้า ${log.target_name || "-"} • ${clearedLotCount} ล็อต`;
    }

    if (log.action === "merchant_edit_allowed") {
      const lotNumber = getStringDetail(details, "lot_number");
      const shopName = getStringDetail(details, "merchant_shop_name");

      return `เปิดให้ร้านค้าแก้ราคาล็อต ${lotNumber} • ${shopName}`;
    }

    if (log.action === "lot_marked_sold") {
      const lotNumber = getStringDetail(details, "lot_number");
      const shopName = getStringDetail(details, "winner_shop_name");
      const soldPrice = getNumberDetail(details, "sold_price", 0);

      return `ยืนยันขายล็อต ${lotNumber} ให้ ${shopName} • ${Number(
        soldPrice || 0
      ).toLocaleString()} บาท`;
    }

    if (log.action === "lot_marked_unsold") {
      const lotNumber = getStringDetail(details, "lot_number");
      const motorcycleName = getStringDetail(details, "motorcycle_name");

      return `ไม่ขาย / กลับเข้าสต็อกล็อต ${lotNumber} • ${motorcycleName}`;
    }

    if (log.action === "lot_edit_unlocked") {
      const lotNumber = getStringDetail(details, "lot_number");
      const shopName = getStringDetail(details, "shop_name");

      return `ปลดล็อกให้แก้ราคาล็อต ${lotNumber} • ${shopName}`;
    }

    if (log.action === "lot_edit_locked") {
      const lotNumber = getStringDetail(details, "lot_number");
      const shopName = getStringDetail(details, "shop_name");

      return `ล็อกการแก้ราคาล็อต ${lotNumber} • ${shopName}`;
    }

    if (log.action === "motorcycle_created") {
      const lotNumber = getStringDetail(details, "lot_number");
      const motorcycleName = getStringDetail(details, "motorcycle_name");

      return `เพิ่มรายการรถล็อต ${lotNumber} • ${motorcycleName}`;
    }

    if (log.action === "motorcycle_updated") {
      const newData = details.new_data;

      if (newData && typeof newData === "object" && !Array.isArray(newData)) {
        const newRecord = newData as Record<string, unknown>;
        const lotNumber = getStringDetail(newRecord, "lot_number");
        const motorcycleName = getStringDetail(newRecord, "motorcycle_name");

        return `แก้ไขรายการรถล็อต ${lotNumber} • ${motorcycleName}`;
      }

      return `แก้ไขรายการรถ ${log.target_name || "-"}`;
    }

    if (log.action === "motorcycle_active_changed") {
      const oldStatus = getStringDetail(details, "old_status_thai");
      const newStatus = getStringDetail(details, "new_status_thai");
      const lotNumber = getStringDetail(details, "lot_number");
      const motorcycleName = getStringDetail(details, "motorcycle_name");

      return `ล็อต ${lotNumber} • ${motorcycleName}: ${oldStatus} → ${newStatus}`;
    }

    if (log.action === "motorcycle_deleted") {
      const deletedData = details.deleted_data;

      if (
        deletedData &&
        typeof deletedData === "object" &&
        !Array.isArray(deletedData)
      ) {
        const deletedRecord = deletedData as Record<string, unknown>;
        const lotNumber = getStringDetail(deletedRecord, "lot_number");
        const motorcycleName = getStringDetail(
          deletedRecord,
          "motorcycle_name"
        );

        return `ลบรายการรถล็อต ${lotNumber} • ${motorcycleName}`;
      }

      return `ลบรายการรถ ${log.target_name || "-"}`;
    }

    if (log.action === "motorcycle_photo_deleted") {
      const lotNumber = getStringDetail(details, "lot_number");
      const motorcycleName = getStringDetail(details, "motorcycle_name");
      const photoId = getNumberDetail(details, "photo_id");

      return `ลบรูปของล็อต ${lotNumber} • ${motorcycleName} • Photo ID ${photoId}`;
    }

    if (log.action === "stock_motorcycle_created") {
      const stockNumber = getStringDetail(details, "stock_number");
      const motorcycleName = getStringDetail(details, "motorcycle_name");

      return `เพิ่มรถเข้าคลัง เลขสต็อก ${stockNumber} • ${motorcycleName}`;
    }

    if (log.action === "stock_motorcycle_updated") {
      const newData = details.new_data;

      if (newData && typeof newData === "object" && !Array.isArray(newData)) {
        const newRecord = newData as Record<string, unknown>;
        const stockNumber = getStringDetail(newRecord, "stock_number");
        const motorcycleName = getStringDetail(newRecord, "motorcycle_name");
        const syncedToAuction = Boolean(newRecord.synced_to_auction);

        return syncedToAuction
          ? `แก้ไขรถในคลัง เลขสต็อก ${stockNumber} • ${motorcycleName} และอัปเดตรอบเสนอราคาแล้ว`
          : `แก้ไขรถในคลัง เลขสต็อก ${stockNumber} • ${motorcycleName}`;
      }

      return `แก้ไขข้อมูลรถในคลัง ${log.target_name || "-"}`;
    }

    if (
      log.action === "stock_motorcycle_sent_to_auction" ||
      log.action === "stock_motorcycle_sent_to_auction_round"
    ) {
      const stockNumber = getStringDetail(details, "stock_number");
      const lotNumber = getStringDetail(details, "lot_number");
      const motorcycleName = getStringDetail(details, "motorcycle_name");

      return `นำรถจากคลัง เลขสต็อก ${stockNumber} • ${motorcycleName} เข้ารอบเสนอราคาเป็นล็อต ${lotNumber}`;
    }

    if (log.action === "stock_motorcycle_photo_deleted") {
      const stockNumber = getStringDetail(details, "stock_number");
      const motorcycleName = getStringDetail(details, "motorcycle_name");
      const photoId = getNumberDetail(details, "photo_id");

      return `ลบรูปรถในคลัง เลขสต็อก ${stockNumber} • ${motorcycleName} • Photo ID ${photoId}`;
    }

    if (log.action === "stock_motorcycle_deleted") {
      const deletedData = details.deleted_data;

      if (
        deletedData &&
        typeof deletedData === "object" &&
        !Array.isArray(deletedData)
      ) {
        const deletedRecord = deletedData as Record<string, unknown>;
        const stockNumber = getStringDetail(deletedRecord, "stock_number");
        const motorcycleName = getStringDetail(
          deletedRecord,
          "motorcycle_name"
        );

        return `ลบรถออกจากคลัง เลขสต็อก ${stockNumber} • ${motorcycleName}`;
      }

      return `ลบรถออกจากคลัง ${log.target_name || "-"}`;
    }

    return log.action;
  }

  function getSubDetailText(log: AuditLog) {
    const details = log.details || {};

    if (
      log.action === "auction_status_changed" ||
      log.action === "auction_round_status_changed"
    ) {
      return "เปลี่ยนสถานะการเสนอราคา";
    }

    if (log.action === "auction_round_set_current") {
      return "กำหนดรอบที่ร้านค้าจะเห็นและเสนอราคา";
    }

    if (log.action === "auction_archived_only") {
      const lotCount = getNumberDetail(details, "archived_lot_count", 0);
      const offerCount = getNumberDetail(details, "archived_offer_count", 0);

      return `บันทึกล็อต ${lotCount} • ราคา ${offerCount} รายการ`;
    }

    if (log.action === "auction_reset_archived") {
      const lotCount = getNumberDetail(
        details,
        "total_lots_with_offers_before_reset"
      );

      const merchantCount = getNumberDetail(
        details,
        "total_merchants_before_reset"
      );

      const offerCount = getNumberDetail(details, "archived_offer_count");

      return `ล็อต ${lotCount} • ร้านค้า ${merchantCount} • ราคา ${offerCount} รายการ`;
    }

    if (log.action === "auction_reset_empty") {
      return "ไม่มีราคาถูกบันทึกในรอบนี้";
    }

    if (log.action === "merchant_approved") {
      const merchantName = getStringDetail(details, "merchant_name");
      const shopName = getStringDetail(details, "shop_name");
      const phone = getStringDetail(details, "phone");

      return `${shopName} • ${merchantName} • โทร ${phone}`;
    }

    if (log.action === "merchant_rejected") {
      const merchantName = getStringDetail(details, "merchant_name");
      const shopName = getStringDetail(details, "shop_name");
      const phone = getStringDetail(details, "phone");

      return `${shopName} • ${merchantName} • โทร ${phone}`;
    }

    if (log.action === "merchant_submission_cleared") {
      const totalValue = getNumberDetail(details, "cleared_total_offer_value", 0);

      return `มูลค่าราคาที่ล้าง ${Number(totalValue || 0).toLocaleString()} บาท`;
    }

    if (log.action === "merchant_edit_allowed") {
      const motorcycleName = getStringDetail(details, "motorcycle_name");
      const offerPrice = getNumberDetail(details, "current_offer_price", 0);

      return `${motorcycleName} • ราคาเดิม ${Number(
        offerPrice || 0
      ).toLocaleString()} บาท`;
    }

    if (log.action === "lot_marked_sold") {
      const cost = getNumberDetail(details, "cost_price", 0);
      const diff = getNumberDetail(details, "diff", 0);

      return `ต้นทุน ${Number(cost || 0).toLocaleString()} บาท • diff ${Number(
        diff || 0
      ).toLocaleString()} บาท`;
    }

    if (log.action === "lot_marked_unsold") {
      return "ซ่อนล็อตจากหน้าร้านค้าและคืนสถานะรถในคลังเป็นพร้อมขาย";
    }

    if (log.action === "lot_edit_unlocked" || log.action === "lot_edit_locked") {
      const motorcycleName = getStringDetail(details, "motorcycle_name");
      const offerPrice = getNumberDetail(details, "offer_price", 0);

      return `${motorcycleName} • ราคาเดิม ${Number(
        offerPrice || 0
      ).toLocaleString()} บาท`;
    }

    if (log.action === "motorcycle_created") {
      const cost = getNumberDetail(details, "cost_price", 0);
      const photoCount = getNumberDetail(details, "uploaded_photo_count", 0);

      return `ต้นทุน ${Number(cost || 0).toLocaleString()} บาท • เพิ่มรูป ${photoCount} รูป`;
    }

    if (log.action === "motorcycle_updated") {
      const photoCount = getNumberDetail(details, "uploaded_photo_count", 0);

      return `แก้ไขข้อมูลรถ • เพิ่มรูปใหม่ ${photoCount} รูป`;
    }

    if (log.action === "motorcycle_active_changed") {
      return "เปลี่ยนสถานะการแสดงผลของล็อต";
    }

    if (log.action === "motorcycle_deleted") {
      return "ลบรายการรถออกจากระบบ";
    }

    if (log.action === "motorcycle_photo_deleted") {
      return "ลบรูปออกจากรายการรถ";
    }

    if (log.action === "stock_motorcycle_created") {
      const cost = getNumberDetail(details, "cost_price", 0);
      const photoCount = getNumberDetail(details, "uploaded_photo_count", 0);
      const statusThai = getStringDetail(details, "stock_status_thai");

      return `สถานะ ${statusThai} • ต้นทุน ${Number(
        cost || 0
      ).toLocaleString()} บาท • เพิ่มรูป ${photoCount} รูป`;
    }

    if (log.action === "stock_motorcycle_updated") {
      const photoCount = getNumberDetail(details, "uploaded_photo_count", 0);
      const newData = details.new_data;

      if (newData && typeof newData === "object" && !Array.isArray(newData)) {
        const newRecord = newData as Record<string, unknown>;
        const syncedToAuction = Boolean(newRecord.synced_to_auction);
        const linkedAuctionId = getNumberDetail(
          newRecord,
          "linked_auction_motorcycle_id",
          "-"
        );

        return syncedToAuction
          ? `แก้ไขข้อมูลคลัง • เพิ่มรูปใหม่ ${photoCount} รูป • เชื่อมกับ Auction ID ${linkedAuctionId}`
          : `แก้ไขข้อมูลคลัง • เพิ่มรูปใหม่ ${photoCount} รูป`;
      }

      return `แก้ไขข้อมูลคลัง • เพิ่มรูปใหม่ ${photoCount} รูป`;
    }

    if (
      log.action === "stock_motorcycle_sent_to_auction" ||
      log.action === "stock_motorcycle_sent_to_auction_round"
    ) {
      const auctionMotorcycleId = getNumberDetail(
        details,
        "auction_motorcycle_id",
        "-"
      );
      const copiedPhotoCount = getNumberDetail(details, "copied_photo_count", 0);

      return `สร้าง Auction Motorcycle ID ${auctionMotorcycleId} • คัดลอกรูป ${copiedPhotoCount} รูป`;
    }

    if (log.action === "stock_motorcycle_photo_deleted") {
      return "ลบรูปออกจากรถในคลัง";
    }

    if (log.action === "stock_motorcycle_deleted") {
      return "ลบรถออกจากคลังรถบริษัท";
    }

    return log.action;
  }

  const totalLogs = logs.length;

  const statusChangeCount = logs.filter(
    (log) => log.action === "auction_status_changed"
  ).length;

  const resetCount = logs.filter(
    (log) =>
      log.action === "auction_reset_archived" ||
      log.action === "auction_reset_empty"
  ).length;

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
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
      <header className="border-b bg-white px-4 py-5 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
              Audit Logs
            </p>

            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              ประวัติการทำงานของแอดมิน
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">
              จำนวนรายการที่แสดง
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalLogs}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">
              เปลี่ยนสถานะรอบเสนอราคา
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {statusChangeCount}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-500">
              บันทึกประวัติ / ล้างข้อมูล
            </p>
            <p className="mt-2 text-3xl font-bold text-red-700">
              {resetCount}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="rounded-xl border px-4 py-2 outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">แสดงทุก Action</option>

              <option value="auction_status_changed">
                รอบเสนอราคา: เปิด/ปิดรับราคา
              </option>
              <option value="auction_round_status_changed">
                รอบเสนอราคา: เปลี่ยนสถานะรอบ
              </option>
              <option value="auction_round_set_current">
                รอบเสนอราคา: ตั้งรอบปัจจุบัน
              </option>
              <option value="auction_archived_only">
                รอบเสนอราคา: บันทึกประวัติรอบ
              </option>
              <option value="auction_reset_archived">
                รอบเสนอราคา: บันทึกประวัติและล้างข้อมูล
              </option>
              <option value="auction_reset_empty">
                รอบเสนอราคา: ล้างข้อมูลตอนยังไม่มีราคา
              </option>

              <option value="merchant_approved">Merchant: อนุมัติร้านค้า</option>
              <option value="merchant_rejected">Merchant: ปฏิเสธร้านค้า</option>
              <option value="merchant_submission_cleared">
                Merchant: ล้างราคาของร้านค้า
              </option>

              <option value="lot_edit_unlocked">
                ล็อต: ปลดล็อกแก้ไขราคา
              </option>
              <option value="merchant_edit_allowed">
                ล็อต: เปิดให้ร้านค้าแก้ราคา
              </option>
              <option value="lot_marked_sold">ล็อต: ยืนยันขาย</option>
              <option value="lot_marked_unsold">
                ล็อต: ไม่ขาย / กลับเข้าสต็อก
              </option>
              <option value="lot_edit_locked">ล็อต: ล็อกแก้ไขราคา</option>

              <option value="motorcycle_created">Motorcycle: เพิ่มรถ</option>
              <option value="motorcycle_updated">Motorcycle: แก้ไขรถ</option>
              <option value="motorcycle_active_changed">
                Motorcycle: แสดง/ซ่อนรถ
              </option>
              <option value="motorcycle_photo_deleted">
                Motorcycle: ลบรูป
              </option>
              <option value="motorcycle_deleted">Motorcycle: ลบรถ</option>

              <option value="stock_motorcycle_created">
                คลังรถ: เพิ่มรถเข้าคลัง
              </option>
              <option value="stock_motorcycle_updated">
                คลังรถ: แก้ไขรถในคลัง
              </option>
              <option value="stock_motorcycle_sent_to_auction">
                คลังรถ: นำเข้ารอบเสนอราคา
              </option>
              <option value="stock_motorcycle_sent_to_auction_round">
                คลังรถ: นำเข้ารอบเสนอราคา
              </option>
              <option value="stock_motorcycle_photo_deleted">
                คลังรถ: ลบรูป
              </option>
              <option value="stock_motorcycle_deleted">
                คลังรถ: ลบรถออกจากคลัง
              </option>
            </select>

            <button
              onClick={loadAuditLogs}
              className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
            >
              โหลดใหม่
            </button>
          </div>
        </section>

        {isLoading && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-gray-600">กำลังโหลดประวัติการทำงาน...</p>
          </div>
        )}

        {!isLoading && logs.length === 0 && (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-semibold text-gray-900">
              ยังไม่มีประวัติการทำงาน
            </p>
            <p className="mt-1 text-sm text-gray-600">
              ประวัติจะเริ่มแสดงหลังจากมีการกระทำ เช่น เปิด/ปิดรับราคา
              เพิ่มรถเข้าคลัง หรือนำรถเข้ารอบเสนอราคา
            </p>
          </div>
        )}

        {!isLoading && logs.length > 0 && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              รายการประวัติการทำงาน
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              แสดงรายการล่าสุดสูงสุด 200 รายการ
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[850px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-100 text-gray-800">
                    <th className="w-[190px] p-3">เวลา</th>
                    <th className="w-[230px] p-3">ผู้ใช้งาน</th>
                    <th className="w-[90px] p-3">สิทธิ์</th>
                    <th className="w-[150px] p-3">ประเภท</th>
                    <th className="p-3">รายละเอียด</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b align-top">
                      <td className="whitespace-nowrap p-3 text-gray-700">
                        {formatThaiDateTime(log.created_at)}
                      </td>

                      <td className="p-3">
                        <p className="font-semibold text-gray-900">
                          {log.staff_email || "-"}
                        </p>
                      </td>

                      <td className="p-3">
                        <span
                          className={
                            log.staff_role === "owner"
                              ? "inline-flex whitespace-nowrap rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
                              : "inline-flex whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
                          }
                        >
                          {log.staff_role || "-"}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${getActionBadgeClass(
                              log.action
                            )}`}
                          >
                            {getActionText(log.action)}
                          </span>

                          <p className="text-xs text-gray-400">{log.action}</p>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                          <p className="font-semibold text-gray-900">
                            {getCleanDetailText(log)}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {getSubDetailText(log)}
                          </p>

                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-semibold text-gray-500">
                              ดูข้อมูล technical JSON
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-white p-3 text-xs text-gray-600 ring-1 ring-gray-200">
                              {JSON.stringify(log.details || {}, null, 2)}
                            </pre>
                          </details>
                        </div>
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
    </StaffGuard>
  );
}

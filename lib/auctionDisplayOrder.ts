export type AuctionDisplayMotorcycle = {
  id?: number | string | null;
  motorcycle_id?: number | string | null;
  brand?: string | null;
  model?: string | null;
  year?: string | number | null;
  license_plate?: string | null;
  motorcycle?: string | null;
  motorcycle_name?: string | null;
  display_order?: number | string | null;
  stock_motorcycle?: AuctionDisplayMotorcycle | null;
  stock_motorcycles?: AuctionDisplayMotorcycle | null;
};

export function normalizeAuctionText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getAuctionMotorcycleId(item: AuctionDisplayMotorcycle) {
  const id = item.id ?? item.motorcycle_id;

  return id === null || id === undefined ? "" : String(id);
}

function getAuctionSortValue(
  item: AuctionDisplayMotorcycle,
  field: "brand" | "model" | "year" | "license_plate"
) {
  return (
    item[field] ??
    item.stock_motorcycles?.[field] ??
    item.stock_motorcycle?.[field] ??
    null
  );
}

function cleanAuctionDisplayText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function getAuctionMotorcycleName(item: AuctionDisplayMotorcycle) {
  return cleanAuctionDisplayText(
    item.motorcycle_name ??
      item.motorcycle ??
      item.stock_motorcycles?.motorcycle_name ??
      item.stock_motorcycle?.motorcycle_name
  );
}

export function getAuctionBrandForSort(item: AuctionDisplayMotorcycle) {
  const brand = cleanAuctionDisplayText(getAuctionSortValue(item, "brand"));

  if (brand) return normalizeAuctionText(brand);

  const [fallbackBrand = ""] = getAuctionMotorcycleName(item).split(" ");

  return normalizeAuctionText(fallbackBrand);
}

export function getAuctionModelForSort(item: AuctionDisplayMotorcycle) {
  const model = cleanAuctionDisplayText(getAuctionSortValue(item, "model"));

  if (model) return normalizeAuctionText(model);

  const name = getAuctionMotorcycleName(item);
  const brand =
    cleanAuctionDisplayText(getAuctionSortValue(item, "brand")) ||
    cleanAuctionDisplayText(name.split(" ")[0]);

  if (brand && normalizeAuctionText(name).startsWith(normalizeAuctionText(brand))) {
    return normalizeAuctionText(name.slice(brand.length));
  }

  return normalizeAuctionText(name);
}

function getAuctionDisplayModel(item: AuctionDisplayMotorcycle) {
  const model = cleanAuctionDisplayText(getAuctionSortValue(item, "model"));

  if (model) return model;

  const name = getAuctionMotorcycleName(item);
  const brand =
    cleanAuctionDisplayText(getAuctionSortValue(item, "brand")) ||
    cleanAuctionDisplayText(name.split(" ")[0]);

  if (brand && normalizeAuctionText(name).startsWith(normalizeAuctionText(brand))) {
    return cleanAuctionDisplayText(name.slice(brand.length));
  }

  return name;
}

function compareAuctionYear(
  a: string | number | null | undefined,
  b: string | number | null | undefined
) {
  const yearA = Number(normalizeAuctionText(a));
  const yearB = Number(normalizeAuctionText(b));
  const hasYearA = Number.isFinite(yearA);
  const hasYearB = Number.isFinite(yearB);

  if (hasYearA && hasYearB) return yearA - yearB;
  if (hasYearA) return -1;
  if (hasYearB) return 1;

  return normalizeAuctionText(a).localeCompare(normalizeAuctionText(b), "th", {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortAuctionMotorcycles<T extends AuctionDisplayMotorcycle>(
  items: T[]
) {
  return [...items].sort((a, b) => {
    return (
      getAuctionBrandForSort(a).localeCompare(
        getAuctionBrandForSort(b),
        "th",
        { numeric: true, sensitivity: "base" }
      ) ||
      getAuctionModelForSort(a).localeCompare(
        getAuctionModelForSort(b),
        "th",
        { numeric: true, sensitivity: "base" }
      ) ||
      compareAuctionYear(
        getAuctionSortValue(a, "year"),
        getAuctionSortValue(b, "year")
      ) ||
      normalizeAuctionText(getAuctionSortValue(a, "license_plate")).localeCompare(
        normalizeAuctionText(getAuctionSortValue(b, "license_plate")),
        "th",
        { numeric: true, sensitivity: "base" }
      )
    );
  });
}

export function buildAuctionDisplayOrderMap(
  items: AuctionDisplayMotorcycle[]
) {
  const displayOrderByMotorcycleId: Record<string, string> = {};

  sortAuctionMotorcycles(items).forEach((item, index) => {
    const id = getAuctionMotorcycleId(item);

    if (id) {
      displayOrderByMotorcycleId[id] = String(index + 1).padStart(3, "0");
    }
  });

  return displayOrderByMotorcycleId;
}

export function getStoredAuctionDisplayOrder(item: AuctionDisplayMotorcycle) {
  const value = Number(item.display_order);

  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatAuctionDisplayOrder(
  value: number | string | null | undefined
) {
  const order = Number(value);

  return Number.isFinite(order) && order > 0
    ? String(order).padStart(3, "0")
    : "---";
}

export function sortByStoredAuctionDisplayOrder<
  T extends AuctionDisplayMotorcycle,
>(items: T[]) {
  return [...items].sort((a, b) => {
    const orderA = getStoredAuctionDisplayOrder(a);
    const orderB = getStoredAuctionDisplayOrder(b);

    if (orderA !== null && orderB !== null) return orderA - orderB;
    if (orderA !== null) return -1;
    if (orderB !== null) return 1;

    return 0;
  });
}

export function sortBySavedAuctionDisplayOrder<
  T extends AuctionDisplayMotorcycle,
>(items: T[]) {
  return [...items].sort((a, b) => {
    const orderA = getStoredAuctionDisplayOrder(a);
    const orderB = getStoredAuctionDisplayOrder(b);

    if (orderA !== null && orderB !== null) return orderA - orderB;
    if (orderA !== null) return -1;
    if (orderB !== null) return 1;

    return (
      getAuctionBrandForSort(a).localeCompare(
        getAuctionBrandForSort(b),
        "th",
        { numeric: true, sensitivity: "base" }
      ) ||
      getAuctionModelForSort(a).localeCompare(
        getAuctionModelForSort(b),
        "th",
        { numeric: true, sensitivity: "base" }
      ) ||
      compareAuctionYear(
        getAuctionSortValue(a, "year"),
        getAuctionSortValue(b, "year")
      ) ||
      normalizeAuctionText(getAuctionSortValue(a, "license_plate")).localeCompare(
        normalizeAuctionText(getAuctionSortValue(b, "license_plate")),
        "th",
        { numeric: true, sensitivity: "base" }
      )
    );
  });
}

export function getAuctionDisplayName(item: AuctionDisplayMotorcycle) {
  const brand = String(getAuctionSortValue(item, "brand") ?? "").trim();
  const model = String(getAuctionSortValue(item, "model") ?? "").trim();
  const name = [brand, model].filter(Boolean).join(" ");
  const nestedName =
    item.stock_motorcycles?.motorcycle_name ||
    item.stock_motorcycle?.motorcycle_name;

  return name || String(nestedName ?? item.motorcycle_name ?? "").trim() || "-";
}

export function getAuctionDisplayLabel(item: AuctionDisplayMotorcycle) {
  const model = getAuctionDisplayModel(item) || "-";
  const licensePlate =
    cleanAuctionDisplayText(getAuctionSortValue(item, "license_plate")) || "-";

  return `${model} / ทะเบียน ${licensePlate}`;
}

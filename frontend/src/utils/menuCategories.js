export const MENU_CATEGORIES_STORAGE_KEY = "cv_menu_categories";
export const MENU_CATEGORIES_UPDATED_AT_KEY = "cv_menu_categories_updated_at";

export const DEFAULT_MENU_CATEGORIES = Object.freeze([
  { name: "Burger", icon: "🍔" },
  { name: "Kottu", icon: "🍜" },
  { name: "Noodles", icon: "🍝" },
  { name: "Submarine", icon: "🥖" },
  { name: "Café", icon: "☕" },
  { name: "Juice", icon: "🥤" },
  { name: "Rice", icon: "🍚" },
  { name: "Pizza", icon: "🍕" },
]);

export const FALLBACK_CATEGORY_ICON = "📦";

const RESERVED_CATEGORY_NAMES = new Set(["ALL"]);

const FALLBACK_CATEGORY_ICONS = Object.freeze({
  ALL: "📦",
  Burger: "🍔",
  Kottu: "🍜",
  Noodles: "🍝",
  Noodle: "🍝",
  Submarine: "🥖",
  "Café": "☕",
  Cafe: "☕",
  Juice: "🥤",
  Rice: "🍚",
  Pizza: "🍕",
});

function normalizeCategoryName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function normalizeCategoryIcon(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return FALLBACK_CATEGORY_ICON;
  }
  const [firstGlyph] = Array.from(raw);
  return firstGlyph || FALLBACK_CATEGORY_ICON;
}

export function normalizeMenuCategoryEntry(entry) {
  const name = normalizeCategoryName(entry?.name);
  if (!name) {
    return null;
  }
  if (RESERVED_CATEGORY_NAMES.has(name.toUpperCase())) {
    return null;
  }
  return {
    name,
    icon: normalizeCategoryIcon(entry?.icon),
  };
}

export function normalizeMenuCategories(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const seen = new Set();
  const normalized = [];

  for (const entry of safeEntries) {
    const parsed = normalizeMenuCategoryEntry(entry);
    if (!parsed) {
      continue;
    }
    const dedupeKey = parsed.name.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    normalized.push(parsed);
  }

  return normalized;
}

export function getDefaultMenuCategories() {
  return DEFAULT_MENU_CATEGORIES.map((entry) => ({ ...entry }));
}

export function loadMenuCategories() {
  try {
    const raw = localStorage.getItem(MENU_CATEGORIES_STORAGE_KEY);
    if (!raw) {
      return getDefaultMenuCategories();
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeMenuCategories(parsed);
    if (normalized.length > 0) {
      return normalized;
    }
  } catch {
    // ignore and use fallback defaults
  }
  return getDefaultMenuCategories();
}

export function saveMenuCategories(categories) {
  const normalized = normalizeMenuCategories(categories);
  localStorage.setItem(MENU_CATEGORIES_STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem(MENU_CATEGORIES_UPDATED_AT_KEY, String(Date.now()));
  return normalized;
}

export function buildCategoryIconMap(categories) {
  const iconMap = { ...FALLBACK_CATEGORY_ICONS };
  normalizeMenuCategories(categories).forEach((entry) => {
    iconMap[entry.name] = entry.icon || FALLBACK_CATEGORY_ICON;
  });
  return iconMap;
}

export function getMenuCategoryNames(categories) {
  return normalizeMenuCategories(categories).map((entry) => entry.name);
}

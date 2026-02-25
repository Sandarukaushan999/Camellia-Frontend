export const BUSINESS_TIMEZONE = "Asia/Colombo";
export const BUSINESS_LOCALE = "en-LK";

function toValidDate(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function formatBusinessDate(value, options = {}) {
  const date = toValidDate(value);
  if (!date) {
    return "-";
  }
  return date.toLocaleDateString(BUSINESS_LOCALE, {
    timeZone: BUSINESS_TIMEZONE,
    ...options,
  });
}

export function formatBusinessTime(value, options = {}) {
  const date = toValidDate(value);
  if (!date) {
    return "-";
  }
  return date.toLocaleTimeString(BUSINESS_LOCALE, {
    timeZone: BUSINESS_TIMEZONE,
    ...options,
  });
}

export function formatBusinessDateTime(value, options = {}) {
  const date = toValidDate(value);
  if (!date) {
    return "-";
  }
  return date.toLocaleString(BUSINESS_LOCALE, {
    timeZone: BUSINESS_TIMEZONE,
    ...options,
  });
}

export function toBusinessDateKey(value) {
  const date = toValidDate(value);
  if (!date) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

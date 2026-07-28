export const APP_TIME_ZONE = "America/Sao_Paulo";
export const APP_LOCALE = "pt-BR";

type DateInput = Date | string | number;

const appDatePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function formatAppDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short" },
) {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(toDate(value));
}

export function formatAppDateTime(value: DateInput) {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(toDate(value));
}

export function getAppDateInputValue(value: DateInput) {
  const parts = getAppDateTimeParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getAppMonthInputValue(value: DateInput) {
  const parts = getAppDateTimeParts(value);
  return `${parts.year}-${pad(parts.month)}`;
}

export function appZonedDateTimeToDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let instant = wallClockUtc;

  // Recalculate because the offset at the UTC guess can differ from the
  // offset at the resulting instant around daylight-saving transitions.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffset(new Date(instant));
    const candidate = wallClockUtc - offset;
    if (candidate === instant) break;
    instant = candidate;
  }

  return new Date(instant);
}

export function parseAppDateEndOfDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = appZonedDateTimeToDate(year, month, day, 23, 59, 59, 999);
  const parts = getAppDateTimeParts(date);

  if (parts.year !== year || parts.month !== month || parts.day !== day) return null;
  return date;
}

function getAppDateTimeParts(value: DateInput) {
  const parts = Object.fromEntries(
    appDatePartsFormatter
      .formatToParts(toDate(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function getTimeZoneOffset(date: Date) {
  const parts = getAppDateTimeParts(date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function toDate(value: DateInput) {
  return value instanceof Date ? value : new Date(value);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

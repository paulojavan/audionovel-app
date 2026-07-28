import { appZonedDateTimeToDate, getAppMonthInputValue } from "@/lib/app-time";

export type FinanceMonthPeriod = {
  month: string;
  start: Date;
  end: Date;
};

export function getFinanceMonthPeriod(input: string | undefined, now = new Date()): FinanceMonthPeriod {
  const fallback = getAppMonthInputValue(now);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(input ?? "") ? String(input) : fallback;
  const [year, monthIndex] = month.split("-").map(Number);

  return {
    month,
    start: appZonedDateTimeToDate(year, monthIndex, 1),
    end: appZonedDateTimeToDate(year, monthIndex + 1, 1),
  };
}

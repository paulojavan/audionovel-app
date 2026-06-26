export type FinanceMonthPeriod = {
  month: string;
  start: Date;
  end: Date;
};

export function getFinanceMonthPeriod(input: string | undefined, now = new Date()): FinanceMonthPeriod {
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = /^\d{4}-\d{2}$/.test(input ?? "") ? String(input) : fallback;
  const [year, monthIndex] = month.split("-").map(Number);

  return {
    month,
    start: new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)),
  };
}

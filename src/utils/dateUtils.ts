import { addMonths, lastDayOfMonth, set, subDays } from 'date-fns';

const getSafeMonthDay = (year: number, month: number, day: number): Date => {
  const candidate = new Date(year, month, day);
  return candidate.getMonth() === month
    ? candidate
    : lastDayOfMonth(new Date(year, month, 1));
};

export const getCustomMonthStart = (date: Date, monthStartDay: number): Date => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const candidate = getSafeMonthDay(year, month, monthStartDay);
  const normalized = set(candidate, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });

  if (date >= normalized) {
    return normalized;
  }

  const previousMonth = addMonths(date, -1);
  return set(
    getSafeMonthDay(previousMonth.getFullYear(), previousMonth.getMonth(), monthStartDay),
    { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }
  );
};

export const getCustomMonthEnd = (date: Date, monthStartDay: number): Date => {
  const start = getCustomMonthStart(date, monthStartDay);
  const nextStart = getCustomMonthStart(addMonths(start, 1), monthStartDay);
  return subDays(nextStart, 1);
};

export const getCustomMonthPeriod = (date: Date, monthStartDay: number) => {
  const start = getCustomMonthStart(date, monthStartDay);
  return {
    start,
    end: getCustomMonthEnd(date, monthStartDay),
  };
};

export const getPreviousCustomMonthPeriod = (date: Date, monthStartDay: number) => {
  const currentStart = getCustomMonthStart(date, monthStartDay);
  const previousEnd = subDays(currentStart, 1);
  return getCustomMonthPeriod(previousEnd, monthStartDay);
};

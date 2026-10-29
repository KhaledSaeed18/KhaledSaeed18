// Beirut time, for the dates and job lines the sheets print. ICU handles
// daylight saving, so nothing here knows what month it is.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

/** The moment `at` (a Date) as Beirut reads it. */
export function beirut(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(at)
  const get = (t) => parts.find((p) => p.type === t)?.value ?? ""
  const hour = Number(get("hour"))
  const minute = Number(get("minute"))
  const day = Number(get("day"))
  const month = Number(get("month"))
  const year = Number(get("year"))
  const pad = (n) => String(n).padStart(2, "0")
  return {
    at,
    year,
    month,
    day,
    hour,
    minute,
    clock: `${pad(hour)}:${pad(minute)}`,
    date: `${day} ${MONTHS[month - 1]} ${year}`,
    offset: get("timeZoneName").replace("GMT", "utc") || "utc+2",
  }
}

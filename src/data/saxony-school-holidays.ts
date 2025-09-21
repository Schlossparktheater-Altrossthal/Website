import type { HolidayRange } from "@/types/holidays";

/**
 * Static backup for sächsische Schulferien used when remote feeds are unavailable.
 *
 * The dataset intentionally spans multiple years (past + future) so UI filtering can
 * still limit the result set to the relevant window around "today".
 */
export const SAXONY_SCHOOL_HOLIDAYS: HolidayRange[] = [
  {
    id: "ferien-api:winterferien sachsen 2023-2023-SN",
    title: "Winterferien Sachsen 2023",
    startDate: "2023-02-13",
    endDate: "2023-02-24",
  },
  {
    id: "ferien-api:osterferien sachsen 2023-2023-SN",
    title: "Osterferien Sachsen 2023",
    startDate: "2023-04-07",
    endDate: "2023-04-15",
  },
  {
    id: "ferien-api:pfingstferien sachsen 2023 (beweglicher ferientag)-2023-SN",
    title: "Pfingstferien Sachsen 2023 (Beweglicher Ferientag)",
    startDate: "2023-05-19",
    endDate: "2023-05-19",
  },
  {
    id: "ferien-api:sommerferien sachsen 2023-2023-SN",
    title: "Sommerferien Sachsen 2023",
    startDate: "2023-07-10",
    endDate: "2023-08-18",
  },
  {
    id: "ferien-api:herbstferien sachsen 2023-2023-SN",
    title: "Herbstferien Sachsen 2023",
    startDate: "2023-10-02",
    endDate: "2023-10-14",
  },
  {
    id: "ferien-api:herbstferien sachsen 2023 (beweglicher ferientag)-2023-SN",
    title: "Herbstferien Sachsen 2023 (Beweglicher Ferientag)",
    startDate: "2023-10-30",
    endDate: "2023-10-30",
  },
  {
    id: "ferien-api:weihnachtsferien sachsen 2023-2023-SN",
    title: "Weihnachtsferien Sachsen 2023",
    startDate: "2023-12-23",
    endDate: "2024-01-02",
  },
  {
    id: "ferien-api:winterferien sachsen 2024-2024-SN",
    title: "Winterferien Sachsen 2024",
    startDate: "2024-02-12",
    endDate: "2024-02-23",
  },
  {
    id: "ferien-api:osterferien sachsen 2024-2024-SN",
    title: "Osterferien Sachsen 2024",
    startDate: "2024-03-28",
    endDate: "2024-04-05",
  },
  {
    id: "ferien-api:pfingstferien sachsen 2024 (beweglicher ferientag)-2024-SN",
    title: "Pfingstferien Sachsen 2024 (Beweglicher Ferientag)",
    startDate: "2024-05-10",
    endDate: "2024-05-10",
  },
  {
    id: "ferien-api:pfingstferien sachsen 2024-2024-SN",
    title: "Pfingstferien Sachsen 2024",
    startDate: "2024-05-18",
    endDate: "2024-05-21",
  },
  {
    id: "ferien-api:sommerferien sachsen 2024-2024-SN",
    title: "Sommerferien Sachsen 2024",
    startDate: "2024-06-20",
    endDate: "2024-08-02",
  },
  {
    id: "ferien-api:herbstferien sachsen 2024-2024-SN",
    title: "Herbstferien Sachsen 2024",
    startDate: "2024-10-07",
    endDate: "2024-10-19",
  },
  {
    id: "ferien-api:weihnachtsferien sachsen 2024-2024-SN",
    title: "Weihnachtsferien Sachsen 2024",
    startDate: "2024-12-23",
    endDate: "2025-01-03",
  },
  {
    id: "ferien-api:winterferien sachsen 2025-2025-SN",
    title: "Winterferien Sachsen 2025",
    startDate: "2025-02-17",
    endDate: "2025-03-01",
  },
  {
    id: "ferien-api:osterferien sachsen 2025-2025-SN",
    title: "Osterferien Sachsen 2025",
    startDate: "2025-04-18",
    endDate: "2025-04-25",
  },
  {
    id: "ferien-api:osterferien sachsen 2025 (beweglicher ferientag)-2025-SN",
    title: "Osterferien Sachsen 2025 (Beweglicher Ferientag)",
    startDate: "2025-05-30",
    endDate: "2025-05-30",
  },
  {
    id: "ferien-api:sommerferien sachsen 2025-2025-SN",
    title: "Sommerferien Sachsen 2025",
    startDate: "2025-06-28",
    endDate: "2025-08-08",
  },
  {
    id: "ferien-api:herbstferien sachsen 2025-2025-SN",
    title: "Herbstferien Sachsen 2025",
    startDate: "2025-10-06",
    endDate: "2025-10-18",
  },
  {
    id: "ferien-api:weihnachtsferien sachsen 2025-2025-SN",
    title: "Weihnachtsferien Sachsen 2025",
    startDate: "2025-12-22",
    endDate: "2026-01-02",
  },
  {
    id: "ferien-api:winterferien sachsen 2026-2026-SN",
    title: "Winterferien Sachsen 2026",
    startDate: "2026-02-09",
    endDate: "2026-02-22",
  },
  {
    id: "ferien-api:osterferien sachsen 2026-2026-SN",
    title: "Osterferien Sachsen 2026",
    startDate: "2026-04-03",
    endDate: "2026-04-11",
  },
  {
    id: "ferien-api:osterferien sachsen 2026 (beweglicher ferientag)-2026-SN",
    title: "Osterferien Sachsen 2026 (Beweglicher Ferientag)",
    startDate: "2026-05-15",
    endDate: "2026-05-16",
  },
  {
    id: "ferien-api:sommerferien sachsen 2026-2026-SN",
    title: "Sommerferien Sachsen 2026",
    startDate: "2026-07-04",
    endDate: "2026-08-15",
  },
  {
    id: "ferien-api:herbstferien sachsen 2026-2026-SN",
    title: "Herbstferien Sachsen 2026",
    startDate: "2026-10-12",
    endDate: "2026-10-25",
  },
  {
    id: "ferien-api:weihnachtsferien sachsen 2026-2026-SN",
    title: "Weihnachtsferien Sachsen 2026",
    startDate: "2026-12-23",
    endDate: "2027-01-03",
  },
  {
    id: "ferien-api:winterferien sachsen 2027-2027-SN",
    title: "Winterferien Sachsen 2027",
    startDate: "2027-02-08",
    endDate: "2027-02-19",
  },
  {
    id: "ferien-api:osterferien sachsen 2027-2027-SN",
    title: "Osterferien Sachsen 2027",
    startDate: "2027-03-26",
    endDate: "2027-04-02",
  },
  {
    id: "ferien-api:pfingsferien sachsen 2027 (beweglicher ferientag)-2027-SN",
    title: "Pfingsferien Sachsen 2027 (Beweglicher Ferientag)",
    startDate: "2027-05-07",
    endDate: "2027-05-07",
  },
  {
    id: "ferien-api:pfingsferien sachsen 2027-2027-SN",
    title: "Pfingsferien Sachsen 2027",
    startDate: "2027-05-15",
    endDate: "2027-05-18",
  },
  {
    id: "ferien-api:sommerferien sachsen 2027-2027-SN",
    title: "Sommerferien Sachsen 2027",
    startDate: "2027-07-10",
    endDate: "2027-08-20",
  },
  {
    id: "ferien-api:herbstferien sachsen 2027-2027-SN",
    title: "Herbstferien Sachsen 2027",
    startDate: "2027-10-11",
    endDate: "2027-10-23",
  },
  {
    id: "ferien-api:weihnachtsferien sachsen 2027-2027-SN",
    title: "Weihnachtsferien Sachsen 2027",
    startDate: "2027-12-23",
    endDate: "2028-01-01",
  },
  {
    id: "ferien-api:winterferien sachsen 2028-2028-SN",
    title: "Winterferien Sachsen 2028",
    startDate: "2028-02-14",
    endDate: "2028-02-26",
  },
  {
    id: "ferien-api:osterferien sachsen 2028-2028-SN",
    title: "Osterferien Sachsen 2028",
    startDate: "2028-04-14",
    endDate: "2028-04-22",
  },
  {
    id: "ferien-api:osterferien sachsen 2028 (beweglicher ferientag)-2028-SN",
    title: "Osterferien Sachsen 2028 (Beweglicher Ferientag)",
    startDate: "2028-05-26",
    endDate: "2028-05-26",
  },
  {
    id: "ferien-api:sommerferien sachsen 2028-2028-SN",
    title: "Sommerferien Sachsen 2028",
    startDate: "2028-07-22",
    endDate: "2028-09-01",
  },
  {
    id: "ferien-api:herbstferien sachsen 2028-2028-SN",
    title: "Herbstferien Sachsen 2028",
    startDate: "2028-10-23",
    endDate: "2028-11-03",
  },
  {
    id: "ferien-api:weihnachtsferien sachsen 2028-2028-SN",
    title: "Weihnachtsferien Sachsen 2028",
    startDate: "2028-12-23",
    endDate: "2029-01-03",
  },
];

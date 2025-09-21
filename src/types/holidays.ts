export type HolidayRange = {
  /**
   * Stable identifier from the calendar feed. Defaults to a composite key when the feed does not provide a UID.
   */
  id: string;
  /**
   * Display label for the holiday period (e.g. "Sommerferien").
   */
  title: string;
  /**
   * Inclusive ISO date (yyyy-MM-dd) of the first day covered by the holiday.
   */
  startDate: string;
  /**
   * Inclusive ISO date (yyyy-MM-dd) of the last day covered by the holiday.
   */
  endDate: string;
};

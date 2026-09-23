export type ChronikCastEntry = {
  role: string;
  players: string[];
};

export type ChronikMeta = {
  author?: string | null;
  director?: string | null;
  venue?: string | null;
  ticket_info?: string | null;
  organizer?: string | null;
  transport?: string | null;
  sources?: string[] | null;
  gallery?: string[] | null;
  evidence?: string[] | null;
  quotes?: string[] | null;
  cast?: ChronikCastEntry[] | null;
};

export type ChronikPreparedItem = {
  id: string;
  year: number;
  title: string | null;
  synopsis: string | null;
  dates: string | null;
  posterSources: string[];
  meta: ChronikMeta | null;
};

export type ShowMeta = {
  author?: string | null;
  director?: string | null;
  venue?: string | null;
  organizer?: string | null;
  transport?: string | null;
  ticket_info?: string | null;
  cast?: CastEntry[] | null;
  sources?: string[] | null;
  gallery?: string[] | null;
  evidence?: string[] | null;
  quotes?: string[] | null;
};

export type CastEntry = {
  role: string;
  players: string[];
};

export type ShowRecord = {
  id: string;
  year: number;
  title: string | null;
  synopsis: string | null;
  dates: string | null;
  posterUrl: string | null;
  revealedAt: string | null;
  meta: ShowMeta | null;
};

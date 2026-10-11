import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookingForm } from "@/components/karten/public/booking-form";
import { publicWebsiteUrl } from "@/lib/karten/context";
import { showDisplayTitle } from "@/lib/karten/mails";
import { loadPublicShow } from "@/lib/karten/queries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ showId: string }>;
  searchParams: Promise<{ vorstellung?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { showId } = await params;
  const data = await loadPublicShow(showId);
  return { title: data ? showDisplayTitle(data.show) : "Karten" };
}

export default async function PublicShowTicketsPage({ params, searchParams }: Props) {
  const [{ showId }, { vorstellung }] = await Promise.all([params, searchParams]);
  const data = await loadPublicShow(showId);
  if (!data) notFound();
  const { show, performances, categories } = data;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Karten reservieren</p>
        <h1 className="text-2xl font-semibold md:text-3xl">{showDisplayTitle(show)}</h1>
        {show.ticketingSettings?.infoText ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {show.ticketingSettings.infoText}
          </p>
        ) : null}
      </div>
      <BookingForm
        showId={show.id}
        initialEventId={vorstellung ?? null}
        maxTickets={show.ticketingSettings?.maxSeatsPerBooking ?? 10}
        privacyUrl={`${publicWebsiteUrl()}/datenschutz`}
        performances={performances.map((row) => ({ ...row, start: row.start.toISOString() }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          priceCents: category.priceCents,
          needsSeat: category.needsSeat,
        }))}
      />
    </div>
  );
}

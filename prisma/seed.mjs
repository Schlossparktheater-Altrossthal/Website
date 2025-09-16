import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  // --- Chronik: use ONLY the provided Altroßthal data below ---

  // Altroßthal data provided (curated demo -> replace with real assets later)
  const altData = [
    {"year":2009,"title":"Die lustigen Weiber von Windsor","author":"William Shakespeare","dates":null,"location":"Schlosspark Altroßthal, Dresden","director":"Toni Burghard Friedrich","organizer":"BSZ für Agrarwirtschaft & Ernährung (BG/FO)","sources":["https://bsz-ae-dd.de/schulleben/theater/","https://bsz-ae-dd.de/wir-ueber-uns/schulchronik/"],"evidence_snippets":["Seit 2009 ... unter der Regie des theaterbegeisterten Schülers Toni Friedrich ... jährlich ein Stück.","2009 fand das erste mehrtägige Sommertheater ... Die lustigen Weiber von Windsor."],"images":[]},
    {"year":2010,"title":"Im weißen Rössl","author":"Ralph Benatzky (frei)","dates":null,"location":"Schlosspark Altroßthal","director":"Toni Burghard Friedrich","sources":["https://www.elbmargarita.de/2014/07/goethes-faust-unter-freiem-himmel/"],"evidence_snippets":["Es folgten ... Benatzkys „Im weißen Rössl ...“ (2010)"],"images":[]},
    {"year":2011,"title":"Der Besuch der alten Dame","author":"Friedrich Dürrenmatt","dates":null,"location":"Schlosspark Altroßthal","director":"Toni Burghard Friedrich","sources":["https://www.elbmargarita.de/2014/07/goethes-faust-unter-freiem-himmel/"],"evidence_snippets":["... Dürrenmatts „Der Besuch der alten Dame“ (2011) ..."],"images":[]},
    {"year":2012,"title":"Der Ring des Nibelungen (frei)","author":"nach Richard Wagner","dates":null,"location":"Schlosspark Altroßthal","director":"Toni Burghard Friedrich","sources":["https://www.elbmargarita.de/2014/07/goethes-faust-unter-freiem-himmel/"],"evidence_snippets":["... frei nach Wagner inszenierte „Der Ring des Nibelungen“ (2012) ..."],"images":[]},
    {"year":2013,"title":"Maria Stuart","author":"Friedrich Schiller","dates":null,"location":"Schlosspark Altroßthal","director":"Toni Burghard Friedrich","sources":["https://www.elbmargarita.de/2014/07/goethes-faust-unter-freiem-himmel/","https://www.elbmargarita.de/2015/07/das-biest-mit-schulterpolstern/"],"evidence_snippets":["... Shakespeares „Maria Stuart“ (2013) ... (sic – Artikel erwähnt Spiel in 2013)","Darstellerin war 2013 in „Maria Stuart“ auf der Bühne."],"images":[]},
    {"year":2014,"title":"Faust I","author":"Johann Wolfgang von Goethe","dates":"2014-07-17/2014-07-20","location":"Schlosspark Altroßthal","director":"Toni Burghard Friedrich","sources":["https://www.elbmargarita.de/2014/07/goethes-faust-unter-freiem-himmel/","https://www.elbmargarita.de/2014/07/faust-als-vergnuegliches-sommerstueck/","https://www.facebook.com/erik.hamann.art/posts/wen-interessiert-wie-die-illustrationen-des-faust-programmheftes-von-zeichnungen/807734742590141/"],"evidence_snippets":["Premiere am 17.7., weitere Vorstellungen 18.–20.7., je 20:30 Uhr.","Regie führt – wie jedes Jahr – Toni Burghard Friedrich."],"images":["https://www.elbmargarita.de/2014/07/goethes-faust-unter-freiem-himmel/"]},
    {"year":2015,"title":"Romeo und Julia","author":"William Shakespeare","dates":"2015-07-09/2015-07-12","location":"Schlosspark Altroßthal","director":"Toni Burghard Friedrich","sources":["https://www.elbmargarita.de/2015/07/das-biest-mit-schulterpolstern/"],"evidence_snippets":["Termintipp: 9./10./11./12. Juli, 20:30 Uhr.","Schüler am BSZ Altroßthal zeigen „Romeo und Julia“."],"images":["https://www.elbmargarita.de/2015/07/das-biest-mit-schulterpolstern/"]},
    {"year":2016,"title":"Das Gespenst von Canterville","author":"nach Oscar Wilde","dates":"2016-06-23/2016-06-26","location":"Schlosspark Altroßthal","director":"Toni Burghard Friedrich","sources":["https://www.elbmargarita.de/2016/06/altrossthal/"],"evidence_snippets":["Termine: 23., 24., 25. und 26. Juni, 20 Uhr.","... Regisseur Toni Burghard Friedrich ..."],"images":["https://www.elbmargarita.de/2016/06/altrossthal/"]},
    {"year":2018,"title":"Das Bildnis des Dorian Gray","author":"frei nach Oscar Wilde","dates":"2018-06-28/2018-07-01 20:00","location":"Schlossparktheater Altroßthal 1, Dresden","director":"Uta Gebhardt","ticket_info":"7€ (erm. 5€), AK ab 19:00","transport":"Straßenbahn 6/7/12 → Bus 90","sources":["https://www.dresden.de/de/rathaus/aktuelles/pressemitteilungen/archiv/2018/06/pm_103.php"],"evidence_snippets":["Regie: Theaterpädagogin Uta Gebhardt.","Premiere 28. Juni 2018; weitere Vorst. 28.–30.6. & 1.7. (20 Uhr)."],"images":[]},
    {"year":2019,"title":"Lysistrate’s Weber","author":"Jens Bache","dates":null,"location":"Schlosspark Altroßthal","director":"Jens Bache","sources":["https://stadttheaterbremerhaven.de/jens-bache/"],"evidence_snippets":["Im Sommer 2019 hatte sein Stück „Lysistrate’s Weber“ im Schlossparktheater Altroßthal Premiere."],"images":[]},
    {"year":2021,"title":"Robin Hood","author":"frei nach der Legende","dates":"2021 (geplant; tbd)","location":"Schlosspark Altroßthal","director":"Elke Zeh","sources":["https://www.dresdner-stadtteilzeitungen.de/ausbildung-am-schulstandort-altrossthal/"],"evidence_snippets":["Seit nunmehr elf Jahren ... Sommertheater ... In diesem Jahr wird ... Elke Zeh ... „Robin Hood“ inszenieren."],"images":[]},
    {"year":2023,"title":"Die geheimnisvolle Schokoladenfabrik","author":"nach Roald Dahl / Filmadaption","dates":"2023-06-29/2023-07-02 (4 Aufführungen)","location":"Schlosspark Altroßthal","director":"Renné Tarbot","sources":["https://www.radiodresden.de/beitrag/altrossthal-sommertheater-startet-wieder-781708/","https://m.facebook.com/Schlossparktheater/videos/8-sommertheater-in-altro%C3%9Fthal/500706266779637/"],"evidence_snippets":["Regisseur Renné Tarbot ... vier Aufführungen bis Sonntag.","Schlossparktheater-Seite nennt Saison & Rückblicke."],"images":["https://www.facebook.com/Schlossparktheater/videos/8-sommertheater-in-altro%C3%9Fthal/500706266779637/"]},
    {"year":2024,"title":"Bunbury oder wie wichtig es ist, Ernst zu sein","author":"Oscar Wilde (frei)","dates":"2024 (Sommer)","location":"Schlosspark Altroßthal","director":"Elke Zeh","sources":["https://www.facebook.com/photo.php?fbid=925844209547215&id=100063649327037&set=a.380157217449253"],"evidence_snippets":["FB-Grafik/Ankündigung: Sommertheater 2024: „Bunbury ...“, Regie Elke Zeh."],"images":["https://www.facebook.com/photo.php?fbid=925844209547215&id=100063649327037&set=a.380157217449253"]},
    {"year":2025,"title":"Odysseus’ irre Irrfahrten","author":"nach Homer","dates":"2025-06-19/2025-06-22 18:30 (Einlass 17:00)","location":"Schlossparkbühne Altroßthal, BSZ AE, Altroßthal 1, Dresden","director":"Hannes Sell","press_quotes":["„…gehört zur DNA des Dresdner Westens!“ – Bericht/Fotostrecke"],"sources":["https://www.radiodresden.de/beitrag/grosser-tag-am-bsz-in-altrossthal-870010/","https://www.facebook.com/BSZ.AE.DD/posts/-jedes-jahr-ein-highlightso-schrieb-uns-ein-treuer-theatergast-und-wir-freuen-un/1267896945341938/","https://www.instagram.com/bsz_ae_dd/p/DK4IywOoDUU/","https://www.instagram.com/p/DKy3pAGI8Ta/","https://www.felix-hitzig.de/personen/19-juni-2025-sommertheater-im-schlosspark"],"evidence_snippets":["17. Aufführung insgesamt; Regie: Hannes Sell; Do–So 18:30.","FB/IG mit Terminen, Teasern & Bildern.","Fotobericht vom 19.06.2025."],"images":["https://www.instagram.com/p/DKy3pAGI8Ta/","https://www.facebook.com/BSZ.AE.DD/posts/-jedes-jahr-ein-highlightso-schrieb-uns-ein-treuer-theatergast-und-wir-freuen-un/1267896945341938/","https://www.felix-hitzig.de/personen/19-juni-2025-sommertheater-im-schlosspark"]}
  ];

  for (const d of altData) {
    const id = `altrossthal-${d.year}`;
    const meta = {
      author: d.author ?? null,
      director: d.director ?? null,
      venue: d.location ?? null,
      organizer: d.organizer ?? null,
      sources: d.sources ?? [],
      evidence: d.evidence_snippets ?? [],
      quotes: d.press_quotes ?? [],
      gallery: d.images ?? [],
      ticket_info: d.ticket_info ?? null,
      transport: d.transport ?? null,
    };
    const revealedAt = new Date(`${d.year}-06-01T12:00:00Z`);
    await prisma.show.upsert({
      where: { id },
      update: {
        year: d.year,
        title: d.title,
        synopsis: d.author ? `${d.author}` : null,
        dates: d.dates ?? null,
        posterUrl: `https://picsum.photos/seed/${d.year}/800/1200`,
        revealedAt,
        meta,
      },
      create: {
        id,
        year: d.year,
        title: d.title,
        synopsis: d.author ? `${d.author}` : null,
        dates: d.dates ?? null,
        posterUrl: `https://picsum.photos/seed/${d.year}/800/1200`,
        revealedAt,
        meta,
      },
    });
  }

  // Remove demo shows not in provided list
  const keepIds = altData.map((d) => `altrossthal-${d.year}`);
  await prisma.show.deleteMany({
    where: {
      OR: [
        { id: "seed-show" },
        {
          AND: [
            { id: { startsWith: "altrossthal-" } },
            { NOT: { id: { in: keepIds } } },
          ],
        },
      ],
    },
  });

  const emails = [
    "member@example.com",
    "cast@example.com",
    "tech@example.com",
    "board@example.com",
    "finance@example.com",
    "admin@example.com",
  ];
  const roles = ["member", "cast", "tech", "board", "finance_admin", "admin"];
  const defaultPasswordHash = await bcrypt.hash("password", 10);

  for (let i = 0; i < emails.length; i++) {
    await prisma.user.upsert({
      where: { email: emails[i] },
      update: { passwordHash: defaultPasswordHash },
      create: {
        email: emails[i],
        name: emails[i].split("@")[0],
        role: roles[i],
        passwordHash: defaultPasswordHash,
      },
    });
    const userRecord = await prisma.user.findUnique({ where: { email: emails[i] } });
    if (userRecord) {
      await prisma.userRole.upsert({
        where: { userId_role: { userId: userRecord.id, role: roles[i] } },
        update: {},
        create: { userId: userRecord.id, role: roles[i] },
      });
    }
  }

  // Link a sample rehearsal to the newest chronik show (if present)
  const newest = await prisma.show.findFirst({ orderBy: { year: "desc" } });
  if (newest) {
    await prisma.rehearsal.upsert({
      where: { id: `rehearsal-${newest.id}` },
      update: {},
      create: {
        id: `rehearsal-${newest.id}`,
        showId: newest.id,
        start: new Date(Date.now() + 1000 * 60 * 60 * 24),
        end: new Date(Date.now() + 1000 * 60 * 60 * 26),
        location: "Schlosspark",
        requiredRoles: ["cast", "tech"],
      },
    });

    const seedRehearsalId = `rehearsal-${newest.id}`;
    const existingLogs = await prisma.rehearsalAttendanceLog.count({
      where: { rehearsalId: seedRehearsalId },
    });

    if (existingLogs === 0) {
      const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
      if (adminUser) {
        const defaultTargets = await prisma.user.findMany({
          where: { role: { in: ["member", "cast", "tech"] } },
          select: { id: true },
        });

        for (const target of defaultTargets) {
          await prisma.rehearsalAttendanceLog.create({
            data: {
              rehearsalId: seedRehearsalId,
              userId: target.id,
              next: null,
              comment: "Initial: automatisch eingeplant",
              changedById: adminUser.id,
            },
          });
        }
      }
    }
  }

  // Create default rehearsal templates
  const defaultTemplates = [
    {
      id: "weekend-saturday",
      name: "Samstag Probe",
      description: "Standard Samstag-Probe",
      weekday: 6, // Samstag
      startTime: "14:00",
      endTime: "17:00",
      location: "Schlosspark Altroßthal",
      requiredRoles: ["cast", "tech"],
      priority: "NORMAL",
      isActive: true
    },
    {
      id: "weekend-sunday",
      name: "Sonntag Probe",
      description: "Standard Sonntag-Probe",
      weekday: 0, // Sonntag
      startTime: "14:00",
      endTime: "17:00",
      location: "Schlosspark Altroßthal",
      requiredRoles: ["cast", "tech"],
      priority: "NORMAL",
      isActive: true
    },
    {
      id: "tech-rehearsal",
      name: "Technik-Probe",
      description: "Technische Probe vor Aufführungen",
      weekday: 5, // Freitag
      startTime: "18:00",
      endTime: "21:00",
      location: "Schlosspark Altroßthal",
      requiredRoles: ["cast", "tech"],
      priority: "HIGH",
      isActive: false // Nur bei Bedarf aktivieren
    }
  ];

  for (const template of defaultTemplates) {
    await prisma.rehearsalTemplate.upsert({
      where: { id: template.id },
      update: template,
      create: template
    });
  }

  // Seed a few availability entries/templates for a test user
  const seedUser = await prisma.user.findFirst({ where: { email: "member@example.com" } });
  if (seedUser) {
    const base = new Date();
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth(); // 0-based
    // A few specific days
    const mkDate = (day) => new Date(Date.UTC(y, m, day));
    await prisma.availabilityDay.createMany({
      data: [
        { userId: seedUser.id, date: mkDate(5), kind: "FULL_AVAILABLE", note: "frei" },
        { userId: seedUser.id, date: mkDate(6), kind: "FULL_UNAVAILABLE", note: "Familie" },
        { userId: seedUser.id, date: mkDate(7), kind: "PARTIAL", availableFromMin: 17 * 60, availableToMin: 20 * 60, note: "nach der Arbeit" },
      ],
      skipDuplicates: true,
    });
    // Simple weekday template (Mo–Fr abends verfügbar)
    await prisma.availabilityTemplate.createMany({
      data: [1, 2, 3, 4, 5].map((wd) => ({
        userId: seedUser.id,
        weekday: wd,
        kind: "PARTIAL",
        availableFromMin: 18 * 60,
        availableToMin: 21 * 60,
      })),
      skipDuplicates: true,
    });
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});

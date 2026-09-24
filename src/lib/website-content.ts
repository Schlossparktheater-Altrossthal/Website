// Statische Inhalte der öffentlichen Website.
// Die Texte sind fest im Code hinterlegt und werden nicht mehr über ein CMS gepflegt.

export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqContent = {
  items: FaqItem[];
};

export type ParagraphsContent = {
  paragraphs: string[];
};

export type StatItem = {
  label: string;
  value: string;
  detail: string;
};

export type StatsContent = {
  items: StatItem[];
};

export type MilestoneItem = {
  year: string;
  title: string;
  description: string;
};

export type MilestonesContent = {
  items: MilestoneItem[];
};

export type IconItem = {
  icon: string;
  title: string;
  description: string;
};

export type IconItemsContent = {
  items: IconItem[];
};

export const HOME_FAQ: FaqContent = {
  items: [
    {
      question: "Was ist das Sommertheater im Schlosspark?",
      answer:
        "Unser Sommertheater vereint Musik, Schauspiel und eine Prise Geheimnis vor der einzigartigen Kulisse des Schlossparks. Wir gestalten jedes Jahr ein neues Stück, das unser Publikum aller Altersgruppen begeistert und zum Staunen einlädt.",
    },
    {
      question: "Wann startet der Ticketverkauf?",
      answer:
        "Der Ticketverkauf wird über den Instagram-Kanal der Schule bekanntgegeben. Folge uns dort, um nichts zu verpassen.",
    },
    {
      question: "Wo finden die Aufführungen statt?",
      answer:
        "Die Vorstellungen finden im Schlosspark Altroßthal statt. Adresse: BSZ für Agrarwirtschaft und Ernährung Dresden, Altroßthal 1, 01169 Dresden.",
    },
    {
      question: "Wie lange dauern die Vorstellungen?",
      answer: "Die Vorstellungen dauern durchschnittlich 1,5 Stunden und beinhalten eine Pause.",
    },
    {
      question: "Gibt es eine Altersempfehlung?",
      answer: "Das Stück richtet sich an alle Altersgruppen.",
    },
  ],
};

export const SCHULKATZE_INTRO: ParagraphsContent = {
  paragraphs: [
    "Dieter Dennis von Altroßthal – von allen nur Dieter genannt – war unsere grau getigerte Schulkatze. Über Generationen hinweg streifte er über das Schulgelände und wurde zum vertrauten Gesicht des BSZ Altroßthal.",
    "Niemand wusste genau, seit wann er da war; gefühlt waren es weit über fünfzehn Jahre. Seine stille Präsenz begleitete Unterricht, Proben und Aufführungen gleichermaßen.",
    "2025 mussten wir uns von Dieter verabschieden. Die Erinnerungen an ihn, seine Gelassenheit und die Fürsorge der Schulgemeinschaft bleiben und prägen, wie wir auch künftig füreinander da sind.",
  ],
};

export const UEBER_UNS_INTRO: ParagraphsContent = {
  paragraphs: [
    "Wir erzählen Geschichten für laue Sommernächte. Unser Ensemble verbindet professionelle Theaterarbeit mit ehrenamtlichem Herzblut – mitten im Schlosspark Altrossthal.",
    "Gegründet wurde das Sommertheater 2009 vom damaligen Schüler Toni Burghard Friedrich. Seitdem treffen sich Lernende, Alumni und Freund:innen des BSZ Altroßthal, um eine Bühne zu schaffen, die weit über klassischen Unterricht hinausgeht.",
    "Das Ensemble besteht aus Schüler:innen des Beruflichen Gymnasiums und der Fachoberschule, Auszubildenden aus Landwirtschaft, Floristik, Konditorei und vielen weiteren Gewerken sowie Freund:innen des Beruflichen Schulzentrums für Agrarwirtschaft und Ernährung Dresden.",
    "Die Regie übernehmen meist professionelle Schauspieler:innen oder Regisseur:innen, die ihre Erfahrung teilen und gemeinsam mit uns neue Sommerstücke entwickeln.",
  ],
};

export const UEBER_UNS_STATS: StatsContent = {
  items: [
    {
      label: "Gründung",
      value: "2009",
      detail: 'Premiere mit "Die lustigen Weiber von Windsor" im Schlosspark',
    },
    { label: "Ensemble", value: "45+", detail: "Darstellende, Musiker:innen und helfende Hände" },
    { label: "Publikum", value: "400+", detail: "Gäste pro Aufführung" },
    { label: "Aufführungen", value: "4", detail: "pro Saison" },
  ],
};

export const UEBER_UNS_MILESTONES: MilestonesContent = {
  items: [
    {
      year: "2008",
      title: "Theatergruppe im Kulturpalast",
      description:
        'Schüler:innen des BSZ schließen sich erstmals als Theatergruppe zusammen und zeigen "Fluch(t)weg" im Studiotheater des Kulturpalastes.',
    },
    {
      year: "2009",
      title: "Die erste Inszenierung",
      description:
        'Toni Burghard Friedrich initiiert das Sommertheater mit "Die lustigen Weiber von Windsor" und schafft einen neuen Ort für Schüler:innen des BSZ.',
    },
    {
      year: "2017",
      title: "Werkstatt-Ateliers",
      description:
        "Neue Workshops ermöglichen Schüler:innen, sich in Lichttechnik, Metallbau und Kostümhandwerk auszuprobieren und Verantwortung zu übernehmen.",
    },
    {
      year: "2023",
      title: "Digital verbunden",
      description:
        "Livestreams für Menschen, die nicht vor Ort sein können, und ein hybrides Probenformat für unser Ensemble.",
    },
    {
      year: "2023",
      title: "Headsets für präzisen Klang",
      description:
        "Erstes Theaterstück, bei dem Headsets eingesetzt werden, um Stimmen auf der Freiluftbühne noch klarer zu transportieren.",
    },
    {
      year: "2025",
      title: "Eigene Webseite für Produktionen",
      description:
        "Alle Produktionen und Meilensteine erhalten ein digitales Zuhause – die neue Webseite bündelt seitdem Archiv, Tickets und Rückblicke.",
    },
  ],
};

export const UEBER_UNS_SIGNATURE: IconItemsContent = {
  items: [
    {
      icon: "Drama",
      title: "Freiluftbühne im Schlosspark",
      description:
        "Wir verwandeln historische Mauern und alte Baumkronen in eine Bühne voller Atmosphären, Licht und Klang.",
    },
    {
      icon: "Sparkles",
      title: "Storytelling mit Tiefgang",
      description:
        "Jedes Stück entsteht eigens für Altrossthal – poetisch, geheimnisvoll und nah an den Menschen, die uns umgeben.",
    },
    {
      icon: "Trees",
      title: "Schulgelände voller Gewerke",
      description:
        "Schüler:innen des BSZ Altroßthal bringen Floristik, Holz- und Metallbau ein – so wachsen Bühne, Kostüm und Szenografie Hand in Hand.",
    },
  ],
};

export const UEBER_UNS_VALUES: IconItemsContent = {
  items: [
    {
      icon: "HeartHandshake",
      title: "Gemeinschaft",
      description:
        "Im Ensemble wirken Generationen zusammen. Ehrenamt, Professionalität und Nachbarschaft greifen ineinander.",
    },
    {
      icon: "Users",
      title: "Offenheit",
      description:
        "Wir schaffen Räume, in denen neue Stimmen hörbar werden – auf der Bühne, in den Werkstätten und beim Ausprobieren neuer Gewerke.",
    },
    {
      icon: "CalendarHeart",
      title: "Sorgfalt",
      description:
        "Jedes Detail zählt: von der Dramaturgie über die Kostüme bis zur letzten Bankreihe im Park.",
    },
  ],
};

export const UEBER_UNS_TRADES: IconItemsContent = {
  items: [
    {
      icon: "Drama",
      title: "Schauspiel",
      description:
        "Wir entwickeln Szenen gemeinsam und finden für jede Person die passende Herausforderung – vom leisen Spiel bis zur großen Hauptrolle.",
    },
    {
      icon: "Package",
      title: "Requisite",
      description:
        "Vom alten Koffer bis zum magischen Artefakt – die Requisite recherchiert, baut und pflegt alles, was Figuren in den Händen halten.",
    },
    {
      icon: "Shirt",
      title: "Kostüm",
      description:
        "Outfits werden entworfen, zugeschnitten und veredelt. So erzählen Stoffe, Farben und Accessoires eigene Geschichten.",
    },
    {
      icon: "WandSparkles",
      title: "Maske",
      description:
        "Mit Pinseln, Airbrush und viel Fingerspitzengefühl entstehen Charaktere – vom sommerlichen Glow bis hin zu fantastischen Wesen.",
    },
    {
      icon: "Megaphone",
      title: "Werbung",
      description:
        "Stories, Reels und Plakatideen machen Probenprozesse sichtbar und laden unser Publikum frühzeitig in den Schlosspark ein.",
    },
    {
      icon: "AudioLines",
      title: "Soufflage",
      description:
        "Mit Textbuch und Ruhe bewahren die Souffleur:innen den Überblick – und geben im richtigen Moment leise Stichworte.",
    },
    {
      icon: "Music3",
      title: "Musik",
      description:
        "Eigenkompositionen, Chorarrangements und choreografierte Bewegungen verweben Klang und Rhythmus mit der Handlung.",
    },
    {
      icon: "UtensilsCrossed",
      title: "Verpflegung",
      description:
        "Snacks für lange Probentage und liebevoll gedeckte Buffets vor den Shows halten Ensemble und Gäste bei Kräften.",
    },
    {
      icon: "ClipboardList",
      title: "Regieassistenz & Organisation",
      description:
        "Spielpläne, Probenprotokolle und Kontaktlisten laufen hier zusammen – damit jede Premiere punktgenau gelingt.",
    },
    {
      icon: "Zap",
      title: "Technik & Licht",
      description:
        "Von der ersten Probe bis zur Premiere: Unser Technikteam steuert Licht und Ton – damit jeder Moment auf der Bühne sitzt.",
    },
  ],
};

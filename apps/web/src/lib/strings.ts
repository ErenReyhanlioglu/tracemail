// All user-facing copy of the web app, in Turkish (ADR-0033). Components
// import text from here and never contain UI strings of their own.

export const strings = {
  appName: "TraceMail",
  appTagline: "iş arama takip sistemi",
  nav: {
    overview: "Genel bakış",
    postings: "Gelen ilanlar",
    applications: "Başvurularım",
    reports: "Eşleşme raporları",
    health: "Sağlık paneli",
    comingLater: "yakında",
  },
  account: {
    owner: "hesap sahibi",
    signOut: "Çıkış",
    themeToDark: "Karanlık tema",
    themeToLight: "Aydınlık tema",
  },
  login: {
    title: "Giriş",
    body: "Başvuru verileri yalnızca hesap sahibine açıktır.",
    google: "Google ile giriş yap",
  },
  applications: {
    title: "Başvurularım",
    noun: "başvuru",
    sortNote: "son gelişmeye göre sıralı",
    filters: {
      all: "Tümü",
      inProgress: "İlerleme",
      silent: "Sessiz",
      rejected: "Ret",
    },
    columns: {
      application: "Şirket ve pozisyon",
      channel: "Kanal",
      location: "Konum",
      appliedOn: "Başvuru",
      lastEvent: "Son gelişme",
      status: "Durum",
    },
    unknown: "—",
    noTitle: "Pozisyon adı bilinmiyor",
    noCompany: "Şirket bilinmiyor",
    empty: "Bu filtrede başvuru yok.",
    openPosting: (company: string) => `${company} ilanını aç`,
  },
  pagination: {
    label: "Sayfalar",
    previous: "Önceki",
    next: "Sonraki",
    range: (from: number, to: number, total: number, noun: string) =>
      `${from}–${to} / ${total} ${noun}`,
    perPage: "Sayfa başına",
    goToPage: (page: number) => `${page}. sayfa`,
    gap: "Aradaki sayfalar",
  },
  postings: {
    title: "Gelen ilanlar",
    noun: "ilan",
    summary: (count: number, period: string) => `${count} ilan · ${period}`,
    periodLabel: "Dönem",
    // Chip labels, and the same periods inside the summary sentence.
    periods: {
      week: "Son 7 gün",
      month: "Son 30 gün",
      all: "Tümü",
    },
    periodsInSummary: {
      week: "son 7 gün",
      month: "son 30 gün",
      all: "tüm zamanlar",
    },
    statusLabel: "Durum",
    filters: {
      all: "Tümü",
      new: "Yeni",
      saved: "Kaydedilen",
      applied: "Başvurulan",
    },
    columns: {
      posting: "Pozisyon ve şirket",
      location: "Konum",
      firstSeen: "Geliş",
      lastSeen: "Son görülme",
      status: "Durum",
    },
    mentions: (count: number) => `${count} uyarıda`,
    status: {
      new: "Yeni",
      saved: "Kaydedildi",
      applied: (date: string) => `Başvuruldu · ${date}`,
      appliedNoDate: "Başvuruldu",
    },
    empty: "Bu filtrede ilan yok.",
    laterNote:
      "Rol türü, kaba uygunluk ve eşleşme raporu sonraki aşamalarda bu tabloya eklenecek.",
  },
  status: {
    applied: "Yanıt bekleniyor",
    inProgress: "İlerleme",
    rejected: "Ret",
    silentDays: (days: number) => `${days} gündür sessiz`,
    closedWithoutReply: "yanıtsız kapandı",
  },
  lastActivity: {
    today: "bugün",
    daysAgo: (days: number) => `${days} gün önce`,
  },
  channels: {
    linkedin: "LinkedIn",
  } as Record<string, string>,
  errors: {
    unavailable: "Veriler şu an alınamıyor. Biraz sonra tekrar dene.",
  },
} as const;

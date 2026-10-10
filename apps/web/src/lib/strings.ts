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
    pagination: {
      label: "Sayfalar",
      previous: "Önceki",
      next: "Sonraki",
      range: (from: number, to: number, total: number) => `${from}–${to} / ${total} başvuru`,
      perPage: "Sayfa başına",
      goToPage: (page: number) => `${page}. sayfa`,
      gap: "Aradaki sayfalar",
    },
    openPosting: (company: string) => `${company} ilanını aç`,
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

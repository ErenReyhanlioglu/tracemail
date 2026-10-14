// All user-facing copy of the web app, in Turkish (ADR-0033). Components
// import text from here and never contain UI strings of their own.

export const strings = {
  appName: "TraceMail",
  pageTitle: (page: string) => `${page} · TraceMail`,
  // Shown in search results and link previews.
  appDescription:
    "TraceMail, iş başvurularını ve gelen ilanları posta kutusundan saatlik olarak izleyen kişisel bir veri sistemidir.",
  nav: {
    overview: "Genel bakış",
    postings: "Gelen ilanlar",
    applications: "Başvurularım",
    reports: "Eşleşme raporları",
    health: "Sağlık paneli",
    // Not shown as text: for screen readers and the collapsed tooltip.
    comingLater: "yakında",
    ownerOnly: "yalnızca hesap sahibi",
  },
  account: {
    owner: "hesap sahibi",
    visitor: "ziyaretçi",
    signIn: "Giriş",
    signOut: "Çıkış",
    collapseSidebar: "Kenar çubuğunu daralt",
    expandSidebar: "Kenar çubuğunu genişlet",
    themeToDark: "Karanlık tema",
    themeToLight: "Aydınlık tema",
  },
  login: {
    title: "TraceMail'e giriş",
    footnote: "Yalnızca hesap sahibi giriş yapabilir ve yeni hesap oluşturulamaz.",
    google: "Google ile giriş yap",
    backToPanel: "Sağlık paneline dön",
    // Why the API sent the browser back here (ADR-0040).
    errors: {
      not_authorized:
        "Bu Google hesabının giriş yetkisi yok. TraceMail'e yalnızca hesap sahibi giriş yapabilir.",
      failed: "Giriş tamamlanamadı. Tekrar deneyebilirsin.",
    } as Record<string, string>,
  },
  // The public health panel (ADR-0040, ADR-0044): what the system is, then
  // its live measurements. One state vocabulary in every strip and legend.
  health: {
    title: "Sağlık paneli",
    intro:
      "TraceMail, bir iş arama sürecini izleyen kişisel bir veri sistemidir. Başvuru mail kutusunu saatte bir okur, başvuruların ve gelen ilanların durumunu çıkarır. Bu sayfa sistemin kendi çalışmasını gösterir ve kişisel veri içermez.",
    linksLabel: "Bağlantılar",
    sourceCode: "Kaynak kodu",
    decisions: "Mimari kararlar",
    opensInNewTab: "yeni sekmede açılır",
    status: {
      running: "Sistem çalışıyor",
      late: "Çalışma gecikti",
      failed: "Son çalışma başarısız",
      noRun: "Henüz çalışma yok",
      lastRun: (time: string, ago: string) => `son çalışma ${time}, ${ago}`,
      minutesAgo: (minutes: number) => `${minutes} dk önce`,
      hoursAgo: (hours: number) => `${hours} saat önce`,
      daysAgo: (days: number) => `${days} gün önce`,
      streak: (hours: number) => `${hours} saattir kesintisiz`,
      version: "sürüm",
    },
    cells: {
      ok: "sorunsuz",
      skipped: "atlandı, yeni veri yok",
      late: "gecikme",
      failed: "hata",
      none: "kayıt yok",
    },
    stages: {
      title: "Veri nasıl akıyor",
      aside: "Oracle Cloud · Airflow · tracemail_hourly · saatlik",
      stage: "Aşama",
      state: "Durum",
      window: "son 24 saat",
      lastProcessed: "Son işlem",
      median: "Medyan süre",
      medianWindow: "son 7 gün",
      running: "Çalışıyor",
      late: "Gecikti",
      failed: "Hata",
      rows: {
        ingest_mail: { name: "Toplama", detail: "Gmail, ham depo" },
        parse_mail: { name: "Ayrıştırma", detail: "kural tabanlı" },
        load_landing: { name: "Yükleme", detail: "BigQuery" },
        dbt_build: { name: "Modelleme", detail: "dbt" },
      } as Record<string, { name: string; detail: string }>,
      models: (count: number) => `dbt, ${count} model`,
    },
    history: {
      title: "Son 30 gün",
      aside: "gün başına bir kutu",
      from: "30 gün önce",
      today: "bugün",
      freshnessName: "Zamanında işlenen saatler",
      freshnessDetail: (hours: number) =>
        `Her saatin verisi en geç ${hours} saat içinde panele ulaştı mı.`,
      objective: (percent: string) => `hedef ${percent}`,
      onTime: (onTime: number, hours: number) => `${onTime} / ${hours} saat zamanında`,
      dbtName: "dbt build",
      dbtDetail: (models: number, tests: number) =>
        `${models} model kuruldu ve ${tests} test geçti mi.`,
      buildsOk: "build başarılı",
      lastBuild: (passed: number, tests: number, documented: number, models: number) =>
        `son build ${passed} / ${tests} test, ${documented} / ${models} model belgeli`,
    },
    resources: {
      title: "Kaynak kullanımı",
      rows: {
        gcs_class_a: "Cloud Storage, A sınıfı işlem",
        gcs_class_b: "Cloud Storage, B sınıfı işlem",
        gcs_storage_bytes: "Cloud Storage, depolama",
        bigquery_query_bytes: "BigQuery sorgu",
        bigquery_storage_bytes: "BigQuery depolama",
      } as Record<string, string>,
      monthEnd: "ay sonu",
      now: "şu an",
      used: "kullanılan",
      projected: "ay sonu tahmini",
      limit: "aylık kotanın %85'i",
    },
    incidents: {
      title: "Olay kaydı",
      aside: "raporlar GitHub'da",
      open: "Raporu aç",
      solution: "Çözüm.",
      // Owner-approved summaries of docs/incidents (CLAUDE.md, Incidents).
      items: [
        {
          date: "2026-10-12",
          title: "Bir manuel çalıştırma başarısız oldu.",
          body: "Tarih verilmeden başlatılan çalıştırmaların zaman aralığı yoktu. Bu yüzden çalıştırma başarısız oldu, zamanlanmış çalıştırmalar ve veri etkilenmedi.",
          solution: "Bu tür çalıştırmalar artık tetiklendikleri zamanı kullanıyor.",
          report: "2026-10-12-manual-runs-without-a-logical-date.md",
        },
      ],
    },
    footer: (time: string) =>
      `Veriler saatlik çalışma kayıtlarından · ${time} itibarıyla · saatler Türkiye saati`,
  },
  search: {
    label: "Ara",
  },
  table: {
    // Read after a sortable column's name; not shown.
    sortHint: "sırala",
  },
  // Page-level states shared by every list (ADR-0039).
  states: {
    loading: "Liste yükleniyor",
    retry: "Tekrar dene",
    retrying: "Deneniyor",
    unavailableTitle: "Veriler şu an alınamıyor",
    unavailableBody:
      "Sunucuya şu an ulaşılamıyor. Bu genellikle birkaç dakika içinde düzelir.",
  },
  notFound: {
    title: "Sayfa bulunamadı",
    body: "Adresi elle yazdıysan doğru olup olmadığını kontrol et. Bir bağlantıdan geldiysen bağlantı eskimiş olabilir.",
    home: "Ana sayfaya dön",
  },
  errorPage: {
    title: "Bir sorun oluştu",
    body: "Sayfa yüklenirken beklenmeyen bir hata oluştu. Biraz sonra tekrar dene.",
  },
  applications: {
    title: "Başvurularım",
    noun: "başvuru",
    filterLabel: "Durum",
    filters: {
      all: "Tümü",
      waiting: "Yanıt bekleniyor",
      inProgress: "İlerleme",
      rejected: "Ret",
      closed: "Yanıtsız kapandı",
    },
    columns: {
      application: "Pozisyon ve şirket",
      channel: "Kanal",
      location: "Konum",
      appliedOn: "Başvuru",
      lastEvent: "Son gelişme",
      status: "Durum",
    },
    unknown: "—",
    noTitle: "Pozisyon adı bilinmiyor",
    noCompany: "Şirket bilinmiyor",
    emptyTitle: "Henüz başvuru yok",
    emptyBody: "Başvurular, iş arama posta kutusuna gelen maillerden her saat eklenir.",
    noMatch: "Eşleşen başvuru yok.",
    clearFilters: "Filtreleri temizle",
    searchPlaceholder: "Şirket veya pozisyon ara",
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
    periodLabel: "Dönem",
    periods: {
      week: "Son 7 gün",
      month: "Son 30 gün",
      all: "Tüm zamanlar",
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
    emptyTitle: "Henüz ilan yok",
    emptyBody: "İlanlar, iş uyarısı maillerinden her saat eklenir.",
    noMatch: "Eşleşen ilan yok.",
    clearFilters: "Filtreleri temizle",
    searchPlaceholder: "Pozisyon veya şirket ara",
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
} as const;

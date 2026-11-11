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
    // The phone's bottom bar (ADR-0047): five labels across 320 px.
    short: {
      overview: "Özet",
      postings: "İlanlar",
      applications: "Başvurular",
      reports: "Raporlar",
      health: "Sağlık",
    },
    // Not shown as text: for screen readers and the collapsed tooltip.
    comingLater: "yakında",
    ownerOnly: "yalnızca hesap sahibi",
    opensInNewTab: "yeni sekmede açılır",
    // The phone's menu sheet (ADR-0052).
    menu: "Menü",
    openMenu: "Menüyü aç",
    closeMenu: "Menüyü kapat",
    // The sidebar's groups and its quick views of the lists (ADR-0052).
    groups: {
      tracking: "Takip",
      views: "Görünümler",
      system: "Sistem",
      developer: "Geliştiren",
    },
    views: {
      inProgress: "İlerleyenler",
      waiting: "Yanıt bekleyenler",
      saved: "Kaydedilen ilanlar",
      rejected: "Ret alınanlar",
    },
    links: {
      github: "GitHub",
      linkedin: "LinkedIn",
      portfolio: "Portfolyo",
    },
  },
  account: {
    ownerName: "Eren Reyhanlıoğlu",
    ownerInitials: "ER",
    owner: "hesap sahibi",
    visitorName: "Ziyaretçi",
    visitor: "salt okunur",
    signIn: "Giriş yap",
    signOut: "Çıkış yap",
    collapseSidebar: "Kenar çubuğunu daralt",
    expandSidebar: "Kenar çubuğunu genişlet",
    themeToDark: "Karanlık tema",
    themeToLight: "Aydınlık tema",
  },
  login: {
    title: "TraceMail'e giriş",
    lead: "Eren'in iş başvurularını ve gelen ilanlarını izleyen kişisel veri sistemi.",
    footnote: "Yalnızca hesap sahibi giriş yapabilir",
    google: "Google ile giriş yap",
    // The visitor's way on (ADR-0052): a divider, then the health panel
    // with the system's live state.
    visitor: "Ziyaretçi misin",
    toPanel: "Sağlık panelini incele",
    lastRun: (time: string) => `son çalışma ${time}`,
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
    // Read by screen readers while the panel's parts load.
    loading: "Panel yükleniyor",
    intro:
      "TraceMail, gelen postaları izleyen kişisel bir veri sistemidir. Posta kutusunu saatte bir okur, başvuruların ve gelen ilanların durumunu çıkarır. Bu sayfa sistemin kendi çalışmasını gösterir.",
    linksLabel: "Bağlantılar",
    sourceCode: "Kaynak kodu",
    opensInNewTab: "yeni sekmede açılır",
    status: {
      running: "Sistem çalışıyor",
      late: "Çalışma gecikti",
      failed: "Son çalışma başarısız",
      noRun: "Henüz çalışma yok",
      // Label and value apart, so the values can stand out (ADR-0047).
      lastRun: "son çalışma",
      minutesAgo: (minutes: number) => `${minutes} dk`,
      hoursAgo: (hours: number) => `${hours} saat`,
      daysAgo: (days: number) => `${days} gün`,
      streak: (hours: number) => `${hours} saat`,
      streakLabel: "kesintisiz",
      version: "sürüm",
      // The phone's status card (ADR-0052): three labelled cells, and how
      // far a late run is past its target.
      cells: { lastRun: "Son çalışma", streak: "Kesintisiz", version: "Sürüm" },
      delay: (time: string) => `${time} gecikme`,
      none: "—",
    },
    // Short enough for one legend line on a phone (ADR-0047).
    cells: {
      ok: "sorunsuz",
      skipped: "atlandı",
      late: "gecikme",
      failed: "hata",
      none: "kayıt yok",
    },
    stages: {
      title: "Veri nasıl akıyor",
      aside: "Oracle Cloud · Airflow · tracemail_hourly",
      stage: "Aşama",
      state: "Durum",
      window: "son 24 saat",
      lastProcessed: "Son işlem",
      median: "Medyan süre",
      medianWindow: "son 7 gün",
      // A stage's detail line on phones (ADR-0047).
      lastRunShort: "son işlem",
      medianShort: "medyan",
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
      from: "30 gün önce",
      today: "bugün",
      freshnessName: "Zamanında işlenen saatler",
      // A short note instead of a sentence (owner's review).
      freshnessDetail: (hours: number) => `en geç ${hours} saatte`,
      objective: (percent: string) => `hedef ${percent}`,
      onTime: (onTime: number, hours: number) => `${onTime} / ${hours} saat zamanında`,
      dbtName: "dbt build",
      buildsOk: "build başarılı",
      lastBuild: (passed: number, tests: number, documented: number, models: number) =>
        // Without spaces around the slashes, so it fits one phone line.
        `son build ${passed}/${tests} test, ${documented}/${models} model belgeli`,
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
      // The dashed line: the 85% rule (ADR-0017).
      limit: "%85",
    },
    delivery: {
      title: "Teslimat",
      aside: "GitHub Actions · production",
      deployments: "Deploy'lar",
      failedAttempts: (count: number) => `${count} başarısız deneme`,
      lastDeploy: (time: string) => `son deploy ${time}`,
      leadTime: "Değişiklikten yayına",
      changeFailure: "Değişiklik hatası",
      recovery: "Kurtarma süresi",
      rework: "Plansız deploy",
      released: "Yayın",
      change: "Değişiklik",
      duration: "Süre",
      noPullRequest: "doğrudan commit",
      cells: {
        ok: "deploy",
        skipped: "deploy yok",
        failed: "acil müdahale",
        none: "kayıt yok",
      },
    },
    incidents: {
      title: "Olay kaydı",
      open: "Rapor",
      solution: "Çözüm.",
      // Owner-approved summaries of docs/incidents (CLAUDE.md, Incidents).
      items: [
        {
          date: "2026-10-14",
          title: "Sağlık paneli 18 dakika kapalı kaldı.",
          body: "Bir deploy, üretimde henüz oluşmamış veriyi okudu.",
          solution: "Her bölüm artık kendi verisini ayrı yüklüyor.",
          report: "2026-10-14-panel-down-after-the-delivery-deploy.md",
        },
        {
          date: "2026-10-12",
          title: "Bir manuel çalıştırma başarısız oldu.",
          body: "Tarih verilmeden başlatılan çalıştırmaların zaman aralığı yoktu. Bu yüzden çalıştırma başarısız oldu, zamanlanmış çalıştırmalar ve veri etkilenmedi.",
          solution: "Bu tür çalıştırmalar artık tetiklendikleri zamanı kullanıyor.",
          report: "2026-10-12-manual-runs-without-a-logical-date.md",
        },
      ],
    },
    // The page's foot (ADR-0052): where the data comes from, and when it
    // was read.
    footerSource: "Airflow çalışma kayıtları · saatte bir güncellenir",
    footerReadAt: "Son güncelleme",
    footerZone: "(UTC+3)",
  },
  // The lists' sort menu (ADR-0052), shared by both lists.
  sortMenu: {
    label: "Sıralama",
    heading: "Sırala",
    reset: "Varsayılan sıralamaya dön",
  },
  // The lists' mailbox pill (ADR-0052): when the mailbox was last read,
  // in the system state's tone.
  freshness: {
    source: "Gmail",
    label: "Posta kutusu son okunma",
    ago: (time: string) => `${time} önce`,
    failed: "son çalışma başarısız",
    noRun: "henüz çalışma yok",
  },
  // A private section seen by a visitor: what it holds, never its data.
  locked: {
    title: "Bu bölüm yalnızca hesap sahibine açık",
    held: (what: string) =>
      `${what} burada tutuluyor. Kişisel veri olduğu için bu sayfaya hiç gönderilmiyor.`,
    sections: {
      overview: "Başvuru sayıları, yanıt oranları ve takip bekleyenlerin özeti",
      postings: "Gelen ilanlar ve durumları",
      applications: "Her başvurunun aşaması ve kaç gündür yanıt beklendiği",
      reports: "İlan gereksinimlerinin profildeki kanıtla karşılaştırması",
    },
    panelLink: "Sistemin nasıl çalıştığını gör",
    comingTitle: "Bu bölüm yakında",
    comingBody: "Bu bölümün verisi sonraki aşamalarda gelecek.",
    // The pixel font has no lowercase dotless i, so game text stays upper case.
    game: {
      mail: "1 yeni mail",
      canvas: "Mini oyun. Zıplamak için Space, yukarı ok ya da tıklama.",
      close: "Oyunu kapat",
      muteOn: "Sesi kapat",
      muteOff: "Sesi aç",
      hint: "SPACE · ↑ · TIK İLE ZIPLA",
      // Touch screens have no Space key (ADR-0047).
      hintTouch: "DOKUN VE ZIPLA",
      over: "POSTA TESLİM EDİLEMEDİ",
      restart: "TEKRAR İÇİN SPACE",
      restartTouch: "TEKRAR İÇİN DOKUN",
    },
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
    // What failed, as far as the web server can tell (ADR-0050).
    failures: {
      unreachable: "Sunucuya şu an ulaşılamıyor",
      warehouse: "Veri ambarı şu an yanıt vermiyor",
      busy: "Kısa sürede çok fazla istek geldi",
      error: "Veriler şu an alınamıyor",
    },
    autoRetrySeconds: "sn içinde kendiliğinden yeniden denenecek.",
    retryingNow: "Yeniden deneniyor.",
  },
  notFound: {
    title: "Bu adrese hiç posta gelmedi",
    body: "Adresi elle yazdıysan doğru olup olmadığını kontrol et. Bir bağlantıdan geldiysen bağlantı eskimiş olabilir.",
    status: "HTTP 404",
    toPanel: "Sağlık paneline git",
  },
  errorPage: {
    title: "Bu istek teslim edilemedi",
    body: "Sayfa yüklenirken beklenmeyen bir hata oluştu. Birkaç saniye sonra tekrar dene. Sorun sürerse aşağıdaki kodu paylaşman yeterli.",
    protocol: "HTTP",
    code: "500",
    request: "istek",
    copy: "Kodu kopyala",
    copied: "Kopyalandı",
  },
  applications: {
    title: "Başvurularım",
    noun: "başvuru",
    filterLabel: "Durum",
    // The sort menu (ADR-0052): long names in the menu, short ones on its
    // button.
    sort: {
      last_event: { label: "En son gelişme", short: "Son gelişme" },
      applied: { label: "En yeni başvuru", short: "Yeni başvuru" },
      silence: { label: "En uzun süredir yanıtsız", short: "Bekleme süresi" },
      company: { label: "Şirkete göre (A–Z)", short: "Şirket A–Z" },
    },
    filters: {
      all: "Tümü",
      waiting: "Yanıtsız",
      inProgress: "İlerleme",
      rejected: "Ret",
      closed: "Kapandı",
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
    // Read aloud for the period chip's cross (ADR-0052).
    resetPeriod: "Varsayılan döneme dön",
    // The sort menu (ADR-0052): long names in the menu, short ones on its
    // button. The match score waits for Phase 2 and cannot be chosen yet.
    sort: {
      last_seen: { label: "En son görülen", short: "Son görülen" },
      first_seen: { label: "En yeni gelen", short: "Yeni gelen" },
      mentions: { label: "En çok uyarıda görülen", short: "Uyarı sayısı" },
      match: { label: "Eşleşme skoru en yüksek", short: "Eşleşme" },
    },
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
  },
  status: {
    applied: "Yanıtsız",
    inProgress: "İlerleme",
    rejected: "Ret",
    // The badge shows the days; screen readers hear the sentence.
    silentDays: (days: number) => `${days}+`,
    silentDaysSpoken: (days: number) => `${days} gündür sessiz`,
    closedWithoutReply: "Kapandı",
  },
  lastActivity: {
    today: "bugün",
    daysAgo: (days: number) => `${days} gün önce`,
  },
  channels: {
    linkedin: "LinkedIn",
  } as Record<string, string>,
} as const;

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
      "TraceMail, gelen postaları izleyen kişisel bir veri sistemidir. Posta kutusunu saatte bir okur, başvuruların ve gelen ilanların durumunu çıkarır. Bu sayfa sistemin kendi çalışmasını gösterir.",
    linksLabel: "Bağlantılar",
    sourceCode: "Kaynak kodu",
    decisions: "Mimari kararlar",
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
      ago: "önce",
      streak: (hours: number) => `${hours} saat`,
      streakLabel: "kesintisiz",
      version: "sürüm",
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
      unavailable: "Teslimat verileri şu an alınamıyor.",
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
    footer: (time: string) =>
      `Veriler saatlik çalışma kayıtlarından · ${time} itibarıyla · saatler Türkiye saati`,
  },
  // A private section seen by a visitor: what it holds, never its data.
  locked: {
    title: "Bu bölüm yalnızca hesap sahibine açık",
    held: (what: string) =>
      `${what} burada tutuluyor. Kişisel veri olduğu için bu sayfaya hiç gönderilmiyor.`,
    sections: {
      overview: "Başvuru sayıları, yanıt oranları ve takip bekleyenlerin özeti",
      postings: "Gelen ilanlar ve profile uyum sıralaması",
      applications: "Her başvurunun aşaması ve kaç gündür yanıt beklendiği",
      reports: "İlan gereksinimlerinin profildeki kanıtla karşılaştırması",
    },
    panelLink: "Sistemin nasıl çalıştığını sağlık panelinde gör",
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

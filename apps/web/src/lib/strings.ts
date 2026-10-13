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
  // The public health panel's introduction (ADR-0040): what the system is
  // and how it works, with no numbers until live metrics arrive.
  health: {
    title: "Sağlık paneli",
    intro:
      "TraceMail, bir iş arama sürecini izleyen kişisel bir veri sistemidir. Başvuru mail kutusunu saatte bir okur, başvuruların ve gelen ilanların durumunu çıkarır. Bu sayfa sistemin kendi çalışmasını anlatır ve kişisel veri içermez.",
    liveTitle: "Canlı ölçümler yolda",
    liveBody:
      "Çalışma geçmişi, ayrıştırma kalitesi ve veri testleri bu sayfada canlı olarak yayınlanacak. Burada görünecek her sayı sistemin gerçek kayıtlarından gelecek.",
    pipelineTitle: "Veri nasıl akıyor",
    pipeline: [
      {
        name: "Gmail",
        body: "Mail kutusu saatte bir ve salt okunur olarak okunur. Hiçbir mail okundu olarak işaretlenmez.",
      },
      {
        name: "Cloud Storage",
        body: "Her mail değiştirilmeden ve yalnızca bir kez yazılır. Sonraki her katman buradan yeniden üretilebilir.",
      },
      {
        name: "Ayrıştırıcılar",
        body: "Kural tabanlı ve sürümlü ayrıştırıcılar her mailden yapılandırılmış bir kayıt çıkarır.",
      },
      {
        name: "BigQuery",
        body: "Kayıtlar veri ambarına günlük bölümler halinde yüklenir.",
      },
      {
        name: "dbt",
        body: "Başvurular, ilanlar ve olaylar modellenir. Her model veri testlerinden geçer.",
      },
      {
        name: "FastAPI ve Next.js",
        body: "Modellenmiş veri bu sitede gösterilir.",
      },
    ],
    pipelineNote:
      "Tüm adımları Airflow saatte bir çalıştırır. Her adım süresini, işlediği hacmi ve bulut işlemlerini kaydeder.",
    principlesTitle: "İlkeler",
    principles: [
      {
        name: "Kaynak değişmez",
        body: "Posta kutusu yalnızca okunur. Ham veri bir kez yazılır ve üzerine yazılmaz.",
      },
      {
        name: "Gizlilik girişte",
        body: "Kişisel hesaplardan ve bültenlerden gelen mailler hiç saklanmaz. Kayıtlarda yalnızca sayıları tutulur.",
      },
      {
        name: "Tekrar çalıştırmak güvenli",
        body: "Aynı zaman aralığı yeniden işlendiğinde sonuç değişmez. Geçmiş günler aynı yoldan yeniden işlenebilir.",
      },
      {
        name: "Her adım ölçülür",
        body: "Süre, hacim ve bulut işlem sayıları her çalışmada kaydedilir. Maliyet ücretsiz kota içinde izlenir.",
      },
      {
        name: "Kararlar kayıtlı",
        body: "Her önemli teknik karar, gerekçesi ve reddedilen seçenekleriyle birlikte yazılıdır.",
      },
    ],
    stackTitle: "Altyapı",
    stack: [
      { name: "Orkestrasyon", value: "Apache Airflow" },
      { name: "Ham depolama", value: "Google Cloud Storage" },
      { name: "Veri ambarı", value: "BigQuery" },
      { name: "Modelleme", value: "dbt" },
      { name: "API", value: "FastAPI" },
      { name: "Arayüz", value: "Next.js" },
      { name: "Çalışma ortamı", value: "Oracle Cloud ARM, Docker Compose" },
      { name: "Ağ", value: "Cloudflare Tunnel, Tailscale" },
      { name: "Test ve dağıtım", value: "GitHub Actions" },
      { name: "Diller", value: "Python, SQL, TypeScript" },
    ],
    roadmapTitle: "Yol haritası",
    roadmap: [
      {
        phase: "Faz 1",
        name: "Çekirdek",
        body: "Mail toplama, ham depolama, veri modeli ve başvuru durumları. Üretimde saatte bir çalışıyor.",
        current: true,
      },
      {
        phase: "Faz 2",
        name: "Zekâ",
        body: "Yanıtların sınıflandırılması ve ilanlarla profil arasında kanıta dayalı eşleşme raporu.",
        current: false,
      },
      {
        phase: "Faz 3",
        name: "Arayüz",
        body: "Bu panelin canlı ölçümleri ve misafirler için paylaşım bağlantıları.",
        current: false,
      },
      {
        phase: "Faz 4",
        name: "İsteğe bağlı",
        body: "Başlık benzerliğiyle kaba uygunluk sıralaması ve küçük eklemeler.",
        current: false,
      },
    ],
    phaseCurrent: "Sürüyor",
    phasePlanned: "Planlandı",
    linksLabel: "Bağlantılar",
    sourceCode: "Kaynak kodu",
    decisions: "Mimari kararlar",
    opensInNewTab: "yeni sekmede açılır",
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

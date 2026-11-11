// Public marketing content for OnGoing, taken from the company projects brief.
// Guards from the brief: no client logos, proposals are not shown as delivered work,
// and items flagged for confirmation (⚠️) are left out until approved.

export const company = {
  nameAr: "Ongoing Events",
  nameEn: "Ongoing Events",
  legalAr: "شركة الحدث المستمر التجارية",
  legalEn: "Al-Hadath Al-Mustamer Trading Co.",
  cr: "7054603050",
  tagline: "من الفكرة إلى التشغيل، ندير فعالياتك باحتراف.",
  taglineEn: "Events, delivered end to end.",
  founded: "2022",
  city: "الرياض، المملكة العربية السعودية",
  founder: "ناصر الشايب",
  phone: "+966 54 490 7788",
  phoneLink: "+966544907788",
  email: "info@ongoingevent.com",
  address: "مبنى 3764، طريق الإمام سعود بن فيصل، حي الملقا، الرياض",
  vision:
    "الريادة في التنمية المستدامة بجعل الفعاليات الإبداعية والثقافية عنصرًا أساسيًا في صناعة التجارب وإحداث التغيير الإيجابي.",
  mission: "إلهام المجتمعات عبر فعاليات استثنائية ومتنوعة تعزّز التنمية والإبداع.",
};

export const stats: { value: string; label: string }[] = [
  { value: "13,770", label: "زائر بتذكرة في صيف وسمرة" },
  { value: "84", label: "يوم تشغيل متواصل" },
  { value: "+24", label: "منطقة تجربة في مشروع واحد" },
  { value: "+10", label: "مشاريع كبرى منفّذة" },
];

export const services: { title: string; items: string[] }[] = [
  {
    title: "إدارة الفعاليات",
    items: [
      "المواهب والفنانون وخدمات VVIP",
      "الضيافة والفنادق والنقل والفاليه",
      "المعارض والأجنحة وورش العمل",
      "الصحة والسلامة والتشغيل الكامل",
      "الرعايات والإعاشة والهدايا التذكارية",
    ],
  },
  {
    title: "حلول الإنتاج",
    items: [
      "تصميم وتصنيع وتركيب الديكور",
      "الصوت والإضاءة والشاشات (AVL)",
      "الطباعة الكبيرة والهوية البصرية",
      "الأسوار وإدارة الحشود",
      "اللوجستيات والتنفيذ الميداني",
    ],
  },
  {
    title: "حلول القوى العاملة",
    items: [
      "منسقو ومديرو المشاريع والتشغيل",
      "الأمن وإدارة الضيوف والمنظمون",
      "سفراء العلامة التجارية",
      "الفنيون ومسؤولو السلامة",
      "فرق النظافة والدعم الميداني",
    ],
  },
  {
    title: "الإعلام والتسويق",
    items: [
      "الفيديوهات الترويجية والمؤسسية",
      "التغطية والبث المباشر",
      "التصوير الفوتوغرافي",
      "إدارة حسابات التواصل",
      "المؤتمرات الصحفية والمراكز الإعلامية",
    ],
  },
  {
    title: "الخدمات الإبداعية",
    items: [
      "بناء الهوية والعلامة التجارية",
      "التصميم ثلاثي الأبعاد",
      "تصميم رحلة الزائر",
      "الهوية البيئية والإنتاج المرئي",
      "المفهوم والمخطط العام",
    ],
  },
  {
    title: "الاستشارات",
    items: [
      "إدارة المواسم",
      "صناعة المحتوى",
      "تصميم التجارب",
      "التخطيط الاستراتيجي والاتصال",
      "التجارب العالمية والاستشارات الدولية",
    ],
  },
];

export type Project = {
  slug: string;
  title: string;
  client: string;
  year: string;
  location: string;
  summary: string;
  highlights: string[];
  metrics?: { value: string; label: string }[];
  cover?: string; // /projects/*.jpg — monochrome at rest, colour on focus
  gallery?: string[];
  category?: string;
  featured?: boolean;
};

export const projects: Project[] = [
  {
    slug: "summer-gathering",
    // cover/gallery: pending the Summer Gathering photo set (none in the archive yet)
    category: "وجهة سياحية وثقافية",
    title: "صيف وسمرة",
    client: "وجهة سياحية في عسير",
    year: "2025",
    location: "منتزه دلغان، أبها",
    summary:
      "تحويل منتزه دلغان إلى وجهة سياحية وثقافية نابضة تجمع الترفيه بالتراث العسيري، مع إشراك الحرفيين ورواد الأعمال المحليين.",
    highlights: [
      "24 منطقة تجربة متكاملة",
      "تجربة حسية: روائح ورذاذ جبلي وإضاءة ليلية",
      "المفهوم والتصميم ثلاثي الأبعاد والهوية والتشغيل والتسويق",
    ],
    metrics: [
      { value: "13,770", label: "تذكرة مباعة" },
      { value: "84", label: "يوم تشغيل" },
      { value: "24", label: "منطقة" },
    ],
    featured: true,
  },
  {
    slug: "sdaia-eid",
    cover: "/projects/og-013-146.jpg",
    gallery: ["/projects/og-013-146.jpg"],
    category: "احتفالات مؤسسية",
    title: "احتفالات عيد الفطر",
    client: "الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)",
    year: "2025",
    location: "10 مناطق بالمملكة",
    summary:
      "تنفيذ متكامل من المفهوم حتى التشغيل في عشر مناطق، مع تفعيل ثمانية مواقع منفصلة في الرياض بينها المبنى الرئيسي.",
    highlights: [
      "ورش صناعة العطور وعربات الضيافة",
      "تزيين كامل وموسيقى ونظام صوت",
      "فاليه لـ 400 سيارة",
    ],
    metrics: [
      { value: "10", label: "مناطق" },
      { value: "8", label: "مواقع بالرياض" },
      { value: "400", label: "سيارة فاليه" },
    ],
    featured: true,
  },
  {
    slug: "jameel-motorsport-park",
    cover: "/projects/jameel-1.jpg",
    gallery: ["/projects/jameel-1.jpg", "/projects/wd/wd-084.jpg", "/projects/jameel-2.jpg", "/projects/wd/wd-087.jpg", "/projects/wd/wd-092.jpg", "/projects/wd/wd-099.jpg", "/projects/wd/wd-104.jpg", "/projects/wd/wd-107.jpg", "/projects/wd/wd-110.jpg", "/projects/jameel-3.jpg"],
    category: "وجهة ترفيهية",
    title: "Jameel Motorsport Park",
    client: "عبد اللطيف جميل — كأس العالم للرياضات الإلكترونية",
    year: "2024",
    location: "بوليفارد رياض سيتي",
    summary:
      "وجهة سباقات عائلية بطابع Rally وجماليات Retro-Futuristic على مساحة تفعيل 530 م² خلال شهرين من التشغيل.",
    highlights: [
      "حلبة وبطولة كارتينج ومحاكيات حركة",
      "ورش تلوين الخوذ والطباعة ثلاثية الأبعاد",
      "فريق تشغيل من 30 فردًا وصيانة يومية",
    ],
    metrics: [
      { value: "530", label: "م² تفعيل" },
      { value: "2", label: "شهر تشغيل" },
      { value: "30", label: "فرد تشغيل" },
    ],
    featured: true,
  },
  {
    slug: "gamers8-haunted-houses",
    cover: "/projects/og-018-171.jpg",
    gallery: ["/projects/og-018-171.jpg", "/projects/og-018-173.jpg"],
    category: "ترفيه غامر",
    title: "بيوت الرعب — Gamers8",
    client: "Gamers8",
    year: "2023",
    location: "الرياض",
    summary:
      "تصميم وبناء وتشغيل بيتَي رعب: فيلا ريفية بواجهة تراثية، ومصنع ومختبر مهجور بطابع صناعي، بمؤثرات صوت وإضاءة وممثلين.",
    highlights: ["تصميم وبناء كامل", "ممثلون وأزياء ومؤثرات", "تشغيل يومي"],
  },
  {
    slug: "eidna-farah-boulevard",
    cover: "/projects/wd/wd-034.jpg",
    gallery: ["/projects/wd/wd-034.jpg", "/projects/wd/wd-030.jpg", "/projects/wd/wd-036.jpg", "/projects/wd/wd-042.jpg", "/projects/wd/wd-045.jpg", "/projects/wd/wd-052.jpg", "/projects/og-026-206.jpg"],
    category: "هوية موسمية",
    title: "لوحة عيد الفطر “عيدنا فرح”",
    client: "بوليفارد رياض سيتي",
    year: "2023",
    location: "بوليفارد رياض سيتي",
    summary:
      "تصميم وتنفيذ لوحة عيد ضخمة بتقنيات إضاءة متقدمة لرفع الجاذبية والرؤية الليلية في عدة بوليفاردات.",
    highlights: ["لوحة ضخمة", "إضاءة متقدمة", "رؤية ليلية عالية"],
  },
  {
    slug: "kku-opening",
    cover: "/projects/wd/wd-211.jpg",
    gallery: ["/projects/wd/wd-211.jpg", "/projects/wd/wd-219.jpg"],
    category: "حفلات وافتتاحات",
    title: "حفل الافتتاح — جامعة الملك خالد",
    client: "جامعة الملك خالد، أبها",
    year: "2024",
    location: "أبها",
    summary:
      "فرقة استعراضية محترفة وتصميم كوريغرافيا خاصة على موسيقى الجامعة، مع البروفات والأزياء وتجهيز المسرح.",
    highlights: ["كوريغرافيا خاصة", "بروفات وأزياء", "تجهيز مسرح"],
  },
  {
    slug: "sabic-carnival",
    category: "فعاليات الموظفين",
    title: "كرنفال سابك",
    client: "سابك (SABIC)",
    year: "2024",
    location: "الرياض",
    summary:
      "سيارات تحكّم عن بعد مع حلبة ومشغّلين، وليزر تاج، وألعاب كرنفال، وفنانون ورسامون وخطّاط، بإدارة كاملة للمشروع.",
    highlights: ["حلبة سيارات تحكّم", "ليزر تاج وألعاب", "فنانون وخطّاط"],
  },
  {
    slug: "sdaia-founding-day",
    cover: "/projects/og-025-202.jpg",
    gallery: ["/projects/og-025-202.jpg"],
    category: "احتفالات تراثية",
    title: "يوم التأسيس — سدايا",
    client: "سدايا (SDAIA)",
    year: "2024",
    location: "الرياض",
    summary:
      "تنظيم احتفال يوم التأسيس: عازفون ومهندس صوت، وأزياء تراثية، وتصوير، وفريق تنظيم متكامل.",
    highlights: ["عازفون ومهندس صوت", "أزياء تراثية", "تصوير وتنظيم"],
  },
  {
    slug: "ittihad-fan-zone",
    category: "مناطق المشجعين",
    title: "منطقة مشجعي الاتحاد",
    client: "نادي الاتحاد",
    year: "2024",
    location: "جدة",
    summary:
      "تنفيذ منطقة المشجعين وفعاليات النادي على مرحلتين، بتجربة متكاملة لجمهور النادي.",
    highlights: ["Fan Zone متكامل", "تنفيذ على مرحلتين", "فعاليات النادي"],
  },
  {
    slug: "mos-gala",
    cover: "/projects/og-020-181.jpg",
    gallery: ["/projects/og-020-181.jpg", "/projects/wd/wd-176.jpg", "/projects/wd/wd-180.jpg", "/projects/wd/wd-181.jpg"],
    title: "عشاء وزارة الرياضة الرسمي",
    client: "وزارة الرياضة",
    year: "2024",
    location: "الرياض",
    summary: "عشاء رسمي بضيافة منسّقة وخدمات ضيوف وترتيبات فنية متكاملة، من تجهيز المكان حتى التشغيل.",
    highlights: ["تجهيز المكان والتخطيط", "ضيافة وخدمات ضيوف", "ترتيبات فنية"],
    category: "ضيافة حكومية",
  },
  {
    slug: "noor-riyadh-gala",
    title: "عشاء نور الرياض",
    client: "الهيئة الملكية لمدينة الرياض",
    year: "2024",
    location: "الرياض",
    summary: "مفهوم عشاء رسمي لنور الرياض وأعضاء الهيئة في أجواء مخيّم، يجمع الطعام بالترفيه الثقافي.",
    highlights: ["مفهوم مخيّم ثقافي", "ترفيه حي", "ضيافة متكاملة"],
    cover: "/projects/og-028-215.jpg",
    gallery: ["/projects/og-028-215.jpg"],
    category: "ضيافة ثقافية",
  },
  {
    slug: "modon-booth",
    cover: "/projects/wd/wd-229.jpg",
    gallery: ["/projects/wd/wd-229.jpg", "/projects/wd/wd-226.jpg", "/projects/wd/wd-234.jpg", "/projects/wd/wd-243.jpg", "/projects/wd/wd-253.jpg", "/projects/og-027-210.jpg"],
    title: "جناح مدن",
    client: "مدن",
    year: "2024",
    location: "الرياض",
    summary: "حضور معرضي بهوية العلامة مع تفاعل الزوار وتشغيل الجناح في الموقع.",
    highlights: ["تصميم وبناء الجناح", "هوية وطباعة", "تشغيل يومي"],
    category: "معارض",
  },
  {
    slug: "sela-booth",
    title: "جناح صلة",
    client: "صلة",
    year: "2024",
    location: "الرياض",
    summary: "جناح معرضي بهوية العلامة لثلاثة أيام مع تشغيل يومي ودعم للزوار.",
    highlights: ["تصميم وبناء", "هوية الجناح", "تشغيل ٣ أيام"],
    cover: "/projects/og-029-220.jpg",
    gallery: ["/projects/og-029-220.jpg"],
    category: "معارض",
  },
  {
    slug: "ewc-signage",
    cover: "/projects/wd/wd-117.jpg",
    gallery: ["/projects/wd/wd-117.jpg", "/projects/wd/wd-120.jpg", "/projects/wd/wd-126.jpg", "/projects/wd/wd-127.jpg", "/projects/wd/wd-132.jpg", "/projects/wd/wd-134.jpg", "/projects/wd/wd-137.jpg", "/projects/wd/wd-138.jpg", "/projects/wd/wd-146.jpg", "/projects/wd/wd-150.jpg", "/projects/og-015-157.jpg"],
    title: "لافتات وهوية مواقع كأس العالم للرياضات الإلكترونية",
    client: "كأس العالم للرياضات الإلكترونية",
    year: "2024",
    location: "الرياض",
    summary: "هوية مواقع ولافتات أكريليك ومطبوعات عبر مساحات الألعاب والترفيه والأكاديمية.",
    highlights: ["لافتات أكريليك", "مطبوعات كبيرة", "تركيب في عدة مواقع"],
    category: "لافتات وهوية مواقع",
  },
  {
    slug: "school-league",
    title: "دوري المدارس — جيل اليوم",
    client: "وزارة التعليم",
    year: "2024",
    location: "الرياض",
    summary: "هوية موقع متكاملة لدوري المدارس: لافتات ومسارات إرشادية، منصّات عرض، وتجهيز القاعات والمسرح.",
    highlights: ["هوية الموقع واللافتات", "مسارات إرشادية ومنصّات", "تجهيز القاعات والمسرح"],
    cover: "/projects/wd/wd-268.jpg",
    gallery: ["/projects/wd/wd-268.jpg", "/projects/wd/wd-269.jpg", "/projects/wd/wd-271.jpg", "/projects/wd/wd-275.jpg", "/projects/wd/wd-293.jpg", "/projects/wd/wd-294.jpg"],
    category: "هوية موقع وفعاليات رياضية",
  },
  {
    slug: "dq-market",
    title: "DQ Market",
    client: "DQ Market",
    year: "2024",
    location: "الرياض",
    summary: "تشغيل فعالية سوق ليلية حيّة: عروض موسيقية جوّالة، إضاءة وأجواء ليلية، وإدارة تدفّق الزوار.",
    highlights: ["عروض موسيقية جوّالة", "إضاءة وأجواء ليلية", "إدارة تدفّق الزوار"],
    cover: "/projects/wd/wd-070.jpg",
    gallery: ["/projects/wd/wd-070.jpg", "/projects/wd/wd-069.jpg", "/projects/wd/wd-071.jpg", "/projects/wd/wd-073.jpg", "/projects/wd/wd-074.jpg"],
    category: "فعاليات حيّة",
  },
];

// The company's own stated clients and partners, shown as names only (no logos).
export const clients: string[] = [
  "وزارة الرياضة",
  "وزارة التعليم",
  "الاتحاد السعودي لكرة القدم",
  "بوليفارد رياض سيتي",
  "سدايا",
  "سابك",
  "عبد اللطيف جميل",
  "كأس العالم للرياضات الإلكترونية",
  "Gamers8",
  "جامعة الملك خالد",
  "نادي الاتحاد",
  "صلة",
  "مدن",
  "أمانة منطقة حائل",
];

import galleryData from "./gallery.json";
export type GalleryItem = { src: string; w: number; h: number; project: string | null; category: string; page: number };
export const gallery: GalleryItem[] = galleryData as GalleryItem[];
export const galleryCategories: string[] = Array.from(new Set(gallery.filter((g) => !g.project).map((g) => g.category)));

export const approach: { step: string; title: string; text: string }[] = [
  { step: "01", title: "الفهم", text: "نقرأ الهدف والجمهور والموقع والميزانية قبل أي رسم." },
  { step: "02", title: "المفهوم", text: "فكرة واحدة واضحة، تُترجم إلى مخطط عام وتصميم ثلاثي الأبعاد." },
  { step: "03", title: "التجهيز", text: "تصنيع، مشتريات، تصاريح، فرق عمل، وجدول تشغيل يومي." },
  { step: "04", title: "التشغيل", text: "فريق ميداني على مدار الساعة، تقارير يومية، وخطة طوارئ." },
  { step: "05", title: "التسليم", text: "تفكيك وإعادة الموقع كما كان، وتقرير ختامي بالأرقام." },
];

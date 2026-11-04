// Public marketing content for OnGoing, taken from the company projects brief.
// Guards from the brief: no client logos, proposals are not shown as delivered work,
// and items flagged for confirmation (⚠️) are left out until approved.

export const company = {
  nameAr: "OnGoing",
  nameEn: "OnGoing",
  legalAr: "OnGoing لإدارة وتنظيم الفعاليات",
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
  accent: string; // tailwind gradient classes for the cover
  featured?: boolean;
};

export const projects: Project[] = [
  {
    slug: "summer-gathering",
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
    accent: "from-amber-500/30 to-rose-500/20",
    featured: true,
  },
  {
    slug: "sdaia-eid",
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
    accent: "from-emerald-500/30 to-teal-500/20",
    featured: true,
  },
  {
    slug: "jameel-motorsport-park",
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
    accent: "from-sky-500/30 to-indigo-500/20",
    featured: true,
  },
  {
    slug: "gamers8-haunted-houses",
    title: "بيوت الرعب — Gamers8",
    client: "Gamers8",
    year: "2023",
    location: "الرياض",
    summary:
      "تصميم وبناء وتشغيل بيتَي رعب: فيلا ريفية بواجهة تراثية، ومصنع ومختبر مهجور بطابع صناعي، بمؤثرات صوت وإضاءة وممثلين.",
    highlights: ["تصميم وبناء كامل", "ممثلون وأزياء ومؤثرات", "تشغيل يومي"],
    accent: "from-fuchsia-500/30 to-purple-500/20",
  },
  {
    slug: "eidna-farah-boulevard",
    title: "لوحة عيد الفطر “عيدنا فرح”",
    client: "بوليفارد رياض سيتي",
    year: "2023",
    location: "بوليفارد رياض سيتي",
    summary:
      "تصميم وتنفيذ لوحة عيد ضخمة بتقنيات إضاءة متقدمة لرفع الجاذبية والرؤية الليلية في عدة بوليفاردات.",
    highlights: ["لوحة ضخمة", "إضاءة متقدمة", "رؤية ليلية عالية"],
    accent: "from-amber-500/30 to-orange-500/20",
  },
  {
    slug: "kku-opening",
    title: "حفل الافتتاح — جامعة الملك خالد",
    client: "جامعة الملك خالد، أبها",
    year: "2024",
    location: "أبها",
    summary:
      "فرقة استعراضية محترفة وتصميم كوريغرافيا خاصة على موسيقى الجامعة، مع البروفات والأزياء وتجهيز المسرح.",
    highlights: ["كوريغرافيا خاصة", "بروفات وأزياء", "تجهيز مسرح"],
    accent: "from-teal-500/30 to-cyan-500/20",
  },
  {
    slug: "sabic-carnival",
    title: "كرنفال سابك",
    client: "سابك (SABIC)",
    year: "2024",
    location: "الرياض",
    summary:
      "سيارات تحكّم عن بعد مع حلبة ومشغّلين، وليزر تاج، وألعاب كرنفال، وفنانون ورسامون وخطّاط، بإدارة كاملة للمشروع.",
    highlights: ["حلبة سيارات تحكّم", "ليزر تاج وألعاب", "فنانون وخطّاط"],
    accent: "from-indigo-500/30 to-blue-500/20",
  },
  {
    slug: "sdaia-founding-day",
    title: "يوم التأسيس — سدايا",
    client: "سدايا (SDAIA)",
    year: "2024",
    location: "الرياض",
    summary:
      "تنظيم احتفال يوم التأسيس: عازفون ومهندس صوت، وأزياء تراثية، وتصوير، وفريق تنظيم متكامل.",
    highlights: ["عازفون ومهندس صوت", "أزياء تراثية", "تصوير وتنظيم"],
    accent: "from-rose-500/30 to-red-500/20",
  },
  {
    slug: "ittihad-fan-zone",
    title: "منطقة مشجعي الاتحاد",
    client: "نادي الاتحاد",
    year: "2024",
    location: "جدة",
    summary:
      "تنفيذ منطقة المشجعين وفعاليات النادي على مرحلتين، بتجربة متكاملة لجمهور النادي.",
    highlights: ["Fan Zone متكامل", "تنفيذ على مرحلتين", "فعاليات النادي"],
    accent: "from-amber-500/30 to-yellow-500/20",
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

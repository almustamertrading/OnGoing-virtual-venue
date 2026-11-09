import type { ProposalStatus, ProposalType } from "./types";

export const PROPOSAL_TYPE: Record<ProposalType, { label: string; en: string }> = {
  technical_financial: { label: "عرض فني ومالي", en: "Technical & Financial" },
  creative_concept: { label: "مفهوم إبداعي للفعالية", en: "Event Concept & Creative" },
  boq_quotation: { label: "جدول كميات وتسعير", en: "BOQ & Budget Quotation" },
  rfp_response: { label: "رد على كراسة/منافسة", en: "RFP / Tender Response" },
  sponsorship: { label: "عرض رعاية", en: "Sponsorship" },
  venue_operations: { label: "عرض موقع وتشغيل", en: "Venue & Operations" },
};

export const PROPOSAL_STATUS: Record<ProposalStatus, { label: string; tone: string }> = {
  draft: { label: "مسودة", tone: "bg-slate-700 text-slate-100" },
  ai_generated: { label: "مولّد بالذكاء", tone: "bg-violet-900 text-violet-100" },
  under_review: { label: "قيد المراجعة", tone: "bg-sky-900 text-sky-100" },
  changes_requested: { label: "مطلوب تعديلات", tone: "bg-amber-900 text-amber-100" },
  approved_internally: { label: "معتمد داخليًا", tone: "bg-teal-900 text-teal-100" },
  sent_to_client: { label: "أُرسل للعميل", tone: "bg-indigo-900 text-indigo-100" },
  awaiting_response: { label: "بانتظار الرد", tone: "bg-sky-900 text-sky-100" },
  accepted: { label: "مقبول", tone: "bg-emerald-900 text-emerald-100" },
  rejected: { label: "مرفوض", tone: "bg-red-950 text-red-200" },
  expired: { label: "منتهٍ", tone: "bg-slate-800 text-slate-300" },
  converted: { label: "تحوّل لمشروع", tone: "bg-emerald-800 text-emerald-100" },
};

// Suggested section headings per proposal type (from the Proposal Builder spec).
export const SECTION_TEMPLATES: Record<ProposalType, string[]> = {
  technical_financial: [
    "الملخص التنفيذي", "فهم متطلبات العميل", "نطاق العمل", "المنهجية المقترحة",
    "مخرجات المشروع", "الجدول الزمني", "هيكل الفريق", "المواصفات الفنية",
    "الشروط التجارية", "الافتراضات والاستثناءات", "شروط الدفع", "مدة الصلاحية",
  ],
  creative_concept: [
    "نظرة عامة على الفعالية", "المفهوم الإبداعي", "الثيم والسرد القصصي", "تجربة الجمهور",
    "مفهوم الموقع والفراغ", "تصميم المسرح والإنتاج", "الهوية البصرية",
    "الصوت والإضاءة والمؤثرات", "الفعاليات والترفيه", "متطلبات الإنتاج", "تقدير الميزانية", "الجدول التنفيذي",
  ],
  boq_quotation: [
    "مقدمة العرض", "نطاق التوريد", "جدول الكميات والتسعير", "البنود الاختيارية",
    "الشروط التجارية", "شروط الدفع", "مدة الصلاحية",
  ],
  rfp_response: [
    "الملخص التنفيذي", "فهم الكراسة", "مصفوفة الالتزام (Compliance)", "الرد الفني",
    "الرد التجاري", "هيكل الفريق", "الجدول الزمني", "الخبرة والمراجع", "المستندات المطلوبة",
  ],
  sponsorship: [
    "نظرة عامة على الفعالية", "ملف الجمهور", "أهداف الرعاية", "باقات الرعاية",
    "مزايا الرعاية", "فرص ظهور العلامة", "فرص التفعيل الميداني",
    "الظهور الرقمي والإعلامي", "خيارات الحصرية", "أسعار الباقات", "شروط الرعاية",
  ],
  venue_operations: [
    "نظرة عامة على الموقع", "متطلبات الموقع", "المفهوم التشغيلي", "مخططات الموقع",
    "الدخول والحركة", "التوجيه واللوحات الإرشادية", "إدارة الحشود", "اللوجستيات والنقل",
    "الطواقم والمسؤوليات", "الصحة والسلامة", "جدول الكميات والميزانية", "جدول التنفيذ",
  ],
};

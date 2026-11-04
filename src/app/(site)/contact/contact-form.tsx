"use client";

import { useState } from "react";
import { company } from "@/lib/site-content";

// No server storage yet: the form composes an email the visitor sends from their own app.
export function ContactForm() {
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [message, setMessage] = useState("");

  const body = encodeURIComponent(`الاسم: ${name}\nالجهة: ${org}\n\n${message}`);
  const href = `mailto:${company.email}?subject=${encodeURIComponent("طلب تواصل من الموقع")}&body=${body}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = href;
      }}
      className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
    >
      <div>
        <label className="mb-1 block text-xs text-slate-400" htmlFor="c-name">الاسم</label>
        <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400/60" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400" htmlFor="c-org">الجهة / الشركة</label>
        <input id="c-org" value={org} onChange={(e) => setOrg(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400/60" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400" htmlFor="c-msg">عن فعاليتك</label>
        <textarea id="c-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} required className="w-full rounded-lg border border-white/10 bg-[#0b1120] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400/60" />
      </div>
      <button className="w-full rounded-lg bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400" disabled={!name || !message}>
        أرسل عبر البريد
      </button>
      <p className="text-center text-xs text-slate-500">سيفتح تطبيق البريد لديك لإرسال الرسالة إلينا.</p>
    </form>
  );
}

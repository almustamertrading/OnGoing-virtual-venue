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
      className="space-y-5 border border-line bg-ink2 p-6 sm:p-8"
    >
      <p className="eyebrow text-left">Start a project</p>
      <div>
        <label className="mb-1.5 block text-xs text-muted" htmlFor="c-name">الاسم</label>
        <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required className="site-input" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-muted" htmlFor="c-org">الجهة / الشركة</label>
        <input id="c-org" value={org} onChange={(e) => setOrg(e.target.value)} className="site-input" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-muted" htmlFor="c-msg">عن فعاليتك</label>
        <textarea id="c-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required className="site-input" />
      </div>
      <button className="btn-gold w-full justify-center disabled:cursor-not-allowed disabled:opacity-50" disabled={!name || !message}>
        أرسل عبر البريد
      </button>
      <p className="text-center text-xs text-muted">سيفتح تطبيق البريد لديك لإرسال الرسالة إلينا.</p>
    </form>
  );
}

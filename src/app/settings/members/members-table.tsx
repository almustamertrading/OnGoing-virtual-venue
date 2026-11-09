"use client";

import { useState, useTransition } from "react";
import { CAPABILITY_LABEL, GRANTABLE_CAPABILITIES, type GrantableCapability } from "@/lib/permissions";
import type { OrgRole } from "@/lib/types";
import { updateMemberCapabilities, updateMemberRole } from "./actions";

export type MemberEntry = {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  capabilities: string[];
  isSelf: boolean;
};

const ROLE_LABEL: Record<OrgRole, string> = { admin: "مدير المنظمة", manager: "مدير", staff: "موظف" };

export function MembersTable({ organizationId, members }: { organizationId: string; members: MemberEntry[] }) {
  return (
    <div className="mt-5 space-y-3">
      <div className="card p-4 text-xs leading-6 text-slate-400">
        <p className="mb-1 font-semibold text-slate-200">ما الذي تمنحه كل صلاحية؟</p>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {(["organization_admin", ...GRANTABLE_CAPABILITIES, "viewer_access"] as const).map((c) => (
            <li key={c}><span className="text-slate-200">{CAPABILITY_LABEL[c].label}:</span> {CAPABILITY_LABEL[c].hint}</li>
          ))}
        </ul>
        <p className="mt-2 text-amber-300/80">بشكل افتراضي لا يرى أحد التكاليف والهوامش والفواتير إلا مدير المنظمة ومن يُمنح صلاحية «المالية».</p>
      </div>

      <div className="card -mx-1 overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">العضو</th>
              <th className="px-3 py-2 font-medium">الدور</th>
              <th className="px-3 py-2 font-medium">الصلاحيات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {members.map((m) => <MemberRow key={m.userId} organizationId={organizationId} member={m} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberRow({ organizationId, member }: { organizationId: string; member: MemberEntry }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isAdmin = member.role === "admin";

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError((e as Error).message);
      }
    });

  const toggle = (cap: GrantableCapability, on: boolean) => {
    const current = member.capabilities.filter((c): c is GrantableCapability =>
      (GRANTABLE_CAPABILITIES as readonly string[]).includes(c),
    );
    const next = on ? [...new Set([...current, cap])] : current.filter((c) => c !== cap);
    run(() => updateMemberCapabilities(organizationId, member.userId, next));
  };

  return (
    <tr className="align-top text-slate-200" data-testid="member-row">
      <td className="px-3 py-3">
        <p className="font-medium" dir="ltr">{member.email}</p>
        {member.isSelf && <p className="text-xs text-slate-500">أنت</p>}
      </td>
      <td className="px-3 py-3">
        <select
          aria-label={`دور ${member.email}`}
          value={member.role}
          disabled={busy}
          onChange={(e) => run(() => updateMemberRole(organizationId, member.userId, e.target.value as OrgRole))}
          className="field w-36"
        >
          {(Object.keys(ROLE_LABEL) as OrgRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </td>
      <td className="px-3 py-3">
        {isAdmin ? (
          <p className="text-xs text-emerald-300">كل الصلاحيات (مدير المنظمة)</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {GRANTABLE_CAPABILITIES.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-xs" title={CAPABILITY_LABEL[c].hint}>
                <input
                  type="checkbox"
                  checked={member.capabilities.includes(c)}
                  disabled={busy}
                  onChange={(e) => toggle(c, e.target.checked)}
                />
                {CAPABILITY_LABEL[c].label}
              </label>
            ))}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-400" role="alert">{error}</p>}
      </td>
    </tr>
  );
}

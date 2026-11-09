# Credential rotation and session revocation (incident S-02)

**Incident:** the primary admin account's password was used in plain text in development session transcripts.
The transcripts are private to the owner's Claude session; the password was never committed to Git (see
[SECRET_AUDIT_2026-11-09.md](SECRET_AUDIT_2026-11-09.md)). Treat it as compromised anyway.

This checklist contains no credentials. Only the account owner can do steps 1–3.

## Why "change the password" is not enough on Supabase

- A Supabase session is an **access token** (a JWT, 1 hour by default) plus a **refresh token**.
- Signing out revokes refresh tokens immediately.
- An already-issued access token **stays valid until it expires**: Supabase verifies its signature without a database lookup.
- So:
  1. Change the password.
  2. Revoke every session.
  3. Either wait out the access-token lifetime, or rotate the JWT signing key for immediate effect.

## Owner checklist

### 1. Change the password (do it first)
The production app has no "change password" or "reset password" screen yet. A recovery email would sign you in but give you nowhere to set a new password. Use one of these instead:

- **Now, no deployment needed: Supabase SQL Editor.**
  1. Open Supabase → SQL Editor → New query. Type the query yourself (do not paste the new password anywhere else):
     ```sql
     update auth.users
     set encrypted_password = extensions.crypt('<your new password>', extensions.gen_salt('bf')),
         updated_at = now()
     where email = '<admin email>';
     ```
  2. Run it.
  3. Delete the query from the SQL Editor history and snippets, because it contains the password.
  4. Use at least 12 characters, unique, from a password manager.
- **After the next release: the app.** Settings → Account → **Change password**. The page is built in development; it ships with the release that needs your approval.

Never paste the new password into a chat, ticket or document.

### 2. Revoke all existing sessions
Do one of these after the password change:
- **App:** use the Settings → Account → "Sign out of all devices" button when it ships. It calls `supabase.auth.signOut({ scope: 'global' })`.
- **SQL:** ask me to run it, or run it yourself in Supabase → SQL Editor:
  ```sql
  delete from auth.sessions
  where user_id = (select id from auth.users where email = '<admin email>');
  ```
  This revokes every refresh token of that user. You will need to sign in again.

### 3. Make old access tokens unusable
Choose one:
- **Wait.** Old access tokens expire within the configured JWT lifetime (Supabase → Settings → JWT Keys; default 1 hour). Since the admin is the only active account, waiting 1 hour 15 minutes is acceptable.
- **Immediate (strongest).** In Supabase → Settings → JWT Keys:
  1. If you see **Migrate JWT secret**, migrate. This creates a standby asymmetric key.
  2. Click **Rotate keys**.
  3. **Revoke** the previously used key.
  - Supabase's Data API, Storage and Realtime stop trusting old tokens at once.
  - Revoking the legacy secret first requires disabling the legacy `anon`/`service_role` keys (Settings → API Keys). The app uses only the publishable key, but confirm nothing else uses the legacy keys before disabling them.

### 4. Verify old sessions are no longer usable
1. In Supabase → SQL Editor:
   ```sql
   select count(*) as sessions, max(created_at) as newest
   from auth.sessions
   where user_id = (select id from auth.users where email = '<admin email>');
   ```
   Only the session(s) you created after step 2 should remain, so `newest` is after the revocation time.
2. Sign out on any other browser or device you used, then reload it. It must ask for a login. With option 3 "Wait", allow up to 1 hour.
3. Supabase → Logs → Auth: check that no sign-in or token refresh comes from an IP or user agent you don't recognise after the revocation time.

### 5. Harden (recommended)
- **Leaked-password protection** (blocks known-breached passwords) is a Pro-plan feature (finding S-09).
- **Optional session limits** (Pro plan): time-boxed sessions and inactivity timeout.
- **MFA for the admin** needs app support (TOTP enrolment screen). It is planned for Settings & Administration.

## Other credentials checked

| Credential | Exposed? | Action |
|---|---|---|
| Admin account password | Yes, in session transcripts | Steps 1–4 above |
| Three QA account passwords | Yes, in session transcripts | Accounts banned, 0 sessions. Deletion waits for your cleanup approval |
| Supabase service-role / secret key (production) | No: not in Git, not in session logs | None |
| Supabase anon key (legacy, production) | Appears in session logs | Low-privilege by design (RLS applies). Optionally disable legacy keys later (the app uses the publishable key) |
| Supabase publishable key | In `.env.example` and the browser bundle | Public by design; no action |
| Anthropic API key | No: not in Git, not in session logs; lives only in Netlify settings | None |
| GitHub / Netlify tokens | No | None |

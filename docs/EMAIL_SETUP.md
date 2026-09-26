# Calliper email delivery

The app uses Supabase Auth for verification, password recovery, and sign-in codes.
The three HTML templates in `supabase/templates/` now share Calliper styling:
responsive tables, inline styles, a text wordmark that works with images blocked,
clear buttons, fallback links, and one-time code formatting. There are no remote
fonts, tracking pixels, or JavaScript. Expiry copy matches the local 600-second setting.

## 1. Create the sender

1. Create your account at [Resend](https://resend.com/).
2. If you do not own a domain, register one with your chosen registrar first.
   Calliper cannot send as a domain you do not own. This repository does not buy a domain
   or provision a paid service.
3. In Resend → Domains, add a sending subdomain, such as `mail.yourdomain.com`.
4. Add the exact DNS records Resend displays at your domain's DNS provider. Wait for
   Resend to mark the domain **Verified**. Do not replace your existing mailbox MX records.
5. Create a **Sending access** API key restricted to that domain.
6. Choose a From address on the verified domain, for example `hello@mail.yourdomain.com`.
   This is a sender identity; Resend sending does not create a mailbox for incoming replies.
7. Keep click/open tracking disabled for these authentication emails.

Provider references: [verified domains](https://resend.com/docs/dashboard/domains/introduction),
[SMTP settings](https://resend.com/docs/send-with-smtp),
[Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 2. Connect the current local database to real email

The placeholders are already available in `.env.example`. Add these to `.env.local`:

```dotenv
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=your-resend-sending-api-key
SMTP_FROM_EMAIL=hello@mail.yourdomain.com
```

Never paste the real key into chat or commit it. The OpenAI key is unrelated.

```sh
pnpm email:configure smtp
pnpm supabase stop
pnpm db:start
```

The configure command validates the fields, stores only environment references in
`supabase/config.toml`, and sets a 60-second resend interval. `db:start` loads
`.env.local` using Node's env-file support. Restarting keeps the existing database.
Use `pnpm db:start` rather than bare `supabase start` so the SMTP variables are loaded.
If you rotate credentials, stop/start the stack again.

Supabase's hourly email limit also applies: review `auth.rate_limit.email_sent` when
preparing a larger demo and choose a limit appropriate to your provider plan.

### Links must reach the app

The templates use `auth.site_url` in `supabase/config.toml`. With the current value
`http://localhost:3000`, real mail can reach your inbox, but its links work only on the
computer running Calliper. To invite other people, deploy the app and set the app's
HTTPS URL before sending invitations. A sender domain alone does not host the app.
Restart local Supabase after changing this URL.

### Delivery check

Register with your own real email, or request a new verification/recovery email for your
existing account. Check both your inbox and Resend → Emails for delivery status. Follow
the link, then explicitly confirm on the Calliper page. GET/prefetch requests do not use
up the token. If the provider rejects a send, check that the From domain is verified and
the key has permission to send from it. Check spam if Resend reports delivery.

## 3. Hosted Supabase

Local CLI configuration does not configure a hosted project. In your existing hosted
Supabase project's Authentication settings:

- Enable Custom SMTP using the same host, port, username, API key, From address, and
  sender name **Calliper**.
- Set Site URL to your deployed HTTPS Calliper URL.
- Keep email confirmation enabled and OTP expiry at 600 seconds (or update the template copy).
- Paste `confirmation.html` into Confirm signup, `recovery.html` into Reset password,
  and `magic-link.html` into Magic Link. Use the subjects in `supabase/config.toml`.
- Set appropriate resend/hourly limits and test each flow with your own account.

## Return to the local inbox / run tests

```sh
pnpm email:configure local
pnpm supabase stop
pnpm db:start
pnpm test:integration
```

Local mode removes the SMTP override and restores the test resend interval. Your SMTP
credentials stay in the ignored `.env.local` for next time. Tests check the running auth
container's SMTP destination before creating accounts, and refuse to use an external
provider. The local inbox is at http://127.0.0.1:55434.

Changing modes does not change `auth.site_url`; use `http://localhost:3000` for the normal
local workflow. Email templates can be edited directly; restart Supabase to apply edits.

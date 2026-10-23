# Online Exam Paper Maker — Interactive Frontend Prototype

Plain HTML5 + CSS3 + vanilla JavaScript. No framework, no build step, no paid service.

## Run it

**Easiest:** double-click `index.html` (opens in your browser via `file://`).

**Recommended (local server):** from this folder run one of:

```
python3 -m http.server 8000      # then open http://localhost:8000
npx serve .                      # alternative
```

## Demo logins (testing only — NOT real security)

| Role    | Email              | Password   |
|---------|--------------------|------------|
| Teacher | teacher@demo.test  | teacher123 |
| Admin   | admin@demo.test    | admin123   |

Log in with these on the normal login form, or register a new teacher account with "Create Account".
Accounts and papers live in this browser's LocalStorage. Passwords are only lightly obfuscated for the demo.
**The real product must use server-side authentication and authorization** (e.g. WordPress auth, a capability
check on every read/write, teachers restricted to their own papers). Settings → "Reset demo data" restores the sample data.

## Database (accounts and papers online)

On the live site with a database connected, accounts and papers are stored in **Postgres** (Neon, added from Vercel), so a
teacher can log in from any computer or phone and find their papers. Passwords are hashed on the server (scrypt); the app
gets a signed login token (30 days, or this tab only without "Keep me logged in"). Teachers can only read/change their own
papers — the server checks every request. The **first account** created becomes the **admin** (no demo accounts online).
Admins can reset passwords, make another account admin, and remove teachers (their papers are removed too).

- Changes are saved in the background; the builder shows "Saving to cloud…", "Saved to cloud ✓" or a warning, and retries
  automatically when the internet comes back.
- Papers made earlier in the same browser (before the database) are copied to the account once, on first login/sign-up.
- Opening `index.html` from a folder (or a site without a database) uses the old in-browser demo mode instead.

**One-time setup:** Vercel → your project → **Storage** → **Create Database** → **Neon (Postgres)** → Free → **Connect** to
this project (it adds `DATABASE_URL` automatically) → **Redeploy**. Tables are created automatically on first use.
Optional: add `AUTH_SECRET` (any long random text) to sign login tokens.

API: `api/data.js` (POST `{action, …}` with `Authorization: Bearer <token>`), helpers in `api/_db.js` and `api/_auth.js`.

## Forgot password (code by email)

Like other apps: **Forgot your password?** → enter the account email → a **6-digit code** is emailed → enter the code →
set a new password. Codes expire after 15 minutes, 5 wrong tries cancel a code, "Resend code" is available after 60 seconds.
Admins can also set a new password for a teacher in **All Teachers → Reset password**.

The emails are sent by two small Vercel functions (`api/send-reset.js`, `api/verify-reset.js`) through Gmail.
**One-time setup** in Vercel → your project → Settings → Environment Variables (then Redeploy):

| Name | Value |
|------|-------|
| `GMAIL_USER` | the Gmail address that sends the emails |
| `GMAIL_APP_PASSWORD` | a 16-character Google App password (Google Account → Security → 2-Step Verification → App passwords) |
| `RESET_SECRET` | optional — any long random text |
| `MAIL_FROM_NAME` | optional — sender name (default "Exam Paper Maker") |

Reset emails only work on the live (Vercel) site, not when `index.html` is opened from a folder.
To test locally with the functions, run `npx vercel dev`.

## What works

- Login, register, logout, show/hide password, validation messages.
- Dashboard (stats, recently edited / created), My Papers with search, class/subject/language filters, sorting, empty states.
- Paper cards with thumbnail, View, Edit, Download PDF, Print, Duplicate, Delete (with confirmation).
- Templates (blank English, blank Urdu, two sample papers based on your references).
- Paper builder: settings, show/hide optional fields, 12 section types, per-section title/marks/language/start number,
  enable/disable, duplicate, delete, reorder (drag handle **and** ↑/↓ buttons for keyboard use), live preview, autosave.
- English (LTR), Urdu (RTL) and mixed papers (each section can override the paper language).
- Admin role: all teachers, all papers, system settings preview. Teachers only see their own papers.
- Print prints only the paper (A4). Download PDF uses html2pdf.js loaded from a CDN when online; if it cannot load,
  the print dialog opens so you can choose "Save as PDF". Everything else works fully offline.

## Mathematics support

A built-in, offline equation engine (`js/math.js`, no external library) renders maths the same way in the live preview,
thumbnails, print and the PDF download.

- **Mathematics section** (Add section → "Mathematics (equations)"): each question has text, an optional centred equation with a
  live preview, and a configurable number of answer lines.
- **Math tools** panel in the builder: click inside any question field, then click a button to insert at the cursor —
  fractions, square/nth roots, powers, subscripts, brackets, sums, integrals, 28 symbols (× ÷ ± ≠ ≤ ≥ ≈ π θ α β γ Δ ∞ ° ∠ △ ⊥ ∥ ∴ ∵ → ∈ ∪ ∩ ∅ …)
  and common equations (quadratic, quadratic formula, Pythagoras, circle area, slope).
- **Maths works in every text field** (MCQ questions and options, fill-in-the-blanks, true/false, matching, tables, passages,
  section titles, custom text), in English, Urdu and mixed papers. Write inline maths between `$ … $` and a centred line between `$$ … $$`.
  Use `\$` for a literal dollar sign.
- Supported syntax: `\frac{a}{b}`, `\sqrt{x}`, `\sqrt[3]{x}`, `x^{2}`, `x_{1}`, `x_{1}^{2}`, `\overline{AB}`, `\vec{v}`, `\left( … \right)`,
  `\sum_{i=1}^{n}`, `\int_{a}^{b}`, `\sin \theta`, `\text{cm}`, and symbol commands such as `\pi \times \div \pm \leq \geq \neq \approx \infty \angle \triangle \therefore`.
- A "Mathematics sample (Grade 8)" paper is included (Templates, and in the seed data of a fresh browser).

## Auto-translate preview (Urdu ⇄ English)

In the Paper Builder toolbar, tick **Auto-translate preview (اردو ⇄ English)**:

- Write the paper in **Urdu** → the preview shows it in **English** (left-to-right, English labels: Q1, Subject, Total Marks…).
- Write the paper in **English** → the preview shows it in **Urdu** (right-to-left, Urdu labels: سوال، مضمون، نشانات…).
- The language is detected from what you actually type (per section), so it works even if the paper language setting is left on English.
- Maths (`$…$`, `$$…$$`), answer blanks (`___`) and numbers are never translated.
- The setting is saved with the paper. **View, Print and Download PDF use the translated version** while it is on; paper cards show an "auto-translated" tag.
- The status next to the checkbox shows the direction (e.g. `Preview: اردو → English`) or "Translating…".

In the online preview on claude.ai, translation is done by Claude (the first time, the page asks you to allow it) because
the preview cannot reach outside sites. When you open `index.html` on your own computer, the free web services below are used.

How translation works: common exam phrases (section types, subject names) are translated offline by a built-in dictionary.
Everything else uses a free online service (Google Translate web endpoint, falling back to MyMemory) — **an internet connection is needed the first time a sentence is translated**.
Results are cached in the browser, so the same text works offline afterwards. If no service can be reached, the original text stays in the preview and a
"not translated — Retry" message appears. Machine translation is not perfect, so read the paper before printing.
For the production/WordPress version, replace `remote()` in `js/translate.js` with your own server-side translation API (e.g. Google Cloud Translation) — the free endpoints have rate limits.

## Light and dark mode

The sun/moon button (top bar, and top-right on the login page) switches between light and dark mode.
The first visit follows the computer's setting; a click saves the choice in the browser. Only the app UI changes —
the exam paper preview, print and PDF always stay black on white. Colours are CSS variables at the top of `styles.css`
(light) and in the `:root[data-theme="dark"]` block (dark).

## Fonts (temporary)

Change fonts in one place — the CSS variables at the top of `styles.css`:

```css
--font-english: Arial, Helvetica, sans-serif;
--font-urdu: "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Noto Naskh Arabic", serif;
```

`index.html` loads Noto Nastaliq Urdu from Google Fonts when online. For the final fonts, add an `@font-face` rule
(or a `<link>`) and update the two variables. For offline use, place font files in `/assets`.

## Structure

```
index.html            page shell
styles.css            all styles (colour + font variables at top)
app.js                bootstrap, login/register, routing
js/storage.js         accounts + papers: cloud (database API) or local (browser) mode
api/                  Vercel functions: data.js (database API), send-reset.js / verify-reset.js (reset emails)
js/translations.js    English/Urdu labels for paper content
js/theme.js           light / dark mode toggle
js/math.js            equation engine ($…$ -> HTML/CSS)
js/translate.js       Urdu ⇄ English auto-translate (detection, maths protection, cache, online service)
js/paper-builder.js   paper data model, samples, editor UI
js/paper-renderer.js  paper -> printable HTML (preview, thumbnails, print, PDF)
js/dashboard.js       app shell, dashboard, papers list, profile, settings, admin views
js/export.js          print and PDF
```

## Notes for the WordPress phase

The paper object (`settings`, `show`, `sections[]`) is plain JSON and can be stored as post meta / a custom table.
Section types are defined in one place (`newSection` in `paper-builder.js`) so new types can be added easily.

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

The login screen also has "Log in as Teacher / Admin" shortcuts. You can register new teacher accounts too.
Accounts and papers live in this browser's LocalStorage. Passwords are only lightly obfuscated for the demo.
**The real product must use server-side authentication and authorization** (e.g. WordPress auth, a capability
check on every read/write, teachers restricted to their own papers). Settings → "Reset demo data" restores the sample data.

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
js/storage.js         LocalStorage users + papers, ownership checks (demo)
js/translations.js    English/Urdu labels for paper content
js/math.js            equation engine ($…$ -> HTML/CSS)
js/paper-builder.js   paper data model, samples, editor UI
js/paper-renderer.js  paper -> printable HTML (preview, thumbnails, print, PDF)
js/dashboard.js       app shell, dashboard, papers list, profile, settings, admin views
js/export.js          print and PDF
```

## Notes for the WordPress phase

The paper object (`settings`, `show`, `sections[]`) is plain JSON and can be stored as post meta / a custom table.
Section types are defined in one place (`newSection` in `paper-builder.js`) so new types can be added easily.

# Research

- ATS/CV: preferire layout a colonna singola, sezioni con nomi standard, testo reale selezionabile, bullet brevi con impatto e keyword dell'annuncio. Evitare immagini come testo, colonne complesse e tabelle pesanti.
- PDF in Node: la scelta piu solida per fidelity HTML/CSS e `playwright` con `page.pdf()`. Conviene tenere il CV come template HTML/CSS stampabile e generare il PDF solo alla fine.
- LinkedIn: supportare solo import manuale da PDF profilo esportato dall'utente o da export dati scaricato dall'utente. Niente scraping dietro login, cookie, sessioni salvate o browser automation aggressiva.
- Annunci LinkedIn: URL supportato solo se la pagina e pubblicamente leggibile senza bypass; fallback obbligatorio `--file` o `--text`.
- CLI/librerie: `commander` per subcommands/help, `zod` per schemi e validazione, `pdf-parse` per estrazione testo PDF, `undici` per fetch, `cheerio`/`jsdom`/`@mozilla/readability`/`turndown` per estrazione testo pulito da pagine pubbliche.
- Token discipline: salvare profilo/job/intermedi in JSON leggibile, caching per hash input+prompt, retrieval locale prima delle chiamate LLM, e usare LLM solo per normalizzazione difficile, matching e riscrittura finale.

## Fonti

- Harvard Career Services resume guidance: https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/
- Indeed ATS resume keywords guide: https://www.indeed.com/career-advice/resumes-cover-letters/ats-resume-keywords
- Playwright Page API (`page.pdf()`): https://playwright.dev/docs/api/class-page
- LinkedIn Help, download account data: https://www.linkedin.com/help/linkedin/answer/a1339364/downloading-your-account-data
- LinkedIn Help, save a profile as PDF: https://www.linkedin.com/help/linkedin/answer/a541960
- LinkedIn User Agreement: https://www.linkedin.com/legal/user-agreement
- LinkedIn Help, prohibited software/extensions: https://www.linkedin.com/help/linkedin/answer/a1341387
- LinkedIn Crawling Terms: https://www.linkedin.com/legal/crawling-terms
- Commander package/docs: https://www.npmjs.com/package/commander
- Zod docs: https://zod.dev/
- pdf-parse package: https://www.npmjs.com/package/pdf-parse
- undici package: https://www.npmjs.com/package/undici
- Cheerio docs: https://cheerio.js.org/docs/intro/

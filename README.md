# CVgenerator

CLI TypeScript/Node per generare CV PDF personalizzati a partire da un profilo locale e da un annuncio di lavoro.

Stato attuale:
- fondamenta del progetto pronte;
- CLI avviabile;
- `cvgen init` crea le cartelle base;
- parsing, job analysis e rendering finale non sono ancora implementati.

## Quick start

```bash
npm run cvgen -- --help
npm run cvgen -- init
npm test
```

## Vincoli

- Import legittimo solo da file/testi forniti dall'utente.
- Nessuno scraping LinkedIn dietro login, cookie o bypass.
- Ogni contenuto futuro del CV dovra derivare da evidence salvata.

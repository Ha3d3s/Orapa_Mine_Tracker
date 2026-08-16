# Orapa Mine — Carnet de faisceaux

Appli web (React + Vite + Tailwind) pour suivre tes tirs lumineux et tes hypothèses de gemmes au jeu Orapa Mine.

## Option A — Héberger sur GitHub Pages (automatique, recommandé)

1. Crée un nouveau dépôt sur GitHub (public), par exemple `orapa-mine-tracker`.
2. Sur ton ordinateur, dans le dossier de ce projet :
   ```bash
   git init
   git add .
   git commit -m "Première version"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/orapa-mine-tracker.git
   git push -u origin main
   ```
3. Sur GitHub : va dans **Settings → Pages** du dépôt, et dans "Build and deployment" choisis **Source : GitHub Actions**.
4. Le fichier `.github/workflows/deploy.yml` (déjà inclus) va automatiquement construire et publier le site à chaque `git push` sur `main`.
5. Après une minute ou deux, ton appli sera en ligne à :
   `https://TON-PSEUDO.github.io/orapa-mine-tracker/`

Tu peux ensuite l'ajouter à l'écran d'accueil de ton téléphone (Safari/Chrome → "Ajouter à l'écran d'accueil") pour l'ouvrir comme une vraie appli.

## Option B — Encore plus simple : Netlify ou Vercel (glisser-déposer, sans GitHub)

1. En local : `npm install` puis `npm run build` (crée un dossier `dist/`).
2. Va sur [app.netlify.com/drop](https://app.netlify.com/drop) et glisse le dossier `dist/` dedans.
3. Tu obtiens un lien public immédiatement, sans rien configurer.

## Développement local

```bash
npm install
npm run dev
```
Puis ouvre le lien affiché (en général http://localhost:5173).

## Structure

- `src/App.jsx` — le composant principal de l'appli (plateau, pièces, tirs).
- `src/main.jsx` — point d'entrée React.
- `tailwind.config.js` / `postcss.config.js` — configuration du style.
- `.github/workflows/deploy.yml` — publication automatique sur GitHub Pages.

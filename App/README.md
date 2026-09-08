# USS — Application du club

Application mobile (PWA) de l'Union Sportive de Savigny-lès-Beaune.

## Ce que fait l'app

- **Agenda** : séances et matchs par équipe (Seniors A, Seniors B, Vétérans, Jeunes).
- **Convocations** : chaque joueur indique présent / incertain / absent, tout le monde voit qui vient.
- **Entraîneur** : ajoute, modifie, supprime les événements de ses équipes et saisit les scores.
- **Classement** et **statistiques** (buts, passes, minutes, présences aux entraînements).
- **Profil** : nom, poste, numéro, téléphone.

## Structure

```
App/
├── index.html            coquille de l'app
├── manifest.webmanifest  installation sur l'écran d'accueil
├── sw.js                 mode hors-ligne
├── css/theme.css         couleurs, polices : tout le visuel se règle ici
├── css/app.css           mise en page et composants
├── js/config.js          clés Supabase + infos du club
├── js/store.js           couche de données (démo aujourd'hui, Supabase demain)
├── js/demo-data.js       données factices du mode démonstration
└── js/app.js             écrans et navigation
supabase/schema.sql       tables et règles d'accès à exécuter dans Supabase
```

Aucun outil de build : les fichiers se servent tels quels (GitHub Pages ou n'importe quel hébergeur statique).

## Tester en local

```
cd App
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000. En mode démonstration, choisir un profil sur l'écran d'accueil pour entrer comme joueur ou entraîneur.

## Passer en production

1. Créer un projet sur supabase.com et exécuter `supabase/schema.sql` dans l'éditeur SQL.
2. Renseigner `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `js/config.js`.
3. Activer GitHub Pages sur le dépôt (dossier `App/`) : le lien obtenu est celui à partager au club.

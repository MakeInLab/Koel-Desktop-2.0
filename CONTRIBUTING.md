# Contribuer à Koel Desktop

Merci de proposer une issue avant une modification importante.

1. Créer une branche depuis `main`.
2. Utiliser Node.js 24.11+ et lancer `npm install`.
3. Vérifier `npm run typecheck`, `npm test` et `npm run build`.
4. Ouvrir une pull request expliquant les changements et les tests effectués.

Ne partagez pas de jetons Koel, de fichiers de session ou de certificats de signature. Pour les questions de sécurité, lire [SECURITY.md](SECURITY.md).

La version de l'application est définie dans `src/shared/version.ts` : utilisez `npm run version:sync` pour synchroniser `package.json`.

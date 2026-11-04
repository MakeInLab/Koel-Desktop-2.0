# Note - migration du packaging Windows

Dans cette variante de la **v0.7.6**, `electron-builder` est retiré et remplacé par le script Node + compilateur NSIS externe. Les 15 alertes `minimatch` du dernier rapport venaient de la chaîne de packaging `electron-builder` ; **leur disparition n’a pas encore été vérifiée via `npm audit` sur ce nouvel arbre installé**.

Après `npm install`, exécuter `npm audit`, `npm audit --omit=dev` et `npm run audit:check` sur Windows. Les résultats de la revue ci-dessous décrivent l’ancienne chaîne et sont conservés pour historique.

---

> Mise à jour v0.7.5 : audit transitif non exécutable hors ligne, aucune affirmation de correction complète des 15 alertes. Exécuter `npm run security:fix` et `npm run audit:check` sur Windows.

# Audit des dépendances - Koel Desktop 0.7.5

Date de revue : 4 novembre 2026.

## Portée et résultat

- **12 dépendances directes** : 4 de production, 8 de développement, toutes inventoriées dans `package.json`.
- **Dépendances indirectes** : un contrôle exhaustif nécessite `package-lock.json` et l'accès au registre npm. Cette archive ne contient pas de lockfile car il n'a pas été possible de résoudre l'arbre npm dans l'environnement de création (DNS `EAI_AGAIN registry.npmjs.org`).
- **Nombre de vulnérabilités sur la nouvelle installation : inconnu**, ne pas annoncer « 0 vulnérabilité ». Le précédent `npm install` de l'utilisateur pour la v0.7.0 avait signalé **15 vulnérabilités modérées**, mais ce résultat ne suffit pas à conclure pour les dépendances de la v0.7.5.
- **Pas de mise à niveau majeure forcée** : Vue Router 5 et Pinia 4 nécessiteraient des tests d'intégration. Les versions actuelles de Vite et de Vue ne présentent pas de vulnérabilité directe déclarée dans les sources consultées ; cela ne garantit rien pour leurs dépendances transitives.

## Inventaire des packages directs

| Package | Version | Contexte | Conclusion |
| --- | --- | --- | --- |
| Vue | 3.5.44 | Production | Pas de faille directe signalée sur cette version dans Snyk ; conserver |
| Pinia | 3.0.4 | Production | Pas de faille directe signalée ; migration vers la v4 à tester séparément |
| Vue Router | 4.5.1 | Production | Branche plus ancienne que v5 ; migration majeure différée |
| discord-rpc | 4.0.1 | Production | Maintien pour compatibilité Discord « Écoute » ; dépend de `node-fetch` et `ws`, à surveiller dans l'audit transitive |
| Electron | 45.2.1 | Build / runtime Electron | Aucun problème direct déclaré pour cette version dans Snyk ; suivre les patchs Chromium/Electron |
| electron-vite | 6.0.0 | Développement | Pas de faille directe signalée sur cette version dans Snyk |
| Vite | 8.3.5 | Développement | Version stable sans faille directe signalée dans Snyk ; plusieurs anciennes versions étaient vulnérables |
| @vitejs/plugin-vue | 6.0.10 | Développement | Pas de faille directe signalée dans Snyk |
| electron-builder | 26.18.1 | Distribution Windows | Pas de faille directe signalée ; ses dépendances indirectes nécessitent une vérification |
| TypeScript | 5.9.3 | Développement | Audit transitif par npm nécessaire |
| vue-tsc | 3.3.13 | Développement | Pas de faille directe signalée ; patch 3.3.14 existe, à évaluer sur Windows |
| @types/node | 22.20.5 | Développement | Fichiers de types, audit transitif par npm nécessaire |

## Principaux risques à analyser

1. **Chaîne de création d'installateurs** : les avertissements `inflight`, `rimraf@2`, `glob@7`, `boolean@3` et `electron-winstaller` ont été observés sur l'installation Windows de v0.7.0. Ils doivent être attribués à leurs dépendants via `npm explain <nom>` avant correction. « Déprécié » ne signifie pas nécessairement vulnérable, et inversement.
2. **Discord RPC** : `discord-rpc` date de plusieurs années et dépend de `node-fetch` et `ws`. Vérifier les versions réellement résolues (y compris les correctifs transitifs) et les chemins d'utilisation, sans remplacer la bibliothèque à l'aveugle.
3. **Application de production** : distinguer `npm audit --omit=dev` de l'audit complet. Electron est placé dans `devDependencies` car il sert de moteur/build, mais son Chromium est **inclus dans le logiciel livré** : `npm audit --omit=dev` ne suffit pas à évaluer la sécurité de l'exécutable Windows.
4. **Arbre reproductible** : conserver `package-lock.json` après une installation validée sur Windows, puis préférer `npm ci` et vérifier les hashes/signatures des artefacts.

## Générer le véritable audit complet sur Windows

```powershell
npm install
npm run audit:check
```

Le script produit les fichiers `audit-reports/dependances-audit.json` et `.md`, avec :
- l'inventaire complet obtenu par `npm ls --all --json` ;
- l'audit complet npm, correctifs proposés et liens vers les avis ;
- l'audit `--omit=dev` pour les seules dépendances de production ;
- une erreur explicite si les audits sont incomplets ou si une vulnérabilité est détectée.

Pour analyser les chemins des packages hérités :

```powershell
npm explain inflight
npm explain rimraf
npm explain glob
npm explain boolean
npm explain discord-rpc
npm explain ws
npm explain node-fetch
```

Ne pas utiliser `npm audit fix --force` sans tests de non-régression.

## Sources consultées

- npm audit : https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/
- Vue : https://security.snyk.io/package/npm/vue/3.5.44
- Vite : https://security.snyk.io/package/npm/vite
- Electron : https://security.snyk.io/package/npm/electron
- electron-vite : https://security.snyk.io/package/npm/electron-vite
- electron-builder : https://security.snyk.io/package/npm/electron-builder/26.18.1
- discord-rpc : https://security.snyk.io/package/npm/discord-rpc/4.0.1
- Pinia : https://security.snyk.io/package/npm/pinia/3.0.4
- Vue Router : https://security.snyk.io/package/npm/vue-router
- @vitejs/plugin-vue : https://security.snyk.io/package/npm/%40vitejs%2Fplugin-vue/6.0.10
- vue-tsc : https://security.snyk.io/package/npm/vue-tsc/3.3.13

## Constat Windows du 4 novembre 2026 (v0.7.5)

L'utilisateur a exécuté `npm audit fix` sur Windows. L'audit a recensé **15 vulnérabilités modérées** regroupées sous l'avis **GHSA-g3hv-75wg-m249** : `minimatch < 11.0.1`, lié à la chaîne d'outils de packaging (notamment `electron-builder`, `app-builder-lib`, `@electron/asar`, `glob` et `dir-compare`). `npm audit fix` ne peut pas corriger ce graphe dans les contraintes actuelles. `npm audit fix --force` propose `electron-builder@20.23.1` : **ne pas accepter cette rétrogradation majeure**. Un override global `minimatch@11` est également à éviter avant tests de compatibilité des anciennes dépendances qui appellent l'ancienne API.

**Statut** : vulnérabilités NON RÉSOLUES dans la chaîne de développement / packaging. Risque d'exploitation via les glob patterns malveillants, selon les conditions de l'avis. Le résultat de `npm audit --omit=dev` doit être vérifié séparément pour évaluer les dépendances réellement livrées avec le client. Ce rapport ne prétend pas que l'application est exempte de vulnérabilités.

La v0.7.6 corrige uniquement le warning Node `DEP0190` dans nos scripts d'audit (exécution npm sans `shell:true`).

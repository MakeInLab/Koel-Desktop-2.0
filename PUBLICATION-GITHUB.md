# Publier Koel Desktop sur GitHub

Ce dossier est prêt à être publié dans un dépôt **public** nommé `koel-desktop`.

## 1. Vérifier le contenu

Avant le premier envoi :

```bash
npm run typecheck
npm test
```

Contrôler les fichiers suivis avec `git status` et `git ls-files`. Aucune clé privée, aucun mot de passe, aucun jeton, aucune URL d'authentification ni fichier `koel-session.enc` ne doit figurer dans les fichiers publiés. Les fichiers `node_modules/`, `out/` et `release/` sont exclus par `.gitignore`.

## 2. Créer un dépôt vide sur GitHub

1. Se connecter à [github.com/new](https://github.com/new).
2. Nom : **koel-desktop**.
3. Visibilité : **Public**.
4. Ne pas initialiser le dépôt avec README, `.gitignore` ou licence (ils sont déjà présents).
5. Cliquer sur **Create repository**.

## 3. Envoyer le projet

Depuis le dossier `koel-desktop` dans PowerShell, Git Bash ou Linux :

```bash
git init -b main
git add .
git status
git commit -m "Initial release: Koel Desktop 2.0 v0.7.6"
git remote add origin https://github.com/VOTRE_PSEUDO/koel-desktop.git
git push -u origin main
```

Remplacer `VOTRE_PSEUDO` par votre nom d'utilisateur ou organisation GitHub. GitHub demandera une authentification ; utiliser Git Credential Manager, `gh auth login`, ou une clé SSH. Ne jamais coller de jeton GitHub dans les fichiers du projet.

Si le dépôt existe déjà, ne pas réinitialiser aveuglément l'historique : utiliser plutôt son clone ou créer une branche.

## 4. Vérifier les workflows

Dans **Actions**, vérifier que les workflows Windows, Debian et sécurité se déclenchent. Ils génèrent des artefacts de test **non signés**.

Avant de distribuer publiquement un installeur Windows, tester le Setup et le Portable sur Windows et vérifier l'icône ainsi que la désinstallation. Avant de distribuer le `.deb`, installer et tester le paquet sur un vrai bureau Debian.

## 5. Publier une Release (facultatif)

Une fois les exécutables vérifiés :

```bash
git tag v0.7.6
git push origin v0.7.6
```

Puis GitHub > **Releases** > **Draft a new release**, choisir `v0.7.6` et joindre manuellement les exécutables testés. Signaler clairement si les binaires ne sont pas signés. Ne jamais joindre les dossiers contenant des fichiers de session ou des clés.

## 6. Après publication

Activer **Dependabot alerts**, **Secret scanning** (si disponible) et **Private vulnerability reporting** dans les paramètres de sécurité du dépôt. Pour des rapports npm entièrement reproductibles, générer puis committer un `package-lock.json` vérifié dans un environnement de confiance, et remplacer le repli `npm install` de la CI par `npm ci`.

# Packaging Windows - Koel Desktop 0.7.6

## Objectif et périmètre

Seule la chaîne de packaging est remplacée. Le code de l'application, les API Koel, Discord, les playlists, les thèmes et la version affichée ne changent pas.

`electron-builder` 26 a été supprimé des dépendances npm. Le projet utilise désormais :

1. `electron-vite` (déjà présent) pour compiler `out/`.
2. La copie Windows x64 d'Electron 45.2.1 fournie par le paquet `electron`.
3. Un script Node standard (`scripts/package-windows.mjs`) qui intègre `out/` et les dépendances de production au runtime Windows.
4. **NSIS**, installé comme outil Windows externe à npm, pour créer un installateur `.exe` et un `.exe` portable auto-extractible.

Cela élimine du manifeste npm la chaîne `electron-builder -> app-builder-lib -> minimatch` observée dans l'audit utilisateur. Cela **ne constitue pas une preuve** de zéro vulnérabilité dans le nouvel arbre de dépendances : valider le nouvel audit après installation.

## Prérequis

- Windows 10/11 x64, Node.js compatible (Node 24.11+ conseillé).
- NSIS installé depuis https://nsis.sourceforge.io (compilateur `makensis.exe`).
- NSIS peut aussi être installé avec Chocolatey, depuis PowerShell administrateur :

```powershell
choco install nsis -y
```

Si NSIS est installé mais non trouvé, renseigner son chemin :

```powershell
$env:NSIS_PATH = 'C:\Program Files (x86)\NSIS\makensis.exe'
```

## Mise en place

Dans un nouveau dossier extrait du ZIP, depuis PowerShell :

```powershell
npm install
npx electron --version
npm run typecheck
npm test
npm audit
npm audit --omit=dev
npm run dist:win
```

Pour réutiliser un dossier existant, supprimer l'ancien `package-lock.json` et `node_modules` avant `npm install`, afin de reconstituer réellement l'arbre après suppression d'electron-builder. Ne pas lancer `npm audit fix --force`.

## Résultats attendus

- `release/Koel-Desktop-0.7.6-Setup-x64.exe` : installateur NSIS par utilisateur, avec raccourcis, désinstallation et entrée Windows Applications installées.
- `release/Koel-Desktop-0.7.6-Portable-x64.exe` : exécutable auto-extractible qui démarre depuis un dossier temporaire et nettoie les fichiers extraits après la fermeture.
- `release/Koel-Desktop-win32-x64/` : dossier d'application non installé, utilisable comme diagnostic.

Les exécutables **ne sont pas signés** sans certificat de signature de code. Ne jamais ajouter un PFX ou un mot de passe au code source. Avec un certificat approprié, signer les deux EXE produits à l'aide de SignTool, puis vérifier `Get-AuthenticodeSignature`.

Pour ne créer que le Setup : `npm run dist:setup`. Pour ne créer que le Portable : `npm run dist:portable`. Pour ne créer que le dossier non installé : `npm run dist:dir`.

## À savoir

- La version Portable **n'écrit pas son installation** sur le disque, mais les paramètres de connexion de Koel restent normalement dans `%APPDATA%` (comme avec la version installée). Ce n'est pas un mode « données nomades » sur clé USB.
- Le Portable démarre après une extraction temporaire : le premier lancement peut prendre plus de temps.
- Le script télécharge les dépendances **de production** dans la copie de l'application lors du packaging ; une connexion au registre npm est nécessaire la première fois.
- La désinstallation supprime uniquement les fichiers embarqués et les raccourcis connus ; les données personnelles du profil Windows sont préservées.
- Le projet utilise le runtime Electron décompressé dans `resources/app`, et non ASAR. Le code source compilé n'est pas chiffré : ASAR n'est pas une frontière de sécurité.
- Le produit n'a pas été compilé ou exécuté sur Windows dans cet environnement de préparation. Valider les deux formats sur ton PC, puis faire une inspection de la signature et de l'antivirus avant diffusion publique.

## Correctif NSIS (v0.7.6, packaging révisé)

Le script `scripts/package-windows.mjs` écrit désormais `UninstallString` avec des guillemets Windows valides et ajoute les clés de version `FileVersion` et `LegalCopyright` au Setup et au Portable. Il crée également un `.npmignore` explicite dans l'application temporaire pour éviter l'avertissement `gitignore-fallback`. Le code applicatif et le numéro `0.7.6` restent inchangés.

## Correctif Portable (NSIS 6000 / 6001)

Le script `scripts/package-windows.mjs` utilise une chaîne NSIS correcte pour lancer
`Koel Desktop.exe` depuis `$PLUGINSDIR`, avec des guillemets autour du chemin
contenant des espaces. L'inclusion `MUI2.nsh` est désormais réservée au Setup :
le script Portable n'utilise pas les composants graphiques de l'installeur.

Relancer `npm run dist:win` pour régénérer les deux exécutables. L'avertissement
`npm warn gitignore-fallback` ne provient pas de NSIS et n'indique pas une erreur
de compilation. Pour confirmer le succès, vérifier la ligne `Packaging terminé`
et la présence des deux exécutables dans `release`.


### Logo Windows (correctif v0.7.6)

Le script injecte maintenant `resources/icon.ico` dans la ressource PE du fichier
`release/Koel-Desktop-win32-x64/Koel Desktop.exe` avec `resedit`. Les deux
exécutables NSIS embarquent cette version avec logo (y compris les raccourcis).
Les métadonnées de version sont également renseignées.

Après `npm install`, relancer `npm run dist:win`. Si l'Explorateur Windows
affiche encore une ancienne icône, supprimer les anciens raccourcis ou actualiser
le cache d'icônes Windows. **Signer seulement après** la modification des ressources.

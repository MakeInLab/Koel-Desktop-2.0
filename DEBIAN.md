# Koel Desktop 0.7.6 - Debian Linux x64

Le client reste en **version 0.7.6**. Le code applicatif, Koel, Discord et les playlists sont inchangés. Le packaging Windows (Setup + Portable) est conservé.

## Créer les fichiers Linux

Effectuer la compilation **sur Debian/Ubuntu x64** : le binaire Electron Linux doit être téléchargé sur Linux. Les commandes Windows NSIS ne sont pas utilisées.

Prérequis : Node.js 24.11+, npm, `dpkg-deb`, `tar`, accès au registre npm, et bibliothèques graphiques système compatibles Electron. Par exemple :

```bash
sudo apt update
sudo apt install -y dpkg-dev tar libnss3 libnspr4 libgtk-3-0 libgbm1 libasound2 libxss1 libatk-bridge2.0-0
npm install
npx electron --version
npm run typecheck
npm test
npm run dist:linux
```

Sur Debian 13, certains noms de bibliothèques peuvent finir par `t64` et la commande `apt install` ci-dessus peut nécessiter une adaptation. `dpkg -i`/`apt install` résoudront les dépendances du paquet si elles sont disponibles.

Produits attendus :

- `release/Koel-Desktop-0.7.6-linux-amd64.deb` : paquet pour le bureau Debian, avec entrée dans le menu d'applications, icône Koel 256x256 et commande `koel-desktop`.
- `release/Koel-Desktop-0.7.6-linux-x64-portable.tar.gz` : dossier portable contenant Electron et un lanceur.

Pour construire un seul format : `npm run dist:deb` ou `npm run dist:linux-portable`.

## Installer et utiliser le .deb

```bash
sudo apt install ./release/Koel-Desktop-0.7.6-linux-amd64.deb
koel-desktop
```

L'icône apparaît sous **Koel Desktop** dans le menu des applications. Pour désinstaller :

```bash
sudo apt remove koel-desktop
```

Les données utilisateur sous `~/.config/` ne sont pas effacées automatiquement à la désinstallation.

## Version portable Linux

```bash
mkdir -p ~/Applications
 tar -xzf release/Koel-Desktop-0.7.6-linux-x64-portable.tar.gz -C ~/Applications
~/Applications/koel-desktop/start-koel-desktop.sh
```

**Limitation de sécurité** : contrairement au .deb, l'archive portable n'installe pas de `chrome-sandbox` appartenant à root. Sur une distribution Linux autorisant le sandbox Chromium via espaces de noms utilisateur, elle peut fonctionner normalement ; sur d'autres systèmes, Electron peut refuser de démarrer. Ne pas contourner ce blocage avec `--no-sandbox`. **Le .deb est le format recommandé**.

## Vérifications et limites

- L'application nécessite une session graphique (X11 ou Wayland avec prise en charge Electron), les bibliothèques Electron et un serveur Koel accessible via HTTPS.
- Discord Rich Presence nécessite le client Discord local ou un environnement Discord compatible ; ses disponibilités peuvent varier selon la distribution.
- L'icône Debian provient de `resources/icon.png` ; l'icône Windows intégrée au `.exe` provient toujours de `resources/icon.ico`.
- Les paquets sont **non signés** ; le code est fourni pour une compilation locale. Les clés de signature de dépôts APT sont un mécanisme distinct de la signature Authenticode Windows.
- Les scripts et tests statiques peuvent être vérifiés ici, mais un vrai build Electron Linux et le démarrage sous Debian doivent être validés sur un PC Debian.

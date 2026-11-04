# Sécurité

## Signaler une vulnérabilité

Ne publiez **pas** de preuve de concept ou d'identifiants dans une issue publique.

Utilisez la fonction **Private vulnerability reporting** de GitHub, si elle est activée dans les paramètres du dépôt :
**Security > Advisories > Report a vulnerability**.

Si cette fonction n'est pas activée, contactez le mainteneur via un canal privé avant de divulguer des détails sensibles. Aucun contact privé n'est encore configuré dans ce dépôt : le responsable doit en prévoir un avant une diffusion large.

## Secrets et confidentialité

- Ne jamais committer `koel-session.enc`, un mot de passe Koel, une URL de streaming portant un jeton, des clés privées, `.env` ou un certificat `.pfx`.
- Conserver les fichiers de signature hors du dépôt ; utiliser les secrets GitHub Actions si une signature automatisée est configurée ultérieurement.
- Le jeton de lecture Koel 9.15 peut apparaître dans une URL : éviter de copier des journaux ou captures contenant cette URL.
- Les binaires produits par les workflows sont **non signés** par défaut.

## Vérifications conseillées

```bash
npm audit
npm audit --omit=dev
npm run typecheck
npm test
```

Un audit npm positif ne garantit pas une sécurité absolue. Vérifiez les changements de dépendances et la provenance des releases avant distribution.

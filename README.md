# RPG Maker Live Editor v1.1.0

Addon non officiel pour RPG Maker MV et MZ. Overlay HTML déclenché par F6, pour modifier l'état de la partie en mémoire.

## Installation sur un jeu compilé

1. Faites une copie complète du jeu.
2. Placez `RPGLiveEditor.js` dans `js/plugins/` (ou `www/js/plugins/` si le jeu utilise un dossier `www`).
3. Ajoutez une entrée dans le tableau `$plugins` de `js/plugins.js` en conservant les autres entrées :
   ```js
   {
     "name": "RPGLiveEditor",
     "status": true,
     "description": "Live editor",
     "parameters": {}
   }
   ```
4. Vérifiez la syntaxe du tableau et les virgules entre les entrées.
5. Lancez une partie et pressez F6.

## Nouveautés v1.1

- Paramètres effectifs éditables, en plus des bonus `_paramPlus`.
- Modification de l'équipement porté par emplacement via `changeEquip`.
- Apprentissage / oubli des compétences.
- Ajout / retrait des états.
- Snapshot étendu : or, inventaire, niveau/EXP, HP/MP/TP, bonus de paramètres, compétences, états, tours d'états et équipements.
- Comparaison snapshot / état courant.
- Onglet de gestion des personnages, argent, inventaire, équipements, compétences/états et snapshot.
- Rafraîchissement de plusieurs fenêtres standard connues.
- Isolation clavier, souris, pointeur, tactile et molette au sein de l'overlay.
- Avertissement console si des plugins activés semblent intercepter les entrées.

## Limites

- Le snapshot est uniquement en mémoire et ne survit pas à la fermeture du jeu.
- Les variables, interrupteurs, quêtes, monnaies personnalisées, paramètres ajoutés par plugins, compétences/états personnalisés et données arbitraires de plugins tiers ne sont pas inclus.
- L'édition d'un paramètre effectif utilise `addParam` pour compenser la valeur courante ; des caps, traits, états ou plugins tiers peuvent empêcher d'obtenir exactement la cible demandée.
- Les équipements respectent `changeEquip` et les restrictions `canEquip` du jeu. Les objets non possédés ne sont pas ajoutés automatiquement aux options.
- Les états et compétences sont manipulés via les API standard de l'acteur.
- Les fenêtres ajoutées par des plugins tiers ne sont pas toutes détectables/rafraîchissables automatiquement.
- Ne contourne pas le chiffrement, les protections ou les contrôles d'intégrité.
- Tester sur une copie de travail. L'utilisation doit respecter les droits et conditions applicables au jeu.

## Paramètres

| Paramètre | Défaut | Description |
|---|---:|---|
| ToggleKey | F6 | Raccourci overlay |
| IncludeEquipped | false | Option transmise à gainItem |
| MaxGold | 99 999 999 | Limite de l'or |
| MaxItemCount | 999 | Limite de quantité |
| MaxLevel | 99 | Limite de niveau |
| MaxParameter | 999 999 | Limite des paramètres effectifs |

## API développeur

```js
RPGLiveEditor.open();
RPGLiveEditor.close();
RPGLiveEditor.refresh();
RPGLiveEditor.captureSnapshot();
RPGLiveEditor.restoreSnapshot();
RPGLiveEditor.getSnapshotDiff();
RPGLiveEditor.getEngine();
```

## Structure

```text
rpgm-live-editor-v1.1.0/
├── js/plugins/RPGLiveEditor.js
├── docs/TESTS.md
└── README.md
```

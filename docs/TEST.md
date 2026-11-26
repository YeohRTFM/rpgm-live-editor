# Plan de test RPG Maker Live Editor v1.1.0

Tester sur une copie de jeu, séparément sur MV et MZ.

1. Démarrer une partie et ouvrir/fermer l'overlay avec F6.
2. Cliquer sur tous les onglets, Rafraîchir et Fermer : aucun clic ne doit déclencher une action du jeu.
3. Personnages : modifier niveau, HP, MP, TP, paramètre effectif et bonus interne.
4. Vérifier les bornes HP <= MHP, MP <= MMP, TP entre 0 et 100, niveau >= 1.
5. Argent : définir un total cible et vérifier la valeur en jeu.
6. Inventaire : filtrer par nom/ID et modifier quantité d'un objet, arme et armure.
7. Équipements : changer un emplacement, retirer un équipement, vérifier les échanges d'inventaire.
8. Compétences : apprendre puis oublier une compétence.
9. États : ajouter puis retirer un état.
10. Snapshot : capturer, modifier plusieurs catégories, consulter les différences.
11. Restaurer : vérifier or, inventaire, niveau/EXP, HP/MP/TP, bonus, équipements, compétences et états.
12. Tester Échap dans un champ de saisie et hors champ.
13. Tester en combat et pendant un événement sur copie de travail.
14. Consulter la console pour les avertissements de conflits et erreurs.

À noter : la restauration d'équipements dépend des règles de changeEquip et des plugins tiers. Vérifier l'inventaire après restauration.

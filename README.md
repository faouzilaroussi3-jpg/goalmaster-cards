# GoalMaster Cards

Création d’un jeu de cartes de football – Goalmaster
Je souhaite créer un site web interactif de collection de cartes de football appelé goalmaster .

Le concept est de permettre aux joueurs de collectionner des cartes de footballeurs, d’ouvrir des boosters, de découvrir des cartes extrêmement rares et de compléter leur collection.

Je veux un site moderne, immersif, avec une identité visuelle inspirée des jeux de cartes à collectionner et de FIFA Ultimate Team. Le site doit être entièrement fonctionnel, pas seulement une maquette.

1. DESIGN ET IDENTITÉ VISUELLE

* Interface moderne et sportive.
* Thème sombre avec des touches dorées et lumineuses.
* Design premium, fluide et agréable.
* Cartes avec des effets visuels selon leur rareté.
* Animations lors de l’ouverture des packs.
* Site adapté aux ordinateurs et aux téléphones.

2. PAGE D’ACCUEIL

Afficher :

* Logo FOOTMASTER.
* Nombre de pièces disponibles.
* Nombre de packs disponibles.
* Bouton « Ouvrir mes packs ».
* Dernières cartes obtenues.
* Classement des meilleurs collectionneurs.
* Événements et packs spéciaux.

3. SYSTÈME DE RARETÉS

Il existe 7 niveaux de rareté :

1. Commune.
2. Peu commune.
3. Rare.
4. Super Rare (SR).
5. Légendaire.
6. Secrète Légendaire.
7. Secrète Ultime (SU).

Les cartes légendaires peuvent avoir des versions ALT.

Les cartes secrètes légendaires peuvent avoir des versions Shiny.

La Secrète Ultime est une carte mystérieuse qui ne doit pas être dévoilée dans le catalogue avant qu’un joueur l’obtienne dans un pack.

4. SYSTÈME DE PACKS

Créer deux types de boosters.

Pack classique

Contient 5 cartes classiques et une sixième carte bonus.

Taux de drop pour chacune des 5 cartes classiques :

* Commune : 50 %.
* Peu commune : 25 %.
* Rare : 15 %.
* Super Rare : 7 %.
* Légendaire : 2 %.
* Secrète Légendaire : 0,8 %.
* Secrète Ultime : 0,2 %.

Sixième carte bonus

Elle dispose de son propre système de tirage indépendant :

* Carte normale : 80 %.
* ALT : 15 %.
* Shiny : 4 %.
* Secrète Ultime : 1 %.

La carte bonus doit avoir une animation spéciale pour créer du suspense.

Pack Premium

Ce pack commence à la rareté Super Rare.

Taux de drop pour chacune des 5 cartes classiques :

* Super Rare : 65 %.
* Légendaire : 25 %.
* Secrète Légendaire : 8 %.
* Secrète Ultime : 2 %.

La sixième carte bonus dispose également de son propre tirage spécial.

5. RECHARGE DES PACKS

Pour le pack classique :

* 1 pack toutes les 10 minutes.
* Maximum 10 packs stockés.
* 6 cartes par pack.

La recharge doit continuer même lorsque le joueur est déconnecté.

Pour le pack Premium, prévoir un système de recharge et de récompenses distinct, configurable ultérieurement.

6. OUVERTURE DES PACKS

Créer une véritable animation d’ouverture :

1. Le joueur clique sur son pack.
2. Le booster apparaît au centre de l’écran.
3. Le booster s’ouvre avec une animation.
4. Les cinq cartes classiques sont révélées progressivement.
5. La sixième carte bonus est révélée en dernier avec une animation spéciale.
6. Les cartes obtenues sont automatiquement ajoutées à la collection.

Les animations doivent être de plus en plus impressionnantes selon la rareté obtenue.

Une Secrète Ultime doit avoir une animation exceptionnelle.

7. COLLECTION PERSONNELLE

Créer une page « Ma collection » permettant de :

* Voir toutes les cartes obtenues.
* Trier par rareté.
* Filtrer par joueur, club, pays et version.
* Consulter le nombre de cartes possédées.
* Voir les cartes manquantes.
* Afficher les statistiques de collection.

Chaque carte doit comporter :

* Une illustration du joueur.
* Son nom.
* Son club.
* Sa nationalité.
* Son poste.
* Sa note générale.
* Sa rareté.
* Sa version éventuelle (ALT ou Shiny).

8. COMPTES JOUEURS

Créer un système d’inscription et de connexion.

Chaque joueur doit avoir :

* Son profil.
* Sa collection personnelle.
* Ses pièces.
* Son historique d’ouverture.
* Son niveau.
* Ses statistiques.

9. CLASSEMENT

Créer un classement général selon :

* Le nombre de cartes obtenues.
* Le nombre de cartes légendaires.
* Le nombre de Shiny.
* Le nombre de Secrètes Ultimes.

10. BASE DE DONNÉES ET SÉCURITÉ

Utiliser Supabase pour gérer :

* Les comptes.
* Les collections.
* Les cartes.
* Les stocks de packs.
* Les pièces.
* Les historiques d’ouverture.

Les probabilités doivent être calculées côté serveur et non modifiables par les joueurs.

Empêcher les duplications frauduleuses et les ouvertures multiples non autorisées.

Prévoir une interface administrateur permettant d’ajouter des cartes, modifier les taux de drop, gérer les packs et créer des événements.

11. IMPORTANT

Je veux que tu construises le site progressivement avec une architecture propre.

Ne crée pas uniquement des boutons décoratifs : chaque fonctionnalité doit réellement fonctionner.

Commence par construire l’interface complète, le système de comptes, la base de données et le système d’ouverture des packs.
Toutes les fonctionnalités doivent être évolutives afin de pouvoir ajouter de nouveaux joueurs, clubs, cartes, raretés et événements par la suite.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c7a0109a-373c-48a6-99e9-65577e3e2eec).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

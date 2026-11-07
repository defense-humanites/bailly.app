<p align="center">
  <br><br><img width="192" height="192" src="apps/web/app/assets/icons/bailly.svg" alt="Logo de l'application Bailly">
</p>

<p align="center">
  <strong>Uɴᴇ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ ᴡᴇʙ ᴘᴏᴜʀ ʀᴇɴᴅʀᴇ ᴀᴄᴄᴇssɪʙʟᴇ ᴀ̀ ᴛᴏᴜs<br>
  ʟᴇ ᴅɪᴄᴛɪᴏɴɴᴀɪʀᴇ ɢʀᴇᴄ-ꜰʀᴀɴᴄ̧ᴀɪs ᴅᴇ ʀᴇ́ꜰᴇ́ʀᴇɴᴄᴇ ᴅ'Aɴᴀᴛᴏʟᴇ Bᴀɪʟʟʏ.</strong><br><br>
</p>

## Organisation du dépôt

Ce dépôt réunit les deux applications qui, combinées, animent [bailly.app](https://bailly.app) :

- `apps/web` : le client (Nuxt), qui sert `bailly.app` ;
- `apps/api` : l'API (Hono), qui sert `api.bailly.app`, cf. [son README](apps/api/README.md) ;
- `packages/api-types` : le contrat de l'API (types des requêtes et des réponses,
  constantes communes), partagé par les deux applications, cf. [son
  README](packages/api-types/README.md).

## Mise en route

Prérequis : Node.js 24 (`.node-version`) et [pnpm](https://pnpm.io), dont la
version est fixée par `packageManager` (`package.json`).

```sh
pnpm install            # les dépendances des deux applications
pnpm dev                # l'API (port 3000) et le client (port 4321), ensemble
pnpm dev:web            # le client seul, avec l'API de production
pnpm dev:api            # l'API seule (Node.js)
pnpm lint
pnpm typecheck
```

`pnpm dev` demande la base du dictionnaire, qui n'est pas distribuée (placer
`apps/api/database/bailly-revN.db`, cf. [le README de l'API](apps/api/README.md)), et
les données de Morpheus (`pnpm --filter bailly-api run morpheus:data`, une fois) ;
sans la base, `pnpm dev:web` fait tourner le client avec l'API de production. Les
réglages ont des valeurs par défaut : aucun fichier `.env` n'est nécessaire, il ne
sert qu'à s'en écarter (`apps/web/.env.example`, `apps/api/.env.example`).

Les commandes de chaque application se lancent depuis son dossier (`pnpm test`
dans `apps/web`), ou depuis la racine avec `--filter` (`pnpm --filter bailly-api
test`). Les versions partagées (TypeScript, Vitest, Wrangler…) sont fixées dans
le catalogue de `pnpm-workspace.yaml`.

## Licence

### Données

Cette application utilise les données du
[Bailly 2020 Hugo Chávez](http://gerardgreco.free.fr/spip.php?article24) (Gérard
Gréco, André Charbonnet, Mark De Wilde, Bernard Maréchal _et al._), distribuées
sous licence _Creative Commons Attribution - Pas d'Utilisation Commerciale - Pas
de Modification_ (CC&nbsp;BY-NC-ND&nbsp;4.0).

### Fontes grecques

Cette application utilise les fontes de lecture « Bailly Book » (par défaut),
sous-ensemble renommé de
[Gentium](https://software.sil.org/gentium/) (SIL Global),
[GFS Artemisia](https://www.greekfontsociety-gfs.gr/typefaces/20th_21st_century),
[GFS Bodoni](https://www.greekfontsociety-gfs.gr/typefaces/19th_century),
[GFS Didot](https://www.greekfontsociety-gfs.gr/typefaces/19th_century) et
[GFS Neohellenic](https://www.greekfontsociety-gfs.gr/typefaces/20th_21st_century)
(Greek Font Society), et la fonte d'interface [Inter](https://rsms.me/inter/)
(Rasmus Andersson), distribuées sous licence _SIL Open Font License 1.1_, ainsi
que la fonte
[IFAOGrec](https://www.ifao.egnet.net/publications/outils/polices/#grec)
(Jean-Luc Fournet, Ralph Hancock & Adam Bülow-Jacobsen), qui est libre de tous
droits, pour rendre les caractères les plus spécifiques. 

Gentium et
Inter sont servies en sous-ensembles (`apps/web/scripts/subset-fonts.sh`) ; « Gentium »
étant un nom réservé de sa licence, le sous-ensemble de Gentium porte
le nom « Bailly Book ».

Les fichiers des fontes, accompagnés de leurs licences, se trouvent dans
`apps/web/app/assets/fonts/`.

### Analyse morphologique

Cette application tire parti de
[libmorpheus](https://github.com/defense-humanites/libmorpheus) (Antoine
Boquet), une bibliothèque logicielle qui modernise et étend les capacités de
l'analyseur morphologique [Morpheus](https://github.com/perseids-tools/morpheus),
initialement développé dans le cadre de la Perseus Digital Library (Gregory
Crane _et al._ pour le compte de l'université Tufts) et distribué sous licence
_Mozilla Public License 2.0_ (MPL-2.0).

`libmorpheus` est distribuée sous licence
mixte, _Mozilla Public License 2.0_ (MPL-2.0) et _GNU Affero General Public
License v3.0 or later_ (AGPL-3.0-or-later).

### Conversion du grec

Cette application utilise
[greek-conversion](https://github.com/defense-humanites/greek-conversion)
(Antoine Boquet), une bibliothèque JavaScript qui convertit le grec polytonique
et monotonique depuis et vers de nombreuses représentations (beta code,
translittération), distribuée sous licence _MIT_ (MIT License).

### Application Bailly (le présent dépôt)

Copyright (C) 2021-2026 Antoine Boquet, Benjamin Georges

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see https://www.gnu.org/licenses/agpl-3.0.fr.html.
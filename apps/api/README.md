# bailly-api-heroku

> [!NOTE]
> Ce dépôt contient uniquement l'API de l'application Bailly. Le client se trouve quant
à lui dans le dépôt principal
([bailly.app](https://github.com/antoineboquet/bailly.app)).

Veuillez noter que la base de données utilisée par l'API n'est PAS distribuée avec le
code. Si vous cherchez à faire fonctionner cette API par vous-même, vous devrez au
préalable convertir les données
du [Bailly 2020 Hugo Chávez](http://gerardgreco.free.fr/spip.php?article24) dans le
format spécifié au sein du code source.

## Dépôts

Le code est publié, conformément à la licence AGPL, dans le
dépôt [defense-humanites/bailly-api](https://github.com/defense-humanites/bailly-api).
Heroku imposant de livrer la base de données avec le code, le déploiement s'effectue
depuis un dépôt distinct, identique à l'exception des archives de la base. Le script
`scripts/sync_public.sh` reporte le code du second vers le premier, sans les archives :

```sh
scripts/sync_public.sh ../bailly-api # depuis le commit déployé ; puis vérifier et pousser
```

## Mise en route

Cette API fait usage de code natif (libmorpheus), mais peut être déployée aisément, en
local comme en production, à l'aide de Docker. L'image de développement repose sur
l'image `morpheus-deno` de libmorpheus, qui fournit la bibliothèque et le stemlib
Alpheios :

```sh
### Développement

docker compose up

# Avec une base de données chargée arbitrairement depuis le système de fichier courant
# (`HOST_DB` attend soit un chemin absolu soit un chemin relatif au fichier `docker-compose.yml`).
HOST_DB=<file.db> docker compose up

### Production

docker compose -f docker-compose.yml -f docker-compose.prod.yml up # `--build` pour reconstruire l'image
```

### Heroku

Le déploiement sur Heroku repose sur le
buildpack [chibat/heroku-buildpack-deno](https://github.com/chibat/heroku-buildpack-deno) :

- `heroku_build.ts` installe, lors de la construction, la bibliothèque native de
  libmorpheus (Linux x86-64, glibc ; somme SHA-256 vérifiée) et le stemlib Alpheios dans
  `vendor/` ;
- la phase de publication (`release:` dans le `Procfile`, cf.
  `scripts/heroku_release.ts`) vérifie que libmorpheus fonctionne ; en cas d'échec, la
  nouvelle version n'est pas déployée ;
- `.slugignore` écarte du slug les révisions inutilisées de la base et les fichiers de
  développement.

Aucune variable de configuration n'est nécessaire pour la base de données ni pour
libmorpheus : la révision de la base et les chemins de libmorpheus sont versionnés avec
le code (`src/defaults.ts`), de sorte que le code et les données sont toujours déployés
ensemble. Les variables `DB_FILE_PATH`, `DB_VERSION` et `MORPHEUS_*` ne servent qu'à les
surcharger (développement, Docker) et doivent rester absentes de la configuration
Heroku ; en production, l'API signale au démarrage toute surcharge.

Pour publier une nouvelle révision de la base : placer `database/bailly-revN.db`, mettre
à jour `DATABASE` dans `src/defaults.ts` et `.slugignore`, compresser la base avec
`deno task db:pack`, commiter l'archive `.gz`, puis pousser. Les tests échouent si
l'archive de la révision courante manque ou n'est pas suivie par git. La phase de
publication vérifie que la base s'ouvre avant toute mise en service.

## Licence

Copyright (C) 2021-2026 Antoine Boquet, Benjamin Georges

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see https://www.gnu.org/licenses/agpl-3.0.fr.html.

### Données

Cette application utilise les données
du [Bailly 2020 Hugo Chávez](http://gerardgreco.free.fr/spip.php?article24) (Gérard
Gréco, André Charbonnet, Mark De Wilde, Bernard Maréchal _et al._), distribuées sous
licence _Creative Commons Attribution - Pas d'Utilisation Commerciale - Pas de
Modification_ (CC&nbsp;BY-NC-ND&nbsp;4.0).

### Analyse morphologique

Cette application
utilise [libmorpheus](https://github.com/defense-humanites/libmorpheus),
qui modernise et étend les capacités de l'analyseur morphologique Morpheus, lequel a
initialement été développé dans le cadre de la Perseus Digital Library (Gregory Crane
_et al._ pour le compte de l'université Tufts). `libmorpheus` est distribuée sous
licence mixte, MPL-2.0 et AGPL-3.0-or-later.

# bailly-api-next

> [!NOTE]
> Ce dépôt contient uniquement l'API de l'application Bailly. Le client se trouve quant
à lui dans le dépôt principal
([bailly.app](https://github.com/defense-humanites/bailly.app)).

Veuillez noter que la base de données utilisée par l'API n'est PAS distribuée avec le
code. Si vous cherchez à faire fonctionner cette API par vous-même, vous devrez au
préalable convertir les données
du [Bailly 2020 Hugo Chávez](http://gerardgreco.free.fr/spip.php?article24) dans le
format spécifié au sein du code source.

## Architecture

L'API (Hono, TypeScript) est écrite pour deux plateformes, derrière deux interfaces :

- **le dictionnaire** (`src/db/dictionary.ts`) : une base SQLite en lecture seule,
  servie par `node:sqlite` sur Node.js (`src/db/sqlite.ts`) ou par Cloudflare D1
  dans le Worker (`src/db/d1.ts`) ; paramètres positionnels (`?1`…) ;
- **le lemmatiseur** (`src/morpheus/lemmatizer.ts`) : libmorpheus compilé en
  WebAssembly (`@libmorpheus/wasm`, `src/morpheus/wasm.ts`), partout ; ses données
  (stemlib Alpheios, sous-ensemble lu à l'exécution, ~7 Mo) sont chargées en
  mémoire depuis le disque sur Node.js, ou embarquées dans le Worker comme modules
  `Data`. Les codes numériques du module sont décodés en noms (`src/morpheus/decode.ts`)
  à l'identique des liaisons Deno et Node.js de libmorpheus, dont l'API expose un
  sous-ensemble (`morphology=true`).

`src/app.ts` assemble les routes à partir de ces deux dépendances ; `src/node.ts` et
`src/worker.ts` sont les points d'entrée des deux plateformes. Les réglages
(`src/Settings.ts`) viennent de `process.env` (fichier `.env`, cf. `.env.example`) ou
des `vars` de `wrangler.jsonc`.

## Mise en route

Prérequis : Node.js 22.18 ou plus récent (les sources TypeScript sont exécutées
directement, sans compilation) et npm 11.

```sh
npm ci
npm run morpheus:data   # données de Morpheus (Alpheios) dans morpheus-data/, hors git
npm run types           # worker-configuration.d.ts (types du Worker, hors git)
cp .env.example .env    # puis ajuster
```

### La base de données

Elle n'est pas distribuée avec le code (`database/` est ignoré par git) : les données
du Bailly 2020 sont sous licence CC BY-NC-ND, et l'API ne les a jamais publiées. Pour
la produire, convertir le fichier HTML source avec le convertisseur de l'application
(table `bailly` et ses index, cf. `docs/database-revisions.md` pour l'historique des
révisions), puis placer `database/bailly-revN.db` — ou son archive `.gz`, que le
serveur Node.js décompresse au premier démarrage. La révision attendue est fixée dans
`src/defaults.ts` (`DATABASE`), avec la date des données exposée comme `version`.

Les recherches lisent le moins de lignes possible (D1 les facture) grâce à des données
dérivées de la base : `node scripts/db_derive.ts database/bailly-rev4.db
database/bailly-rev5.db` les ajoute à une révision (tables `bailly_unordered` et
`bailly_prefix_count`, colonnes `reversedSearchable*` et `definitionLength`, indexées ;
cf. l'en-tête du script). Sans elles, l'API fonctionne, mais chaque recherche lit et trie
toutes ses correspondances (54 536 lignes pour `α`). `scripts/compare_lookups.ts`
vérifie que les réponses sont identiques avec et sans (implémentation de référence
figée dans `scripts/reference/`).

### Serveur Node.js

```sh
npm run dev             # port 3000 (`npm start` sans rechargement)
```

### Worker (Cloudflare)

```sh
npm run d1:local        # charge la base dans le D1 local de Wrangler (.wrangler/state)
npm run dev:worker      # wrangler dev, port 8787
```

`npm run morpheus:data` génère aussi `src/morpheus/stemlib-manifest.mjs` (hors git),
que `src/worker.ts` importe : il doit tourner avant tout build du Worker (commande
de build de Workers Builds : `npm run morpheus:data`, déploiement par
`wrangler deploy`). Bundle : ~7 Mio non compressés (1,5 Mio compressés).

Base de production : une base D1 par révision (`bailly-dictionary`, identifiant à
reporter dans `wrangler.jsonc`), importée par `wrangler d1 import` depuis un export
SQL de la révision ; la bascule d'une révision à l'autre se fait en changeant le
binding. `npm run types` est à relancer quand `wrangler.jsonc` change.

`@humanities/bailly-search-key`, qui calcule les clés de recherche (partagées avec le
convertisseur des données), n'est publié que sur JSR : ses sources sont copiées
provisoirement dans `src/vendor/` (cf. `src/searchKey.ts`).

## Tests

```sh
npm test                # suite sous Node.js (SQLite + Wasm), ~10 s
npm run test:workers    # la même suite contre le Worker servi par wrangler dev (D1 local)
npm run typecheck       # génère les types du Worker, puis tsc
```

Les deux projets Vitest (`vitest.config.ts`) font tourner les mêmes fichiers de test ;
`#test-app` désigne l'application sous test de la plateforme (`tests/support/`). Les
tests de Morpheus sont ignorés sans les données (`npm run morpheus:data`).

`scripts/compare_lemmatizers.ts` compare les résultats de Morpheus (module
WebAssembly contre bibliothèque native, par `@libmorpheus/node`) sur toutes les
vedettes du dictionnaire.

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
licence mixte, MPL-2.0 et AGPL-3.0-or-later. Les données morphologiques (stemlib
Alpheios) ne sont pas distribuées avec le code : elles sont acquises à l'installation
(`npm run morpheus:data`).

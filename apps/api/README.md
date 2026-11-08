# API de l'application Bailly

> [!NOTE]
> La base de données du dictionnaire n'est PAS distribuée avec le code. Si vous cherchez à faire fonctionner cette API par vous-même, vous devrez au préalable convertir les données du [Bailly 2020 Hugo Chávez](http://gerardgreco.free.fr/spip.php?article24) dans le format spécifié au sein du code source.

## Architecture

L'API (Hono) est écrite pour deux plateformes, derrière deux interfaces :

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
(`src/Settings.ts`) ont tous une valeur par défaut, celle de la production (révision de
la base et champs servis : `src/defaults.ts`) ; `process.env` (fichier `.env`
facultatif, cf. `.env.example`) ou les `vars` de `wrangler.jsonc` ne servent qu'à s'en
écarter.

## Routes et paramètres

Les paramètres sont lus par les schémas du contrat (`@bailly/api-types/params`, Zod
Mini), puis par `src/params.ts` pour ce qui dépend des réglages. Une valeur mal formée
est refusée (400), jamais remplacée ; les paramètres inconnus sont ignorés.

| Route | Paramètres |
|---|---|
| `GET /lookup/:q` | `fields`, `inputMode` (`greek`, `betacode`, `transliteration`), `morphology`, `caseSensitive`, `diacriticSensitive`, `skipMorpheus`, `limit` (au plus `QUERY_MAX_ROWS`) |
| `GET /entry/:uri` | `fields`, `siblings`, `siblingsFields` |
| `GET /entry/random` | `fields`, `lengthRange` (`400,700`, ou une borne), `siblings`, `siblingsFields` |
| `GET /entries/excerpts` | `uris` (1 à 100 URI, séparées par des virgules) |
| `GET /form/:form` | `fields` : les entrées auxquelles une forme peut appartenir, d'après les données (cf. `src/model/form.ts`) : celles de ses liens dans les définitions (table `bailly_form`), sinon celles qu'elle désigne comme mot entier |
| `POST /entry`, `POST /lookup` | **en développement seulement** (`API_ENV=development` : le convertisseur des données, contre un serveur local) ; un corps JSON avec les mêmes paramètres, `q` une liste ou une chaîne séparée par des virgules |

- `fields`, `siblingsFields` : des champs séparés par des virgules, parmi `word`,
  `uri`, `htmlDefinition`, `definition`, `htmlExcerpt`, `excerpt` (ceux de
  `QUERY_ALLOWED_FIELDS`) ; par défaut `word,uri,excerpt`.
- Booléens : `true`, `false`, `1`, `0`, ou une valeur vide (`?morphology`, vrai).
- Une recherche qui ne peut rien trouver (motif trop long, etc.) n'est pas une
  erreur : sa réponse est vide.
- Erreurs : 400, `Cache-Control: no-store`, un corps JSON :

  ```json
  { "error": { "message": "Invalid parameters.", "issues": [{ "path": "limit", "message": "Expected a positive integer." }] } }
  ```

## Mise en route

Prérequis : Node.js 24 ou plus récent, qui exécute directement les sources TypeScript,
sans compilation (version indiquée dans `.node-version`, que lisent Workers Builds et
les gestionnaires de versions comme nvm, fnm ou Volta), et pnpm (version fixée à la
racine du dépôt). Les commandes ci-dessous se lancent depuis `apps/api`.

```sh
pnpm install
pnpm run morpheus:data   # données de Morpheus (Alpheios) dans morpheus-data/, hors git
pnpm run types           # worker-configuration.d.ts (types du Worker, hors git)
cp .env.example .env    # facultatif : seulement pour s'écarter des valeurs par défaut
```

### La base de données

Elle n'est pas distribuée avec le code (`database/` est ignoré par git). Pour
la produire, convertir le fichier HTML source avec le convertisseur de l'application
(table `bailly` et ses index, cf. `docs/database-revisions.md` pour l'historique des
révisions), puis placer `database/bailly-revN.db` — ou son archive `.gz`, que le
serveur Node.js décompresse au premier démarrage. La révision attendue est fixée dans
`src/defaults.ts` (`DATABASE`), avec la date des données exposée comme `version`.

Les recherches lisent le moins de lignes possible grâce à des données
dérivées de la base : `node scripts/db_derive.ts database/bailly-rev5.db
database/bailly-rev6.db` les ajoute à une révision (tables `bailly_unordered`,
`bailly_prefix_count` et `bailly_form`, colonnes `reversedSearchable*` et
`definitionLength`, indexées ; cf. l'en-tête du script ; il peut être rejoué sur une
révision qui les a déjà). Sans elles, l'API fonctionne, mais chaque recherche lit et trie
toutes ses correspondances (54 536 lignes pour `α`). `scripts/compare_lookups.ts`
vérifie que les réponses sont identiques avec et sans (implémentation de référence
figée dans `scripts/reference/`).

### Serveur Node.js

```sh
pnpm run dev             # port 3000 (`pnpm start` sans rechargement)
```

### Worker (Cloudflare)

```sh
pnpm run d1:local        # charge la base dans le D1 local de Wrangler (.wrangler/state)
pnpm run dev:worker      # wrangler dev, port 8787
```

`pnpm run morpheus:data` génère aussi `src/morpheus/stemlib-manifest.mjs` (hors git),
que `src/worker.ts` importe : il doit tourner avant tout build du Worker. Bundle :
~7 Mio non compressés (1,5 Mio compressés).

### Production (Cloudflare)

Le Worker `bailly-api` se déploie depuis `main` par Workers Builds, qui construit
le dépôt (les deux applications) dans ce dossier :

- dossier racine : `apps/api` ; chemins surveillés : `apps/api/*`, `packages/*`,
  `pnpm-lock.yaml`, `pnpm-workspace.yaml` ;
- variable de build `SKIP_DEPENDENCY_INSTALL=true`, l'installation étant faite par
  la commande de build, pour cette seule application et ses paquets de l'espace de
  travail (`...` : `@bailly/api-types` et ses dépendances, dont Zod) ;
- commande de build : `pnpm install --frozen-lockfile --filter "bailly-api..." &&
  pnpm run morpheus:data` (données de Morpheus téléchargées à chaque build, révision
  épinglée et empreintes vérifiées) ;
- commande de déploiement : `pnpm exec wrangler deploy` ;
- Node.js 24 (`.node-version`) ; placement par défaut (au plus près du visiteur).

Le front (`bailly.app`) appelle l'API par un service binding (`API`) pour les pages
qu'il rend ; il doit donc toujours trouver le Worker `bailly-api` déployé.

`api.bailly.app` est servi par une route du Worker (`routes` de `wrangler.jsonc`) :
l'enregistrement DNS reste celui de l'ancienne origine (Heroku), à laquelle le Worker
répond à la place. Retour arrière immédiat : supprimer la route dans le tableau de bord
(Settings > Domains & Routes), puis la retirer de `wrangler.jsonc`, sans quoi le
déploiement suivant la recréerait. Le Worker n'a pas d'adresse `workers.dev`
(`workers_dev: false`) : l'API n'est joignable que par `api.bailly.app`, derrière les
règles de la zone (Bot Fight Mode, règles personnalisées), et par le service binding
du front.

**Cache** : les recherches, les entrées et les extraits ne dépendent que de la requête
et de la base ; leurs réponses portent `Cache-Control: public, max-age=86400,
stale-while-revalidate=604800` (`CACHEABLE`, `src/app.ts`), toutes les autres
`no-store` (entrées au hasard, erreurs, chemins inconnus). Les navigateurs les gardent,
et le cache du Worker aussi (Workers Cache, `"cache": { "enabled": true }` dans
`wrangler.jsonc`) : deux niveaux devant le Worker (le centre de données le plus proche,
puis un niveau commun), clé = chemin et chaîne de requête (ordre des paramètres
compris), sans le nom d'hôte, et la version du Worker : chaque déploiement, donc chaque
nouvelle révision de la base, repart d'un cache vide. Les appels du front par le
service binding le partagent avec les navigateurs. Une réponse servie par le cache ne
fait tourner ni le Worker ni D1 (pas de CPU, mais une requête facturée) et n'apparaît
pas dans le journal du Worker. Retour arrière : `"enabled": false`, puis déployer.

Une requête qui porte l'en-tête `Bailly-Diagnostics` reçoit un en-tête `Server-Timing`
de diagnostic : l'isolat qui l'a servie (`isolate`, `requests`), et s'il a dû démarrer
(`cold`) ou instancier Morpheus (`morpheus`) ; sa réponse n'est jamais gardée par le
cache (`no-store`). `scripts/load_test/k6.js` s'en sert pour mesurer les démarrages à
froid. Le journal du Worker (`pnpm exec wrangler tail bailly-api`) donne une ligne par
requête qui le fait tourner.

Base de production : la base D1 du binding `DB` de `wrangler.jsonc`. D1 n'importe que
du SQL, sans transaction, et refuse toute instruction de plus de 100 Ko :
`pnpm run d1:export` écrit la révision courante en SQL dans ces limites
(`database/bailly-revN.sql`, ~200 Mo ; les 18 lignes trop longues pour une instruction
y sont complétées par morceaux), puis :

```sh
pnpm exec wrangler d1 execute DB --remote --file=database/bailly-rev6.sql
```

L'import supprime d'abord les tables : il peut être rejoué. Une révision qui n'ajoute
qu'une table s'importe seule dans la base en place : `pnpm run d1:export
--tables=bailly_form` (révision 6), puis `wrangler d1 execute` sur
`database/bailly-rev6-bailly_form.sql`. Pour changer de révision
sans interruption, importer dans une nouvelle base et changer l'identifiant du
binding. `pnpm run types` est à relancer quand `wrangler.jsonc` change.

D1 refuse aussi les motifs `LIKE` et `GLOB` de plus de 50 octets (25 lettres
grecques) : les recherches par préfixe, suffixe ou sous-chaîne s'en passent (cf.
`MatchKind` dans `src/model/lookup.ts`), et un motif à jokers plus long (`?`, `*`
intérieur) donne une réponse vide, sur les deux plateformes.

`@humanities/bailly-search-key`, qui calcule les clés de recherche (partagées avec le
convertisseur des données), n'est publié que sur JSR : ses sources sont copiées
provisoirement dans `src/vendor/` (cf. `src/searchKey.ts`).

## Tests

```sh
pnpm test                # suite sous Node.js (SQLite + Wasm), ~10 s
pnpm run test:workers    # la même suite contre le Worker servi par wrangler dev (D1 local)
pnpm run typecheck       # génère les types du Worker, puis tsc
```

Les deux projets Vitest (`vitest.config.ts`) font tourner les mêmes fichiers de test ;
`#test-app` désigne l'application sous test de la plateforme (`tests/support/`). Les
tests de Morpheus sont ignorés sans les données (`pnpm run morpheus:data`).

### Test de charge

`scripts/load_test/` rejoue les requêtes du front (frappe lettre à lettre avec
Morpheus, pages d'entrée, entrées au hasard, extraits), tirées de la base, contre un
déploiement de l'API, avec [k6](https://k6.io). Ils ne visent que l'adresse qu'on
leur donne (`<URL>`) : un déploiement dont on a la charge, local (`pnpm run
dev:worker`) ou le sien.

```sh
node scripts/load_test/urls.ts            # database/load-urls.json
node scripts/load_test/compare.ts <URL A> <URL B>   # mêmes réponses ?
k6 run -e TARGET=<URL> scripts/load_test/k6.js       # paliers de 5, 10, 20, 40 req/s
```

Par défaut, k6 mesure le Worker lui-même : chaque requête porte un paramètre tiré au
hasard (`k6`), qui la rend unique et l'empêche d'être servie par le cache. Avec
`-e CACHE=1`, il envoie les requêtes telles quelles et mesure ce que voit un lecteur,
cache compris (`cache_hits` : la part servie par le cache).

`pnpm run d1:measure` rejoue ces requêtes contre le D1 local et donne, par type, les
allers-retours vers D1 et les lignes lues (ce que D1 facture).

`scripts/compare_lemmatizers.ts` compare les résultats de Morpheus (module
WebAssembly contre bibliothèque native, par `@libmorpheus/node`) sur toutes les
vedettes du dictionnaire.

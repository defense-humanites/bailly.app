# Déployer Bailly sur un serveur

Ce dossier décrit comment faire tourner toute l'application (API, client et
synchronisation des signets) sur un serveur à soi, hors de Cloudflare Workers :
trois conteneurs (`compose.yaml`) derrière un tunnel Cloudflare, qui les expose sans
ouvrir de port. La production tourne sur Cloudflare Workers ; ce déploiement est
celui d'un repli, à répéter de temps en temps pour vérifier qu'il fonctionne.

- `api` : l'API (Node.js), construite par `apps/api/Dockerfile` ; la base du
  dictionnaire est montée en lecture seule (`deploy/data/database`).
- `web` : le client Nuxt (Node.js), construit par `apps/web/Dockerfile` ; hors de
  Cloudflare, les casiers de la synchronisation sont gardés en SQLite, sur un volume.
- `tunnel` : `cloudflared`, qui relie les deux noms publics aux conteneurs.

> [!IMPORTANT]
> La base du dictionnaire n'est pas distribuée (licence des données, cf. le README du
> dépôt), et l'image de l'API embarque les données de Morpheus (Alpheios), dont la
> licence est incertaine : **les images se construisent sur le serveur et ne se
> publient pas**.

## Prérequis

- Un serveur Linux (Debian 12 ou 13, Ubuntu 24.04) : 2 vCPU et 4 Go de mémoire
  suffisent largement (les deux constructions en demandent le plus, ~2 Go).
- Docker Engine et son greffon `compose`, `git`, `sqlite3`.
- Une zone Cloudflare pour les noms publics (le tunnel en dépend).
- Sur un poste de travail : le dépôt, `pnpm install`, et `wrangler login` pour les
  bases D1 (synchronisation).

## 1. Le serveur

1. Mises à jour automatiques (`unattended-upgrades`), accès SSH par clé seulement,
   pare-feu fermé en entrée hors SSH (le tunnel sort vers Cloudflare : aucun port à
   ouvrir).
2. Docker : [dépôt officiel](https://docs.docker.com/engine/install/), puis
   `sudo usermod -aG docker $USER`.
3. Le code : `git clone https://github.com/defense-humanites/bailly.app.git` (branche
   `main`), puis, dans `deploy/` : `cp .env.example .env`.

## 2. La base du dictionnaire

La révision attendue est celle de `apps/api/src/defaults.ts` (`DATABASE`, par
exemple `bailly-rev5.db`).

```sh
mkdir -p deploy/data/database
# depuis le poste qui détient la base, par un canal privé :
rsync -av bailly-rev5.db bailly-rev5.db.sha256 serveur:bailly.app/deploy/data/database/
# sur le serveur :
cd deploy/data/database && sha256sum -c bailly-rev5.db.sha256
```

La base doit être décompressée (le volume est en lecture seule : l'API ne peut pas
décompresser une archive `.gz` au démarrage).

## 3. La base de synchronisation

À faire **avant le premier démarrage de `web`** : sans base, le serveur en crée une
vide, et un appareil dont le casier est introuvable le recrée à partir de ses
signets (les marques de suppression seraient perdues).

```sh
# sur le poste de travail (apps/web), base de préversion pour un essai,
# bailly-sync pour une bascule réelle (après le gel, cf. § 8) :
pnpm exec wrangler d1 export bailly-sync-preview --remote --output=sync.sql
pnpm exec wrangler d1 execute bailly-sync-preview --remote \
  --command "SELECT count(*), sum(version) FROM sync_lockers"
scp sync.sql serveur:bailly.app/deploy/

# sur le serveur :
mkdir -p deploy/data/sync
sqlite3 deploy/data/sync/sync.sqlite < deploy/sync.sql
sqlite3 deploy/data/sync/sync.sqlite "SELECT count(*), sum(version) FROM sync_lockers"
sudo chown -R 1000:1000 deploy/data/sync   # l'utilisateur `node` des conteneurs
rm deploy/sync.sql
```

Les deux comptes doivent être identiques. Le contenu des casiers est chiffré sur les
appareils ; le serveur ne garde que l'empreinte des jetons : rien n'est à convertir.

## 4. Le tunnel

Dans le tableau de bord de Cloudflare (Networks > Tunnels) : créer un tunnel
(`cloudflared`), copier son jeton dans `deploy/.env` (`TUNNEL_TOKEN`), et lui donner
deux noms publics :

| Nom public | Service |
|---|---|
| `APP_HOSTNAME` (ex. `vps.bailly.app`) | `http://web:3000` |
| `API_HOSTNAME` (ex. `api-vps.bailly.app`) | `http://api:3000` |

Reporter les deux noms dans `deploy/.env`. Pour un essai, protéger le nom du client
par Cloudflare Access (pas celui de l'API, que le navigateur appelle sans
identifiants), pour que les robots ne l'indexent pas.

**Cache de l'API** : hors de Workers, Workers Cache n'existe plus ; une règle de
cache de la zone (Caching > Cache Rules) sur `API_HOSTNAME`, « Eligible for cache »,
durée selon l'origine, en tient lieu (l'API pose déjà ses `Cache-Control`).

## 5. Construire et démarrer

```sh
cd deploy
docker compose up -d --build     # construit les deux images (quelques minutes)
docker compose ps                # trois conteneurs, `api` et `web` « healthy »
docker compose logs -f api web
```

## 6. Vérifier

- **API** : réponses identiques à la production, depuis le poste de travail
  (`apps/api`) : `node scripts/load_test/compare.ts https://api.bailly.app
  https://<API_HOSTNAME>` (0 différence) ; une recherche avec analyse morphologique
  (`/lookup/λόγου?morphology=true`).
- **Cache** : deux requêtes identiques à l'API, la seconde avec `cf-cache-status:
  HIT`.
- **Client** : l'accueil, une entrée (rendue par le serveur : le journal de `api`
  montre `GET /entry/…`), une recherche, `/recherche?q=logos` (redirection).
- **Synchronisation** : un casier importé (un appareil qui avait la clé retrouve ses
  signets) ; une synchronisation entre deux appareils ; `docker compose restart web`,
  puis les casiers sont toujours là.
- **Arrêt propre** : `docker compose stop api` termine sans attendre le délai.

## 7. Exploiter

- **Mettre à jour** : `git pull && docker compose up -d --build`.
- **Nouvelle révision de la base** : déposer le fichier (§ 2), mettre à jour le code
  qui l'attend (`DATABASE`), reconstruire ; ou, en urgence, `DB_FILE_PATH` et
  `DB_VERSION` dans l'environnement de `api`.
- **Sauvegardes de la synchronisation** : chaque jour,
  `sqlite3 deploy/data/sync/sync.sqlite ".backup sync-$(date +%F).sqlite"`, copié
  hors du serveur (ou Litestream, en continu, vers un stockage compatible S3).
- **Surveillance** : les sondes de santé des conteneurs (`docker compose ps`), un
  service de surveillance de disponibilité sur les deux noms publics.

## 8. Basculer la production (si cela devait arriver)

1. **Geler la synchronisation** : une règle personnalisée de la zone bloque
   `bailly.app/api/sync/*` (403). Les appareils gardent leurs modifications et
   réessaient plus tard.
2. Exporter `bailly-sync` et l'importer (§ 3), comptes identiques.
3. Donner au tunnel les noms de production (`bailly.app`, `api.bailly.app`), après les
   avoir retirés des Workers (domaine du Worker du client, route du Worker de l'API) ;
   activer la règle de cache.
4. Vérifier (§ 6), puis **lever le gel**. Avant cette étape, revenir en arrière ne
   demande que de rendre les noms aux Workers ; après, les écritures reçues par le
   serveur ne sont que dans `sync.sqlite`.

## 9. Démonter (après un essai)

`docker compose down`, supprimer le tunnel et ses noms publics, effacer
`deploy/data/` (copie de la base du dictionnaire comprise), rendre le serveur.

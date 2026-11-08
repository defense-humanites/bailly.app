# @bailly/api-types

Le contrat de l'API de Bailly, partagé par l'API (`apps/api`) et le client
(`apps/web`) : les types de ses requêtes et de ses réponses, telles qu'elles passent
sur le réseau, et les constantes sur lesquelles les deux doivent s'accorder (champs
des entrées, modes de saisie, limites des lots d'extraits).

Sans étape de construction (seule dépendance : Zod, pour les schémas) : les deux applications importent les
sources TypeScript (`src/index.ts`) ; Vite, Nitro et Wrangler les compilent, et
Node.js 24 les exécute tels quels, le paquet étant lié depuis l'espace de travail
(hors de `node_modules`, où Node.js refuse de retirer les types).

`@bailly/api-types/params` (entrée à part) : les schémas qui lisent les paramètres
des requêtes (Zod Mini), utilisés par l'API ; le client n'en importe rien, et ne
charge donc jamais Zod. Leurs types de sortie sont vérifiés, à la compilation, contre
les types des paramètres du contrat (`EntryParams`, `LookupParams`…), ceux que le
client envoie.

Les types internes de l'API (lignes de la base, paramètres déjà lus) restent dans
`apps/api/src/definitions.ts`.

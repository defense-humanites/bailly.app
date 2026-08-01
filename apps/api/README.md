# bailly-api

> [!NOTE]
> Ce dépôt contient uniquement l'API de l'application Bailly. Le client se trouve quant à lui dans le dépôt principal ([bailly.app](https://github.com/antoineboquet/bailly.app)).

Veuillez noter que la base de données utilisée par l'API n'est PAS distribuée avec le code. Si vous cherchez à faire fonctionner cette API par vous-même, vous devrez au préalable convertir les données du [Bailly 2020 Hugo Chávez](http://gerardgreco.free.fr/spip.php?article24) dans le format spécifié au sein du code source.

Par ailleurs, pour exploiter l'ensemble des fonctionnalités de cette API, il est nécessaire de joindre un exécutable de l'analyseur morphologique [Morpheus](https://github.com/PerseusDL/morpheus), ainsi que le dossier `stemlib` associé.

## Mise en route

Cette API fait usage de code natif compilé pour `linux/amd64` (cf. Morpheus), mais peut être déployée aisément, en local comme en production, à l'aide de Docker :

```sh
### Développement

docker compose up

### Production

docker compose -f docker-compose.yml -f docker-compose.prod.yml up # `--build` pour reconstruire l'image
```

## Licence

Copyright (C) 2021, 2022, 2023, 2024, 2025, 2026 Antoine Boquet, Benjamin Georges

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see https://www.gnu.org/licenses/agpl-3.0.fr.html.

### Données

Cette application utilise les données du [Bailly 2020 Hugo Chávez](http://gerardgreco.free.fr/spip.php?article24) (Gérard Gréco, André Charbonnet, Mark De Wilde, Bernard Maréchal _et al._), distribuées sous licence _Creative Commons Attribution - Pas d'Utilisation Commerciale - Pas de Modification_ (CC&nbsp;BY-NC-ND&nbsp;4.0).

### Analyse morphologique

Cette application utilise l'analyseur morphologique [Morpheus](https://github.com/PerseusDL/morpheus) (Gregory Crane _et al._ pour le compte de l'université Tufts), distribué sous licence _Creative Commons Attribution-ShareAlike 3.0 United States_ (CC&nbsp;BY-SA&nbsp;3.0&nbsp;US).

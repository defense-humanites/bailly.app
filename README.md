> [!NOTE]
> Ce dépôt contient uniquement le client de l'application Bailly. L'API se
> trouve dans le dépôt
> [bailly-api](https://github.com/defense-humanites/bailly-api).

<p align="center">
  <br><br><img width="192" height="192" src="app/assets/icons/bailly.svg" alt="Logo de l'application Bailly">
</p>

<p align="center">
  <strong>Uɴᴇ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ ᴡᴇʙ ᴘᴏᴜʀ ʀᴇɴᴅʀᴇ ᴀᴄᴄᴇssɪʙʟᴇ ᴀ̀ ᴛᴏᴜs<br>
  ʟᴇ ᴅɪᴄᴛɪᴏɴɴᴀɪʀᴇ ɢʀᴇᴄ-ꜰʀᴀɴᴄ̧ᴀɪs ᴅᴇ ʀᴇ́ꜰᴇ́ʀᴇɴᴄᴇ ᴅ'Aɴᴀᴛᴏʟᴇ Bᴀɪʟʟʏ.</strong><br><br>
</p>

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
[Gentium Book Plus](https://software.sil.org/gentium/) (SIL International),
[GFS Didot](https://www.greekfontsociety-gfs.gr/typefaces/19th_century),
[GFS Artemisia](https://www.greekfontsociety-gfs.gr/typefaces/20th_21st_century),
[GFS Bodoni](https://www.greekfontsociety-gfs.gr/typefaces/19th_century) et
[GFS Neohellenic](https://www.greekfontsociety-gfs.gr/typefaces/20th_21st_century)
(Greek Font Society), et la fonte d'interface [Inter](https://rsms.me/inter/)
(Rasmus Andersson), distribuées sous licence _SIL Open Font License 1.1_, ainsi
que la fonte
[IFAOGrec](https://www.ifao.egnet.net/publications/outils/polices/#grec)
(Jean-Luc Fournet, Ralph Hancock & Adam Bülow-Jacobsen), qui est libre de tous
droits, pour rendre les caractères les plus spécifiques. 

Gentium Book Plus et
Inter sont servies en sous-ensembles (`scripts/subset-fonts.sh`) ; « Gentium »
étant un nom réservé de sa licence, le sous-ensemble de Gentium Book Plus porte
le nom « Bailly Book ».

Les fichiers des fontes, accompagnés de leurs licences, se trouvent dans
`app/assets/fonts/`.

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
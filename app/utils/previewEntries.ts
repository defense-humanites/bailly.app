/**
 * Short real entries (30) to preview the reading settings (cf. the
 * preferences page), one drawn at each visit. Each takes three lines on a desktop screen
 * (the definition on two, the etymology on one) whatever the font, size and
 * weight, so that the preview keeps its height when they change (checked by
 * a test, `settings.spec.ts`, with every reading font). Their HTML
 * comes from the API (`htmlDefinition`), as it was on 1 October 2026.
 */
export const PREVIEW_ENTRIES: readonly { word: string; uri: string; html: string }[] = [
  {
    word: "ὀψομανής",
    uri: "opsomanês",
    html: "<span class=\"entreea\"><span class=\"grec\">ὀψο·μανής,</span></span> <span class=\"des\">ής, ές</span>\n[<span class=\"grec\">ᾰ</span>] passionné pour la bonne chère,\ngourmet, <span class=\"aut\">Ath.</span> <span class=\"refpa\">464</span><span class=\"refpb\">e</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/opson\">ὄψον</a>, <a href=\"/mainomai\">μαίνομαι</a></span>.</div>\n",
  },
  {
    word: "θελξίνοος-ους",
    uri: "thelxinoos-ous",
    html: "<span class=\"entreea\"><span class=\"grec\">θελξί·νοος-ους,</span></span> <span class=\"des\">οος-ους,\nοον-ουν</span> [<span class=\"grec\">ῐ</span>] qui charme l’esprit\n<span class=\"ital\">ou</span> le cœur, <span class=\"aut\">Mus.</span>\n<span class=\"refch\">147 ;</span> <span class=\"aut\">Anth.</span>\n<span class=\"refch\">6, 88</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">θ. <a href=\"/noos-nous\">νόος</a></span>.</div>\n",
  },
  {
    word: "ἀμετροπαθής",
    uri: "ametropathês",
    html: "<span class=\"entreea\"><span class=\"grec\">ἀμετρο·παθής,</span></span> <span class=\"des\">ής, ές</span>\n[<span class=\"grec\">πᾰ</span>] passionné outre mesure, <span class=\"aut\">Alcin.</span> <span class=\"oeuv\">Intr. Plat.</span>\n<span class=\"refch\">p. 118</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">ἄ. <a href=\"/pathos\">πάθος</a></span>.</div>\n",
  },
  {
    word: "ἀλληλοφονία",
    uri: "allêlophonia",
    html: "<span class=\"entreea\"><span class=\"grec\">*ἀλληλοφονία,</span></span> <span class=\"ital\">dor.</span>\n<span class=\"es\">ἀλλαλοφονία,</span> <span class=\"gens\">ας</span>\n(<span class=\"grec\"><span data-linked-entries=\"hê_(1),ho_(1)\">ἡ</span></span>) [<span class=\"grec\">λᾱ</span>] action\nde s’entre-tuer, <span class=\"aut\">Pd.</span> <span class=\"oeuv\">O.</span> <span class=\"refch\">2, 42</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/allêlophonos\">ἀλληλοφόνος</a></span>.</div>\n",
  },
  {
    word: "ὀζόστομος",
    uri: "ozostomos",
    html: "<span class=\"entreea\"><span class=\"grec\">ὀζό·στομος,</span></span> <span class=\"des\">ος, ον,</span>\ndont la bouche sent mauvais, <span class=\"aut\">Anth.</span>\n<span class=\"refch\">11, 427 ;</span> <span class=\"aut\">M.\nAnt.</span> <span class=\"refch\">5, 28</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><span data-linked-entries=\"ozos,ozô\">ὄζω</span>, <a href=\"/stoma\">στόμα</a></span>.</div>\n",
  },
  {
    word: "ἰσοφέριστος",
    uri: "isopheristos",
    html: "<span class=\"entreea\"><span class=\"grec\">ἰσο·φέριστος,</span></span> <span class=\"des\">ος, ον</span>\n[<span class=\"grec-longueur\">ῑσο</span>] égal au meilleur,\négalement excellent, <span class=\"aut\">Naz.</span> <span class=\"refch\">3, 401 Migne</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">ἴ. <a href=\"/pheristos\">φέριστος</a></span>.</div>\n",
  },
  {
    word: "ὀξυμέριμνος",
    uri: "oxumerimnos",
    html: "<span class=\"entreea\"><span class=\"grec\">ὀξυ·μέριμνος,</span></span> <span class=\"des\">ος, ον</span>\n[<span class=\"grec\">ῠ</span>] qui demande un esprit aiguisé,\nsubtil, <span class=\"aut\">Ar.</span> <span class=\"oeuv\">Ran.</span>\n<span class=\"refch\">877</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">ὀ. <a href=\"/merimna\">μέριμνα</a></span>.</div>\n",
  },
  {
    word: "ὀνόπορδον",
    uri: "onopordon",
    html: "<span class=\"entreea\"><span class=\"grec\">ὀνό·πορδον,</span></span> <span class=\"gens\">ου</span>\n(<span class=\"grec\"><span data-linked-entries=\"ho_(1),to\">τὸ</span></span>) sorte de grand chardon (<span class=\"ital\">propr.</span> pet d’âne), <span class=\"aut\">Plin.</span>\n<span class=\"oeuv\">H.N.</span> <span class=\"refch\">27, 87</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/onos\">ὄνος</a>, <a href=\"/perididomai\">πέρδω</a></span>.</div>\n",
  },
  {
    word: "μεγαλοκίνδυνος",
    uri: "megalokindunos",
    html: "<span class=\"entreea\"><span class=\"grec\">μεγαλο·κίνδυνος,</span></span> <span class=\"des\">ος,\nον</span> [<span class=\"grec-longueur\">ᾰῡ</span>] qui s’expose à de\ngrands dangers, <span class=\"aut\">Arstt.</span> <span class=\"oeuv\">Nic.</span> <span class=\"refch\">4, 3, 23</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">μ. κ.</span></div>\n",
  },
  {
    word: "ὀρνιθογνώμων",
    uri: "ornithognômôn",
    html: "<span class=\"entreea\"><span class=\"grec\">ὀρνιθο·γνώμων,</span></span> <span class=\"des\">ων,\nον,</span> <span class=\"ital\">gén.</span> <span class=\"gens\">ονος,</span> qui se connaît en oiseaux, <span class=\"aut\">El.</span> <span class=\"oeuv\">N.A.</span> <span class=\"refch\">16, 2</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/ornis\">ὄρνις</a>, <a href=\"/gnômê\">γνώμη</a></span>.</div>\n",
  },
  {
    word: "μεγαλοεργέω",
    uri: "megaloergeô",
    html: "<span class=\"entreea\"><span class=\"grec\">*μεγαλοεργέω,</span></span> <span class=\"ital\">p.\ncontr.</span> <span class=\"es\">μεγαλουργέω-ῶ</span> [<span class=\"grec-longueur\">ᾰ</span>] faire de grandes choses, <span class=\"aut\">Phil.</span> <span class=\"refch\">2, 142,</span> <span class=\"ital\">etc.</span>\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/megaloergos\">μεγαλοεργός</a></span>.</div>\n",
  },
  {
    word: "ἀντιθέω",
    uri: "antitheô",
    html: "<span class=\"entreea\"><span class=\"grec\">ἀντι·θέω</span></span> :\n<div class=\"pp\"><span class=\"ppa\">1</span> lutter à la course avec,\n<span class=\"ital\">dat.</span> <span class=\"aut\">Hdt.</span>\n<span class=\"refch\">5, 22</span> ||</div>\n<div class=\"pp\"><span class=\"ppa\">2</span> courir à l’encontre,\n<span class=\"aut\">Anth.</span> <span class=\"refch\">9,\n822</span>.</div>\n",
  },
  {
    word: "ὑπερδεκατάλαντος",
    uri: "huperdekatalantos",
    html: "<span class=\"entreea\"><span class=\"grec\">ὑπερ·δεκα·τάλαντος,</span></span> <span class=\"des\">ος,\nον</span> [<span class=\"grec\">ᾰτᾰ</span>] qui vaut plus de dix\ntalents, <span class=\"aut\">Phalar.</span> <span class=\"oeuv\">Ep.</span> <span class=\"refch\">113</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">ὑ. <a href=\"/deka\">δέκα</a>, <a href=\"/talanton\">τάλαντον</a></span>.</div>\n",
  },
  {
    word: "πολύαγρος",
    uri: "poluagros",
    html: "<span class=\"entreea\"><span class=\"grec\">πολύ·αγρος,</span></span> <span class=\"des\">ος, ον,</span>\n<span class=\"ital\">seul cp.</span> <span class=\"grec\"><span data-linked-self>πολυαγρότερος</span>,</span> <span class=\"aut\">Anth.</span>\n<span class=\"refch\">6, 184,</span> qui prend beaucoup de gibier.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">π. <a href=\"/agra\">ἄγρα</a></span>.</div>\n",
  },
  {
    word: "ὀρσολοπεύω",
    uri: "orsolopeuô",
    html: "<span class=\"entreea\"><span class=\"grec\">ὀρσολοπεύω,</span></span> assaillir, harceler, tourmenter,\n<span class=\"ital\">acc.</span> <span class=\"aut\">Hh.</span>\n<span class=\"oeuv\">Merc.</span> <span class=\"refch\">308 ;</span>\n<span class=\"aut\">Max.</span> <span class=\"oeuv\"><span class=\"grec\">π. κατ.</span></span> <span class=\"refch\">107</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/orsolopos\">ὀρσολόπος</a></span>.</div>\n",
  },
  {
    word: "βουλευτήριος",
    uri: "bouleutêrios",
    html: "<span class=\"entreea\"><span class=\"grec\">βουλευτήριος,</span></span> <span class=\"des\">ος, ον,</span>\npropre à donner un conseil, conseiller, <span class=\"aut\">Eschl.</span> <span class=\"oeuv\">Sept.</span> <span class=\"refch\">575</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/bouleuô\">βουλεύω</a></span>.</div>\n",
  },
  {
    word: "δρυΐνας",
    uri: "druinas",
    html: "<span class=\"entreea\"><span class=\"grec\">δρυΐνας</span></span> (<span class=\"grec\"><a href=\"/ho_(1)\">ὁ</a></span>)\n[<span class=\"grec\">ῠῐ</span>] serpent qui se cache dans les chênes\ncreux, <span class=\"aut\">Nic.</span> <span class=\"oeuv\">Th.</span>\n<span class=\"refch\">411</span> (<span class=\"ital\">gén.</span>\n<span class=\"grec\">-αο</span>).\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/drus\">δρῦς</a></span>.</div>\n",
  },
  {
    word: "ἔλασμα",
    uri: "elasma",
    html: "<span class=\"entreea\"><span class=\"grec\">ἔλασμα,</span></span> <span class=\"gens\">ατος</span>\n(<span class=\"grec\"><span data-linked-entries=\"ho_(1),to\">τὸ</span></span>) lame métallique, <span class=\"aut\">Paus.</span> <span class=\"refch\">10, 16, 1 ;</span>\n<span class=\"aut\">Str.</span> <span class=\"refch\">240 ;</span>\n<span class=\"aut\">Spt.</span> <span class=\"oeuv\">Hab.</span>\n<span class=\"refch\">2, 19 ;</span> <span class=\"aut\">Diosc.</span>\n<span class=\"refch\">5, 96</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><span data-linked-entries=\"elaunô,elaô-ô,elaô\">ἐλάω</span></span>.</div>\n",
  },
  {
    word: "ἀϋλία",
    uri: "aulia",
    html: "<span class=\"entreea\"><span class=\"grec\">ἀϋλία,</span></span> <span class=\"gens\">ας</span>\n(<span class=\"grec\"><span data-linked-entries=\"hê_(1),ho_(1)\">ἡ</span></span>) [<span class=\"grec\">ᾰῡ</span>] nature\nimmatérielle <span class=\"ital\">ou</span> incorporelle,\n<span class=\"aut\">Hiérocl.</span> <span class=\"oeuv\">C. aur.</span>\n<span class=\"refch\">p. 479 Mullach</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/aulos_(2)\">ἄϋλος</a></span>.</div>\n",
  },
  {
    word: "ὀκτάτονος",
    uri: "oktatonos",
    html: "<span class=\"entreea\"><span class=\"grec\">ὀκτά·τονος,</span></span> <span class=\"des\">ος, ον</span>\n[<span class=\"grec\">ᾰ</span>] tendu en huit parties, au nombre de\nhuit, <span class=\"aut\">Anth.</span> <span class=\"refch\">9,\n14</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">ὀ. <a href=\"/teinô\">τείνω</a></span>.</div>\n",
  },
  {
    word: "οὐδέπη",
    uri: "oudepê",
    html: "<span class=\"entreea\"><span class=\"grec\">οὐδέ·πη</span></span> <span class=\"ital\">ou</span>\n<span class=\"es\">οὐδέ πη,</span> <span class=\"ital\">adv.</span> en\naucune façon, <span class=\"aut\">Il.</span> <span class=\"refch\">6,\n267,</span> <span class=\"ital\">etc. ;</span> <span class=\"aut\">Od.</span> <span class=\"refch\">12, 232 ;</span> <span class=\"aut\">Hh.</span> <span class=\"refch\">6, 58</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><span data-linked-entries=\"oude,oudos\">οὐδέ</span>, πῆ</span>.</div>\n",
  },
  {
    word: "ἡμιδανάκη",
    uri: "hêmidanakê",
    html: "<span class=\"entreea\"><span class=\"grec\">ἡμι·δανάκη,</span></span> <span class=\"gens\">ης</span>\n<span class=\"art\">(<span class=\"grec\"><span data-linked-entries=\"hê_(1),ho_(1)\">ἡ</span></span>)</span>\n[<span class=\"grec-longueur\">ᾰν</span>] demi-<span class=\"grec\">δανάκη,</span> <span class=\"ital\">monnaie barbare,</span>\n<span class=\"aut\">Théon</span> <span class=\"oeuv\">Prog.</span>\n<span class=\"refch\">13 conj.</span>\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/hêmi-\">ἡμι-</a></span>, <span class=\"grec\">δ.</span></div>\n",
  },
  {
    word: "Δαμοίτας",
    uri: "Damoitas",
    html: "<span class=\"entreea\"><span class=\"grec\">Δαμοίτας,</span></span> <span class=\"gens\">α</span>\n<span class=\"art\">(<span class=\"grec\"><a href=\"/ho_(1)\">ὁ</a></span>)</span>\n[<span class=\"grec-longueur\">ᾱᾱ</span>] Damœtas :\n<div class=\"pp\"><span class=\"ppa\">1</span> berger, <span class=\"aut\">Thcr.</span> <span class=\"oeuv\">Idyl.</span> <span class=\"refch\">6, 1</span> ||</div>\n<div class=\"pp\"><span class=\"ppa\">2</span> pêcheur, <span class=\"aut\">Anth.</span> <span class=\"refch\">6, 193</span>.</div>\n",
  },
  {
    word: "ἀνταγανακτέω-ῶ",
    uri: "antaganakteô-ô",
    html: "<span class=\"entreea\"><span class=\"grec\">ἀντ·αγανακτέω-ῶ</span></span> [<span class=\"grec\">ᾰγᾰν</span>] s’indigner à son tour, <span class=\"aut\">Œnom.</span> (<span class=\"aut\">Eus.</span> <span class=\"refch\">3, 437 Migne</span>).\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/anti\">ἀντί</a>, ἀγ.</span></div>\n",
  },
  {
    word: "Ἀρχιτέλης",
    uri: "Architelês",
    html: "<span class=\"entreea\"><span class=\"grec\">Ἀρχι·τέλης,</span></span> <span class=\"gens\">ους,</span>\n<span class=\"ital\">acc.</span> <span class=\"des\">ην</span>\n(<span class=\"grec\"><a href=\"/ho_(1)\">ὁ</a></span>) Arkhitélès, <span class=\"ital\">h.</span> <span class=\"aut\">Plut.</span> <span class=\"oeuv\">Them.</span> <span class=\"refch\">7 ;</span> <span class=\"aut\">Luc.</span> <span class=\"oeuv\">Scyth.</span> <span class=\"refch\">2,</span> <span class=\"ital\">etc.</span>\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/archô\">ἄρχω</a>, <a href=\"/telos\">τέλος</a></span>.</div>\n",
  },
  {
    word: "ψυχάω-ῶ",
    uri: "psuchaô-ô",
    html: "<span class=\"entreea\"><span class=\"grec\">ψυχάω-ῶ</span></span> [<span class=\"grec-longueur\">ῡ</span>]\nrafraîchir, <span class=\"ital\">seul. moy.</span> <span class=\"grec\">ψυχάομαι</span> <span class=\"grec\">-ῶμαι</span>, se\nrafraîchir, <span class=\"aut\">El.</span> <span class=\"oeuv\">V.H.</span> <span class=\"refch\">3, 1</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/psuchos\">ψῦχος</a></span>.</div>\n",
  },
  {
    word: "δυσώνης",
    uri: "dusônês",
    html: "<span class=\"entreea\"><span class=\"grec\">δυσ·ώνης,</span></span> <span class=\"gens\">ου</span>\n(<span class=\"grec\"><a href=\"/ho_(1)\">ὁ</a></span>) [<span class=\"grec\">ῠ</span>] mauvais\nacheteur, qui marchande, <span class=\"aut\">Lync.</span>\n(<span class=\"aut\">Ath.</span> <span class=\"refpa\">228</span><span class=\"refpb\">c</span>).\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\">δ. <a href=\"/ôneomai\">ὠνέομαι</a></span>.</div>\n",
  },
  {
    word: "διανάγκασις",
    uri: "dianankasis",
    html: "<span class=\"entreea\"><span class=\"grec\">διανάγκασις,</span></span> <span class=\"gens\">εως</span>\n<span class=\"art\">(<span class=\"grec\"><span data-linked-entries=\"hê_(1),ho_(1)\">ἡ</span></span>)</span>\n[<span class=\"grec-longueur\">ᾰν</span>] action de réduire un membre\nluxé, <span class=\"aut\">Hpc.</span> <span class=\"refpa\">863</span><span class=\"refpb\">g</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/dianankazô\">διαναγκάζω</a></span>.</div>\n",
  },
  {
    word: "ἐκδύσια",
    uri: "ekdusia",
    html: "<span class=\"entreea\"><span class=\"grec\">ἐκδύσια,</span></span> <span class=\"gens\">ων</span>\n(<span class=\"grec\"><span data-linked-entries=\"ho_(1),ta_(1),tis_(1)\">τὰ</span></span>) [<span class=\"grec\">ῠ</span>] fête à\nPhæstos, en Crète, lorsque l’enfant déposait le peplum,\n<span class=\"aut\">A. Lib.</span> <span class=\"refch\">18</span>.\n<div class=\"etymor\"><span class=\"etiqetymor\">Étym.</span>\n<span class=\"grec\"><a href=\"/ekduô\">ἐκδύω</a></span>.</div>\n",
  },
  {
    word: "ἀναλακτίζω",
    uri: "analaktizô",
    html: "<span class=\"entreea\"><span class=\"grec\">ἀνα·λακτίζω</span></span> :\n<div class=\"pp\"><span class=\"ppa\">1</span> ruer, <span class=\"aut\">Antyll.</span> (<span class=\"aut\">Orib.</span> <span class=\"refch\">121 Matthäi</span>) ||</div>\n<div class=\"pp\"><span class=\"ppa\">2</span> repousser du pied,\n<span class=\"ital\">acc.</span> <span class=\"aut\">Clém.</span>\n<span class=\"refch\">890</span>.</div>\n",
  },
];

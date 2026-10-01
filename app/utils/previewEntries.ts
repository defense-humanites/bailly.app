/**
 * Short real entries to preview the reading settings (cf. the preferences
 * page), one drawn at each visit. Each takes three lines on a desktop screen
 * (the definition on two, the etymology on one) whatever the font, size and
 * weight, so that the preview keeps its height when they change (measured
 * with every reading font; to measure again if one is added). Their HTML
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
];

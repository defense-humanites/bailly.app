/* eslint-disable */
/*
 * The notice of an outdated browser (cf. `navigateurs-anciens.md`), inlined
 * at the end of every page's body (cf. `nuxt.config.ts`): ES5 only, so that
 * the oldest browsers run it. The application needs Safari 16.4, Chrome 111,
 * Firefox 113 (Tailwind 4's media queries in ranges, `color-mix()`, Vite's
 * default target); below, the page served is still readable, but the
 * interface is broken and some functions fail. The notice goes before
 * `#__nuxt`, out of the application: it stays when Nuxt replaces the page by
 * its error screen; fixed at the bottom of the window. Nothing is added for
 * an up-to-date browser. Closed, it stays closed for the session.
 */
(function () {
  try {
    var supported = !!(window.CSS && CSS.supports && CSS.supports("color", "color-mix(in oklab, red, red)")
      && window.matchMedia && window.matchMedia("(width >= 0px)").matches);
    if (supported) {
      try { new RegExp("(?<!a)b"); } catch (e) { supported = false; }
    }
    if (supported) return;
    try { if (sessionStorage.getItem("bailly:outdatedBrowser")) return; } catch (e) {}

    var ios = /(?:iPhone|iPad|iPod).* OS (\d+)_(\d+)/.exec(navigator.userAgent);
    var major = ios ? +ios[1] : 0;
    var message;
    if (ios && major <= 15) {
      message = "Bailly.app demande iOS\u00a016.4 ou plus récent, et votre appareil est sous iOS\u00a0" + major + ". "
        + "Mettez-le à jour si c’est possible (Réglages\u00a0› Général\u00a0› Mise à jour logicielle). "
        + "Sinon, changer de navigateur n’y fera rien\u00a0: sur iPhone et iPad, tous utilisent le moteur de Safari. "
        + "Vous pourrez lire les entrées, mais pas utiliser la recherche\u00a0: pour cela, passez par un ordinateur ou un appareil plus récent.";
    } else if (ios) {
      message = "Bailly.app demande iOS\u00a016.4 ou plus récent, et votre appareil est sous iOS\u00a0" + major + "." + ios[2] + ". "
        + "Mettez-le à jour (Réglages\u00a0› Général\u00a0› Mise à jour logicielle) pour que l’application fonctionne correctement.";
    } else {
      message = "Votre navigateur est trop ancien pour Bailly.app\u00a0: l’affichage est dégradé et certaines fonctions, comme la recherche, ne marchent pas. "
        + "Mettez-le à jour, ou utilisez un navigateur récent (Firefox, Chrome, Edge, Safari).";
    }

    var notice = document.createElement("div");
    notice.setAttribute("role", "region");
    notice.setAttribute("aria-label", "Navigateur trop ancien");
    notice.setAttribute("data-outdated-browser", "");
    // At the bottom of the window, above the application (whose header is
    // fixed at the top).
    notice.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;"
      + "display:flex;gap:12px;align-items:flex-start;"
      + "padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));"
      + "background:#fbf1e6;color:#2a2320;border-top:1px solid #b8442b;box-shadow:0 -4px 16px rgba(42,35,32,.15);"
      + "font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:left;";
    var text = document.createElement("p");
    text.style.cssText = "margin:0;flex:1;";
    text.appendChild(document.createTextNode(message));
    var close = document.createElement("button");
    close.type = "button";
    close.appendChild(document.createTextNode("Fermer"));
    close.style.cssText = "flex:none;padding:4px 10px;border:1px solid #b8442b;border-radius:6px;"
      + "background:#fff;color:#2a2320;font:inherit;cursor:pointer;";
    close.onclick = function () {
      notice.parentNode.removeChild(notice);
      try { sessionStorage.setItem("bailly:outdatedBrowser", "closed"); } catch (e) {}
    };
    notice.appendChild(text);
    notice.appendChild(close);
    document.body.insertBefore(notice, document.body.firstChild);
  } catch (e) {}
})();

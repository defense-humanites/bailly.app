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
    var title;
    var message;
    if (ios && major <= 15) {
      title = "Version d’iOS trop ancienne";
      message = "Bailly.app demande iOS\u00a016.4 ou plus récent, et votre appareil est sous iOS\u00a0" + major + ". "
        + "Mettez-le à jour si c’est possible (Réglages\u00a0› Général\u00a0› Mise à jour logicielle). "
        + "Sinon, changer de navigateur n’y fera rien\u00a0: sur iPhone et iPad, tous utilisent le moteur de Safari. "
        + "Vous pourrez lire les entrées, mais pas utiliser la recherche\u00a0: pour cela, passez par un ordinateur ou un appareil plus récent.";
    } else if (ios) {
      title = "Version d’iOS trop ancienne";
      message = "Bailly.app demande iOS\u00a016.4 ou plus récent, et votre appareil est sous iOS\u00a0" + major + "." + ios[2] + ". "
        + "Mettez-le à jour (Réglages\u00a0› Général\u00a0› Mise à jour logicielle) pour que l’application fonctionne correctement.";
    } else {
      title = "Navigateur trop ancien";
      message = "L’affichage de Bailly.app est dégradé et certaines fonctions, comme la recherche, ne fonctionnent pas. "
        + "Mettez votre navigateur à jour, ou utilisez un navigateur récent (Firefox, Chrome, Edge, Safari).";
    }

    var notice = document.createElement("div");
    notice.setAttribute("role", "region");
    notice.setAttribute("aria-labelledby", "outdated-browser-title");
    notice.setAttribute("data-outdated-browser", "");
    // At the bottom of the window, above the application (whose header is
    // fixed at the top); on the whole width of a phone, narrower beyond.
    notice.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;"
      + "padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));"
      + "background:#fbf1e6;color:#2a2320;border-top:1px solid #b8442b;box-shadow:0 -4px 16px rgba(42,35,32,.15);"
      + "font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:left;";
    var inner = document.createElement("div");
    inner.style.cssText = "max-width:40rem;margin:0 auto;";
    // The title in bold, centered on the button beside it; the message under
    // both.
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;";
    var heading = document.createElement("p");
    heading.id = "outdated-browser-title";
    heading.style.cssText = "margin:0;font-weight:700;";
    heading.appendChild(document.createTextNode(title));
    var close = document.createElement("button");
    close.type = "button";
    close.appendChild(document.createTextNode("Fermer"));
    close.style.cssText = "flex:none;padding:4px 10px;border:1px solid #b8442b;border-radius:6px;"
      + "background:#fff;color:#2a2320;font:inherit;cursor:pointer;";
    close.onclick = function () {
      notice.parentNode.removeChild(notice);
      try { sessionStorage.setItem("bailly:outdatedBrowser", "closed"); } catch (e) {}
    };
    var text = document.createElement("p");
    text.style.cssText = "margin:6px 0 0;";
    text.appendChild(document.createTextNode(message));
    head.appendChild(heading);
    head.appendChild(close);
    inner.appendChild(head);
    inner.appendChild(text);
    notice.appendChild(inner);
    document.body.insertBefore(notice, document.body.firstChild);
  } catch (e) {}
})();

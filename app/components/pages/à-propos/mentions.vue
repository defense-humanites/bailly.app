<template>
  <article>
    <section>
      <h2>Application «&nbsp;Bailly&nbsp;»</h2>
      <p>
        Antoine Boquet &amp; Benjamin Georges / licence <em>GNU Affero General Public License</em> (AGPL-3.0-or-later)
        (<a
          href="/COPYING"
          target="_blank"
          rel="noopener"
        >texte&nbsp;intégral</a>) / consulter le <a
          target="_blank"
          rel="noopener"
          href="https://github.com/antoineboquet/bailly.app"
        >code&nbsp;source</a>.
      </p>
      <p>Version des données&nbsp;: 28 février 2023.</p>
    </section>

    <section>
      <h2>Bailly 2020 Hugo Chávez</h2>
      <p>
        Gérard Gréco, André Charbonnet, Mark De Wilde, Bernard Maréchal
        <em>
          <ModalLink
            client:load
            label="et al."
            modal-title="Contributeurs au Bailly 2020"
          >
            <template #modalContent>
              <ContributorsList />
            </template>
          </ModalLink>
        </em> / licence <em>Creative Commons Attribution - Pas d'Utilisation Commerciale - Pas de
          Modification</em> (CC&nbsp;BY-NC-ND&nbsp;4.0) (<a
          href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr"
          target="_blank"
          rel="noopener"
        >résumé</a>&nbsp;|&nbsp;<a
          href="https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.fr"
          target="_blank"
          rel="noopener"
        >texte&nbsp;intégral</a>) / consulter la <a
          href="http://gerardgreco.free.fr/spip.php?article24"
          target="_blank"
          rel="noopener"
        >source</a>.
      </p>
    </section>

    <section>
      <h2>Analyseur morphologique « Morpheus »</h2>
      <p>
        Gregory Crane <em>et al.</em> pour le compte de l'université Tufts / licence
        <em>Creative Commons Attribution-ShareAlike 3.0 United States</em>
        (CC&nbsp;BY-SA&nbsp;3.0&nbsp;US) (<a
          href="https://creativecommons.org/licenses/by-sa/3.0/us/deed.en"
          target="_blank"
          rel="noopener"
        >résumé</a>&nbsp;|&nbsp;<a
          href="https://creativecommons.org/licenses/by-sa/3.0/us/legalcode.en"
          target="_blank"
          rel="noopener"
        >texte&nbsp;intégral</a>) / consulter le <a
          target="_blank"
          rel="noopener"
          href="https://github.com/PerseusDL/morpheus"
        >code&nbsp;source</a>.
      </p>
    </section>
  </article>
</template>

<style>
  @reference "~/assets/css/main.css";

  article {
    @apply space-y-1.5 lg:space-y-3;
  }

  h2+p {
    @apply mt-1.5 lg:mt-3;
  }

  h2 {
    @apply text-xl;
    @apply font-semibold;
  }

  p+p {
    @apply mt-1.5;
  }
</style>

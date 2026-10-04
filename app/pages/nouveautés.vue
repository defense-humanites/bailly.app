<script setup lang="ts">
  definePageMeta({
    layout: "single-column",
  });

  useSeoMeta({
    title: "Nouveautés",
    description: "Après trois années et demie d'existence, l'application Bailly s'enrichit de nouvelles fonctionnalités.",
  });
</script>

<template>
  <article class="space-y-6 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
    <!--
      The news of the published version (10 October 2024), as they were.
      The Greek examples (search inputs and their matches) in the
      dictionary's font, the matched part underlined.
    -->
    <header>
      <h1 class="text-3xl font-bold">
        L'application Bailly fait peau neuve&nbsp;!
      </h1>
      <p class="mt-2 text-muted">
        Après trois années et demie d'existence, l'application Bailly s'enrichit
        de nouvelles fonctionnalités que nous vous invitons à découvrir&nbsp;:
      </p>
    </header>

    <ul class="space-y-6">
      <li class="flex gap-3">
        <UIcon
          name="i-lucide-sparkles"
          class="mt-0.5 size-5 shrink-0 text-primary"
        />
        <div>
          <h2 class="font-semibold">
            Trouvez les lemmes à partir des formes fléchies.
          </h2>
          <p class="mt-1">
            Jusqu'à présent, il était nécessaire d'entrer la forme canonique du mot
            recherché. Désormais, les formes fléchies sont reconnues dans la plupart
            des cas.
          </p>
        </div>
      </li>
      <li class="flex gap-3">
        <UIcon
          name="i-lucide-asterisk"
          class="mt-0.5 size-5 shrink-0 text-primary"
        />
        <div>
          <h2 class="font-semibold">
            Affinez vos recherches avec les caractères spéciaux.
          </h2>
          <p class="mt-1">
            Les caractères jokers «&nbsp;<strong>?</strong>&nbsp;» et
            «&nbsp;<strong>*</strong>&nbsp;» ainsi que les bornes
            «&nbsp;<strong>^</strong>&nbsp;» et «&nbsp;<strong>$</strong>&nbsp;»
            ont été introduits. Utilisez-les dans vos recherches lorsque vous
            souhaitez représenter, respectivement&nbsp;:
          </p>
          <ul class="mt-2 ms-5 list-outside list-disc space-y-1 marker:text-dimmed">
            <li>
              un caractère indéterminé («&nbsp;<strong>?</strong>&nbsp;»&nbsp;;
              <span
                lang="grc"
                class="example"
              >«&nbsp;οργ<u>?</u>ζω&nbsp;»</span> &rarr;
              <span
                lang="grc"
                class="example"
              >«&nbsp;ὀργ<u>ά</u>ζω&nbsp;»</span>,
              <span
                lang="grc"
                class="example"
              >«&nbsp;ὀργ<u>ί</u>ζω&nbsp;»</span>)&nbsp;;
            </li>
            <li>
              zéro, un ou plusieurs caractères indéterminés
              («&nbsp;<strong>*</strong>&nbsp;»&nbsp;;
              <span
                lang="grc"
                class="example"
              >«&nbsp;αναλογ<u>*</u>ος&nbsp;»</span> &rarr;
              <span
                lang="grc"
                class="example"
              >«&nbsp;ἀνάλογος&nbsp;»</span>,
              <span
                lang="grc"
                class="example"
              >«&nbsp;ἀναλογ<u>ικ</u>ός&nbsp;»</span>,
              <span
                lang="grc"
                class="example"
              >«&nbsp;ἀναλογ<u>ισμ</u>ός&nbsp;»</span>, etc)&nbsp;;
            </li>
            <li>
              une correspondance à partir de la fin du terme recherché
              («&nbsp;<strong>$</strong>&nbsp;»&nbsp;;
              <span
                lang="grc"
                class="example"
              >«&nbsp;ταμος<u>$</u>&nbsp;»</span> &rarr;
              <span
                lang="grc"
                class="example"
              >«&nbsp;<u>ἄρ</u>ταμος&nbsp;»</span>,
              <span
                lang="grc"
                class="example"
              >«&nbsp;<u>πο</u>ταμός&nbsp;»</span>,
              <span
                lang="grc"
                class="example"
              >«&nbsp;<u>ἱπποπό</u>ταμος&nbsp;»</span>, etc)&nbsp;;
            </li>
            <li>
              une correspondance exacte («&nbsp;<strong>^</strong>&nbsp;» en
              conjonction avec «&nbsp;<strong>$</strong>&nbsp;»&nbsp;;
              <span
                lang="grc"
                class="example"
              >«&nbsp;<u>^</u>ιερος<u>$</u>&nbsp;»</span> &rarr;
              <span
                lang="grc"
                class="example"
              >«&nbsp;<u>ἱερός</u>&nbsp;»</span>).
            </li>
          </ul>
        </div>
      </li>
      <li class="flex gap-3">
        <UIcon
          name="i-lucide-bookmark"
          class="mt-0.5 size-5 shrink-0 text-primary"
        />
        <div>
          <h2 class="font-semibold">
            Organisez vos recherches à l'aide des signets.
          </h2>
          <p class="mt-1">
            Il est maintenant possible d'ajouter les entrées consultées à la nouvelle
            liste des favoris ou bien de les assigner à une étiquette personnalisée.
            La nouvelle page des «&nbsp;<NuxtLink to="/signets">signets</NuxtLink>&nbsp;»
            permet à la fois de consulter les entrées marquées de la sorte et de
            gérer les étiquettes.
          </p>
        </div>
      </li>
      <li class="flex gap-3">
        <UIcon
          name="i-lucide-moon-star"
          class="mt-0.5 size-5 shrink-0 text-primary"
        />
        <div>
          <h2 class="font-semibold">
            Appréciez le nouveau thème sombre.
          </h2>
          <p class="mt-1">
            Un thème sombre a été introduit pour une consultation plus agréable,
            notamment dans les environnements peu lumineux. Celui-ci s'activera
            automatiquement en fonction des préférences d'affichage de votre appareil
            et peut être activé manuellement <em>via</em> la page des
            «&nbsp;<NuxtLink :to="encodeURI('/préférences')">préférences</NuxtLink>&nbsp;».
          </p>
        </div>
      </li>
    </ul>

    <p class="text-muted">
      &mdash; Antoine Boquet, le 10 octobre 2024.
    </p>

    <aside class="rounded-lg bg-primary/5 p-4 ring-1 ring-primary/15 md:p-6">
      <p>
        Si vous souhaitez nous faire part de votre avis ou nous contacter pour
        toute autre raison, vous pouvez nous joindre par
        <a href="mailto:contact@bailly.app">courriel</a>.
      </p>
    </aside>
  </article>
</template>

<style scoped>
  /* The dictionary's font, the matched part underlined. */
  .example {
    font-family: var(--font-serif);
    color: var(--ui-text-toned);
  }

  .example u {
    font-weight: 600;
    text-underline-offset: 0.2em;
  }
</style>

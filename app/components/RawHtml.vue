<script lang="ts">
  import { defineComponent, h } from "vue";

  /**
   * An element with the given HTML, as `v-html` would render it, but kept as
   * it is by the hydration: Vue 3.5 hydrates an element's dynamic props, and
   * a `v-html` (compiled into a dynamic `innerHTML`) rebuilt the whole of a
   * definition's markup after the server's, identical (on λέγω, its three
   * definitions), in the hydration's task (cf. `audit-inp.md`). Created by a
   * render function, the element has no dynamic props: its HTML is set when
   * it changes only. The attributes (class, listeners) go to the element.
   * @remarks Only for HTML that is safe (cf. `EntryCard`).
   */
  export default defineComponent({
    name: "RawHtml",
    props: {
      /** The element's HTML. */
      html: { type: String, required: true },
      /** The element. */
      tag: { type: String, default: "div" },
    },
    setup(props) {
      return () => h(props.tag, { innerHTML: props.html });
    },
  });
</script>

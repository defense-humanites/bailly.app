/**
 * Whether the application runs installed on an iPhone or iPad's home screen
 * (`navigator.standalone`, iOS and iPadOS only): it then keeps its own
 * storage, apart from Safari's, so that the bookmarks of the one aren't
 * found in the other unless synchronized (on Android, an installed
 * application shares the storage of the browser that installed it).
 * Known in the browser only: `false` on the server and until mounted (the
 * markup stays the server's when hydrated).
 */
export function useInstalledOnIos(): Readonly<Ref<boolean>> {
  const installed = ref(false);
  onMounted(() => {
    installed.value = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  });
  return readonly(installed);
}

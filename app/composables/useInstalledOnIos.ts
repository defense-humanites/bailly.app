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
    installed.value = (navigator as Navigator & { standalone?: boolean }).standalone === true || simulated();
  });
  return readonly(installed);
}

/**
 * In development only, the installed application simulated in a desktop
 * browser: `?ios-installe` in the address, kept for the tab's session
 * (`?ios-installe=0` ends it).
 */
function simulated(): boolean {
  if (!import.meta.dev) return false;
  const KEY = "bailly:simulateInstalledOnIos";
  try {
    const parameter = new URLSearchParams(location.search).get("ios-installe");
    if (parameter !== null) {
      if (parameter === "0") sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, "1");
    }
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

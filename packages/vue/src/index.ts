import { inject, type App, type InjectionKey } from "vue";
import tell from "@tell-rs/browser";
import type { TellBrowserConfig, TellInstance } from "@tell-rs/browser";

export { tell } from "@tell-rs/browser";
export type { TellBrowserConfig, TellInstance } from "@tell-rs/browser";

const TELL_KEY: InjectionKey<TellInstance> = Symbol("tell");

export interface TellPluginOptions extends TellBrowserConfig {
  apiKey: string;
}

/**
 * Vue plugin that configures Tell and provides the instance via injection.
 *
 * ```ts
 * // main.ts
 * import { createApp } from "vue";
 * import { TellPlugin } from "@tell-rs/vue";
 *
 * const app = createApp(App);
 * app.use(TellPlugin, { apiKey: "..." });
 * app.mount("#app");
 * ```
 */
export const TellPlugin = {
  install(app: App, options: TellPluginOptions) {
    const { apiKey, ...config } = options;
    tell.configure(apiKey, config);
    app.provide(TELL_KEY, tell);

    app.config.globalProperties.$tell = tell;
    const originalUnmount = app.unmount.bind(app);
    app.unmount = () => {
      // Fire-and-forget: close() flushes batchers via fetch. In an SPA the
      // page stays alive so the fetch completes normally. If the tab is
      // closing, the browser SDK's beforeunload/visibilitychange handlers
      // already drain via sendBeacon. Awaiting here would make unmount async,
      // which Vue callers don't expect.
      tell.close();
      originalUnmount();
    };
  },
};

/**
 * Composable to access the Tell instance inside a setup function.
 *
 * ```vue
 * <script setup>
 * import { useTell } from "@tell-rs/vue";
 * const tell = useTell();
 * tell.track("Page Viewed");
 * </script>
 * ```
 */
export function useTell(): TellInstance {
  const instance = inject(TELL_KEY);
  if (!instance) {
    throw new Error(
      "Tell is not provided. Did you install TellPlugin on your app?"
    );
  }
  return instance;
}

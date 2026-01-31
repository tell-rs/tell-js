import { inject, type App, type InjectionKey } from "vue";
import tell from "tell-js";
import type { TellBrowserConfig, TellInstance } from "tell-js";

export { tell } from "tell-js";
export type { TellBrowserConfig, TellInstance } from "tell-js";

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
 * import { TellPlugin } from "@tell/vue";
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

    // Flush on unmount
    app.config.globalProperties.$tell = tell;
    const originalUnmount = app.unmount.bind(app);
    app.unmount = () => {
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
 * import { useTell } from "@tell/vue";
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

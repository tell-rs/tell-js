/**
 * Registers happy-dom globals BEFORE Vue is imported.
 * Vue's runtime-dom caches `document` at module load time,
 * so the DOM must exist before any Vue import.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

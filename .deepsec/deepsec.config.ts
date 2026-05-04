import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "overlay-landing", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});

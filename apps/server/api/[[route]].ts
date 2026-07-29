import { buildApp } from "../src/index.js";

let app: Awaited<ReturnType<typeof buildApp>> | null = null;

async function getApp() {
  if (!app) app = await buildApp();
  return app;
}

export default {
  async fetch(request: Request) {
    const { app: honoApp } = await getApp();
    return honoApp.fetch(request);
  },
};

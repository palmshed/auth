import { serve } from "@hono/node-server";
import { buildApp } from "./index.js";

async function main() {
  const { app, close } = await buildApp();

  serve(app, (info) => {
    console.log(`auth server listening on http://localhost:${info.port}`);
  });

  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

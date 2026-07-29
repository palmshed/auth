import express from "express";
import { Auth } from "@palmshed/auth-core";
import { SqliteStorage } from "@palmshed/auth-storage-sqlite";
import { middleware, requireAuth, requirePermission, createRouter } from "@palmshed/auth-express";

const storage = new SqliteStorage("auth.db");
const auth = new Auth({ storage, config: { captcha: { provider: "none" } } });
const app = express();

app.use(express.json());
app.use(middleware(auth));
app.use("/api", createRouter(auth));

app.get("/api/admin", requireAuth(), requirePermission("admin", "panel"), (req, res) => {
  res.json({ ok: true, message: "Admin access granted" });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));

import express, { Request, Response } from "express";
import path from "path";

const PORT = Number(process.env.PORT || 3000);
const FLASK_API_ORIGIN = process.env.FLASK_API_ORIGIN || "";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use("/api", async (req: Request, res: Response) => {
  if (!FLASK_API_ORIGIN) {
    return res.status(503).json({
      error: "API backend is served by the Flask/Gunicorn appliance. Set FLASK_API_ORIGIN for Node development proxying.",
    });
  }

  const target = new URL(req.originalUrl, FLASK_API_ORIGIN);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value && key.toLowerCase() !== "host") {
      headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
  });

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(Buffer.from(await upstream.arrayBuffer()));
});

const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DVSwitch NCS frontend server listening on http://0.0.0.0:${PORT}`);
});

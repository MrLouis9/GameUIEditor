import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

// Simple file-based storage for shared documents
const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Save a document
  app.post("/api/share", (req, res) => {
    try {
      const id = Math.random().toString(36).substring(2, 10);
      const data = req.body;
      fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(data));
      res.json({ id, url: `/api/document/${id}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Retrieve a document
  app.get("/api/document/:id", (req, res) => {
    try {
      const { id } = req.params;
      const filePath = path.join(DATA_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        res.type("json").send(data);
      } else {
        res.status(404).json({ error: "Document not found" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

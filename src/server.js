// src/server.js
import express from "express";
import { normalizeTitle, resolveRedirect } from "./utils.js";
import { findPathBFS } from "./bfs.js";

const app = express();
app.use(express.json());

app.post("/find-connection", async (req, res) => {
  try {
    const { from, to, maxDepth = 4 } = req.body;
    if (!from || !to) return res.status(400).json({ error: "Missing 'from' or 'to'" });

    const nf = normalizeTitle(from);
    const nt = normalizeTitle(to);
    console.info(`[req] normalize: ${nf} -> ${nt}`);

    // resolve redirects (canonical titles)
    const [rf, rt] = await Promise.all([resolveRedirect(nf), resolveRedirect(nt)]);
    if (!rf) return res.status(404).json({ error: `Page not found: ${from}` });
    if (!rt) return res.status(404).json({ error: `Page not found: ${to}` });

    console.info(`[req] canonical: ${rf} -> ${rt}`);

    const start = Date.now();
    const result = await findPathBFS(rf, rt, Number(maxDepth));
    const elapsed = Date.now() - start;

    if (result.path) {
      return res.json({ path: result.path, steps: result.path.length - 1, elapsed_ms: elapsed, stats: result.stats });
    } else {
      return res.status(200).json({ message: "No path found within maxDepth", elapsed_ms: elapsed, stats: result.stats });
    }
  } catch (err) {
    console.error("server error:", err?.message ?? err);
    return res.status(500).json({ error: "Internal server error", message: err?.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
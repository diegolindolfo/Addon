/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, limit, query, orderBy } from "firebase/firestore";
import { db } from "./src/lib/firebase"; // Importing finalized Firebase client
import { StreamItem, UserConfig } from "./src/types";

// Error guards to prevent Node.js process crashing from unhandled SDK/Firestore events
process.on("unhandledRejection", (reason, promise) => {
  console.error("[SERVER-FATAL] Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[SERVER-FATAL] Uncaught Exception thrown:", error);
});

// Lazy initialization of Gemini client according to React & Full-Stack guidelines
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("[GEMINI] Warning: GEMINI_API_KEY is undefined or empty.");
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("[GEMINI] Client initialized successfully via secrets flow.");
  }
  return aiInstance;
}

const app = express();
const PORT = 3000;

  // Use JSON and CORS to comply with Stremio Cross-Origin requests
  app.use(express.json());
  app.use(cors());

  // Log all request paths for debugging (Stremio sends various route requests)
  app.use((req, res, next) => {
    console.log(`[STREMIO-ADDON-REQUEST] ${req.method} ${req.path}`);
    next();
  });

  // Helper routine to retrieve dynamic User Config from Firestore safely
  async function getUserConfig(uid: string): Promise<UserConfig | null> {
    try {
      const docRef = doc(db, "user_configs", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserConfig;
      }
    } catch (e) {
      console.error(`Error loading configs for uid: ${uid}`, e);
    }
    return null;
  }

  // --- STREMIO ADDON API ROUTES ---

  // 1. Manifest Endpoint (Customized per User UID)
  app.get(["/api/user/:uid/manifest.json", "/user/:uid/manifest.json"], async (req, res) => {
    const { uid } = req.params;
    const config = await getUserConfig(uid);

    const name = config?.customManifestName || "My Firebase Addon";
    const description = config?.customDescription || "Seu catálogo pessoal de streams e IPTV conectado em nuvem via Firebase.";

    res.json({
      id: `community.firebaseaddon.${uid}`,
      version: "1.0.0",
      name: name,
      description: description,
      resources: ["catalog", "meta", "stream"],
      types: ["movie", "series"],
      idPrefixes: ["fb-strem-", "tt"],
      catalogs: [
        {
          type: "movie",
          id: `fb_movies_${uid}`,
          name: "My Movies & Channels",
          extra: [{ name: "genre", isRequired: false }]
        },
        {
          type: "series",
          id: `fb_series_${uid}`,
          name: "My Custom Series",
          extra: [{ name: "genre", isRequired: false }]
        }
      ],
      behaviorHints: {
        configurable: true,
        configurationRequired: false
      }
    });
  });

  // 2. Catalogs Endpoint
  app.get(["/api/user/:uid/catalog/:type/:id.json", "/user/:uid/catalog/:type/:id.json"], async (req, res) => {
    const { uid, type, id } = req.params;
    const config = await getUserConfig(uid);

    if (!config || !config.streams) {
      return res.json({ metas: [] });
    }

    // Filter streams matching the requested type (movie or series)
    const filteredStreams = config.streams.filter(s => s.type === type);

    // Map to Stremio Meta layout
    const metas = filteredStreams.map(stream => ({
      id: stream.id,
      type: stream.type,
      name: stream.name,
      poster: stream.poster || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=300",
      description: stream.description || `Categoria: ${stream.genre || "Geral"}`,
      genres: [stream.genre || "Firebase Playlist"],
      background: stream.poster || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=800",
    }));

    res.json({ metas });
  });

  // Optional: Stremio Catalog fallback with search parameters
  app.get(["/api/user/:uid/catalog/:type/:id/:extra.json", "/user/:uid/catalog/:type/:id/:extra.json"], async (req, res) => {
    const { uid, type, id, extra } = req.params;
    const config = await getUserConfig(uid);

    if (!config || !config.streams) {
      return res.json({ metas: [] });
    }

    let filteredStreams = config.streams.filter(s => s.type === type);

    // Filter by genre if provided in extra params (e.g., genre=IPTV)
    if (extra) {
      const decodedExtra = decodeURIComponent(extra);
      const match = decodedExtra.match(/genre=([^&]+)/);
      if (match && match[1]) {
        const selectedGenre = match[1];
        filteredStreams = filteredStreams.filter(s => s.genre === selectedGenre);
      }
    }

    const metas = filteredStreams.map(stream => ({
      id: stream.id,
      type: stream.type,
      name: stream.name,
      poster: stream.poster || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=300",
      description: stream.description || `Categoria: ${stream.genre || "Geral"}`,
      genres: [stream.genre || "Firebase Playlist"],
      background: stream.poster || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=800",
    }));

    res.json({ metas });
  });

  // 3. Meta Details Endpoint
  app.get(["/api/user/:uid/meta/:type/:id.json", "/user/:uid/meta/:type/:id.json"], async (req, res) => {
    const { uid, type, id } = req.params;
    const config = await getUserConfig(uid);

    if (!config || !config.streams) {
      return res.json({ meta: null });
    }

    const stream = config.streams.find(s => s.id === id);
    if (!stream) {
      return res.json({ meta: null });
    }

    res.json({
      meta: {
        id: stream.id,
        type: stream.type,
        name: stream.name,
        poster: stream.poster || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=300",
        background: stream.poster || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=800",
        description: stream.description || "Sem descrição disponível enviada pelo Firebase.",
        genres: [stream.genre || "Geral"],
        logo: stream.poster // provides logo for modern stremio skins
      }
    });
  });

  // 4. Streams Player Endpoint
  app.get(["/api/user/:uid/stream/:type/:id.json", "/user/:uid/stream/:type/:id.json"], async (req, res) => {
    const { uid, type, id } = req.params;
    const config = await getUserConfig(uid);

    if (!config || !config.streams) {
      return res.json({ streams: [] });
    }

    // Lookup stream either by exact custom id or by imdbId association
    const stream = config.streams.find(s => s.id === id || (s.imdbId && s.imdbId === id));
    if (!stream) {
      return res.json({ streams: [] });
    }

    // Register dynamic playback action in Firebase Logs for personal stats
    try {
      const logsRef = collection(db, "playback_logs");
      await addDoc(logsRef, {
        uid: uid,
        streamId: stream.id,
        streamName: stream.name,
        streamType: stream.type,
        playedAt: new Date().toISOString()
      });
      console.log(`[FIREBASE-LOG] Playback registered in database for stream: ${stream.name}`);
    } catch (err) {
      console.error("Failed to store playback log in Firestore", err);
    }

    const streamsPayload = [];

    // If stream contains direct file url
    if (stream.url) {
      // If it's a direct url structure, we can offer it as primary play source
      // We can also route it through a redirection service to log exact click events!
      streamsPayload.push({
        title: `⚡ Assitir via Firebase Core Link [${stream.genre || 'Stream'}]`,
        url: stream.url,
        behaviorHints: {
          notWebCompatible: false
        }
      });
    }

    // If stream contains YouTube Video ID
    if (stream.ytId) {
      streamsPayload.push({
        title: `📺 Assistir no YouTube [Trailer / Clipe]`,
        ytId: stream.ytId
      });
    }

    // If stream contains Peer-to-Peer torrent bundle
    if (stream.infoHash) {
      streamsPayload.push({
        title: `🧲 Assistir via Peer-to-Peer Torrent Engine`,
        infoHash: stream.infoHash
      });
    }

    res.json({ streams: streamsPayload });
  });

  // --- API BACKEND BUSINESS LOGIC GATEWAYS ---

  // Gateway to trigger Gemini AI and suggest rich movie/series details + posters
  app.post("/api/generate-meta", async (req, res) => {
    const { prompt } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: "Gemini API Client is currently unconfigured. Set a GEMINI_API_KEY in Settings > Secrets." });
    }

    try {
      console.log(`[GEMINI] Generating metadata for prompt: "${prompt}"`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Create high-quality cinematic metadata details matching this user request/prompt: "${prompt}". Suggest standard poster images from splash URLs or similar if possible. Determine target category genre. Provide output in JSON only matching the schema rules.`,
        config: {
          systemInstruction: "You are a specialized Movie Catalog Metadata and IPTV Channel Curator. You analyze prompts and create highly customized details (Title, Type: 'movie'|'series', creative description, Genre/category, suggestions of Unsplash media images for the poster, and a realistic trailer YouTube ID if applicable) formatted perfectly inside the requested JSON Schema.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "The beautiful suggested title of the item or group" },
              type: { type: Type.STRING, enum: ["movie", "series"], description: "The Stremio catalog type: movie or series" },
              description: { type: Type.STRING, description: "A detailed description, summary or subtitle for catalog display" },
              genre: { type: Type.STRING, description: "A single clean category name or genre (e.g., Sci-Fi, Animes, IPTV Brasil, Retro, Classics)" },
              poster: { type: Type.STRING, description: "Clear link to a beautiful movie/media Unsplash photo (e.g. https://images.unsplash.com/photo-...)" },
              ytId: { type: Type.STRING, description: "A valid YouTube Video ID for a related cinematic trailer or video if anyone exists" }
            },
            required: ["name", "type", "description", "genre"]
          }
        }
      });

      const text = response.text || "{}";
      const metadata = JSON.parse(text);
      res.json(metadata);
    } catch (e: any) {
      console.error("Gemini Meta Generator failed:", e);
      res.status(500).json({ error: e.message || "Something went wrong while curating content using AI." });
    }
  });

  // Gateway for fetching playback analytics
  app.get("/api/user/:uid/analytics", async (req, res) => {
    const { uid } = req.params;
    try {
      const q = query(collection(db, "playback_logs"), orderBy("playedAt", "desc"), limit(25));
      const snaps = await getDocs(q);
      const list: any[] = [];
      snaps.forEach(docSnap => {
        const item = docSnap.data();
        if (item.uid === uid) {
          list.push({ id: docSnap.id, ...item });
        }
      });
      res.json({ logs: list });
    } catch (error: any) {
      console.error("Analytics fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to load playback analytics log from server database" });
    }
  });

  // --- VITE WEB APP INTEGRITY MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    (async () => {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    })();
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[STREMIO-SERVER] Online at http://0.0.0.0:${PORT}`);
    });
  }

  export default app;

import { serve } from "bun";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// --- CONFIGURATION ---
// Ensure ELEVENLABS_API_KEY is set in your Railway Variables
const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// Store user + timestamp of last "ping"
type UserSession = {
  id: string;
  lastSeen: number;
};

let sessions: UserSession[] = [];
let currentTurnIndex = 0;

console.log(`❤️ Heartbeat & Transcribe Server running on port ${process.env.PORT || 3000}`);

serve({
  port: process.env.PORT || 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Standard CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") return new Response(null, { headers });

    // --- 1. STATUS + HEARTBEAT ---
    if (url.pathname === "/status" && req.method === "GET") {
      const userId = url.searchParams.get("id");

      // Register / Update Heartbeat
      if (userId) {
        const existing = sessions.find((s) => s.id === userId);
        if (existing) {
          existing.lastSeen = Date.now();
        } else {
          sessions.push({ id: userId, lastSeen: Date.now() });
          console.log(`User connected: ${userId}`);
        }
      }

      // Cleanup (Remove users gone for > 5 seconds)
      const now = Date.now();
      sessions = sessions.filter((s) => now - s.lastSeen < 5000);

      // Determine Turn
      if (sessions.length === 0) currentTurnIndex = 0;
      else currentTurnIndex = currentTurnIndex % sessions.length;

      const activeUser = sessions.length > 0 ? sessions[currentTurnIndex].id : null;

      return new Response(
        JSON.stringify({
          activeUser,
          onlineCount: sessions.length,
          users: sessions.map((s) => s.id),
        }),
        { headers }
      );
    }

    // --- 2. PASS TURN ---
    if (url.pathname === "/pass" && req.method === "POST") {
      if (sessions.length > 0) {
        currentTurnIndex = (currentTurnIndex + 1) % sessions.length;
      }
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // --- 3. TRANSCRIPTION (ElevenLabs Integration) ---
    if (url.pathname === "/transcribe" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const audioFile = formData.get("file");

        if (!audioFile || !(audioFile instanceof Blob)) {
          return new Response("No audio file uploaded", { status: 400, headers });
        }

        console.log(`Transcribing ${audioFile.size} bytes...`);

        // Send to ElevenLabs Scribe
        const transcription = await client.speechToText.convert({
          file: audioFile,
          modelId: "scribe_v2", // The new high-quality model
          tagAudioEvents: true,
          languageCode: "eng",
          diarize: true, // Identifies "Speaker A", "Speaker B"
        });

        console.log("Transcription success:", transcription.text);

        return new Response(JSON.stringify(transcription), {
          headers: { ...headers, "Content-Type": "application/json" },
        });

      } catch (error: any) {
        console.error("Transcription failed:", error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { ...headers, "Content-Type": "application/json" } 
        });
      }
    }

    return new Response("Not Found", { status: 404, headers });
  },
});
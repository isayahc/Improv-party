import { serve } from "bun";
import Anthropic from "@anthropic-ai/sdk";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// --- CONFIGURATION ---
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

// --- STATE ---
type GameState = "LOBBY" | "PLAYING";
type UserSession = { id: string; lastSeen: number; };

let sessions: UserSession[] = [];
let gameState: GameState = "LOBBY";
let currentTurnIndex = 0;

let chatHistory: any[] = [];
let latestAiMessage = "Waiting for game to start...";
let latestAudioBuffer: ArrayBuffer | null = null; // <--- NEW: Stores the audio

// --- HELPER: TEXT + AUDIO GENERATION ---
async function generateAiResponse(systemPrompt: string, userInput?: string) {
  if (userInput) chatHistory.push({ role: "user", content: userInput });

  // 1. Generate Text (Claude)
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 400,
    system: systemPrompt,
    messages: chatHistory.length > 0 ? chatHistory : [{ role: "user", content: "Start the game." }],
  });

  const textBlock = msg.content[0];
  if (textBlock.type === "text") {
    const responseText = textBlock.text;
    chatHistory.push({ role: "assistant", content: responseText });
    latestAiMessage = responseText;

    // 2. Generate Audio (ElevenLabs) <--- NEW
    try {
      console.log("Generating audio for:", responseText.substring(0, 20) + "...");
      const audioStream = await elevenlabs.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
        text: responseText,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
      });

      // Convert Stream to Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      
      // Combine chunks into one buffer
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      latestAudioBuffer = result.buffer;

    } catch (err) {
      console.error("Audio generation failed:", err);
    }

    return responseText;
  }
  return "...";
}

console.log(`🔊 Game Server running on port ${process.env.PORT || 3000}`);

serve({
  port: process.env.BUN_PUBLIC_CLIENT_PORT || 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") return new Response(null, { headers });

    // --- 1. STATUS ---
    if (url.pathname === "/status" && req.method === "GET") {
      const userId = url.searchParams.get("id");
      if (userId) {
        const existing = sessions.find((s) => s.id === userId);
        if (existing) existing.lastSeen = Date.now();
        else sessions.push({ id: userId, lastSeen: Date.now() });
      }
      const now = Date.now();
      sessions = sessions.filter((s) => now - s.lastSeen < 10000);
      const activeUser = sessions.length > 0 ? sessions[currentTurnIndex % sessions.length].id : null;

      return new Response(JSON.stringify({
          gameState,
          activeUser: gameState === "PLAYING" ? activeUser : null,
          onlineCount: sessions.length,
          latestAiMessage, 
        }), { headers });
    }

    // --- 2. GET AUDIO (NEW ENDPOINT) ---
    if (url.pathname === "/audio" && req.method === "GET") {
      if (!latestAudioBuffer) return new Response("No audio", { status: 404, headers });
      
      return new Response(latestAudioBuffer, {
        headers: {
          ...headers,
          "Content-Type": "audio/mpeg",
          "Content-Length": latestAudioBuffer.byteLength.toString(),
        },
      });
    }

    // --- 3. START GAME ---
    if (url.pathname === "/start" && req.method === "POST") {
      if (gameState === "PLAYING") return new Response("Started", { headers });
      gameState = "PLAYING";
      chatHistory = [];
      await generateAiResponse("You are a Game Master. Set a sci-fi scene. End by asking the first player action.");
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // --- 4. SUBMIT TURN ---
    if (url.pathname === "/turn" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const audioFile = formData.get("file");
        if (!audioFile || !(audioFile instanceof Blob)) return new Response("No audio", { status: 400, headers });

        // Transcribe
        const transcription = await elevenlabs.speechToText.convert({
          file: audioFile,
          modelId: "scribe_v2",
        });

        // AI Reply
        await generateAiResponse(
          "You are the Game Master. React dramatically, then prompt the NEXT player.",
          transcription.text
        );

        currentTurnIndex = (currentTurnIndex + 1) % sessions.length;
        return new Response(JSON.stringify({ success: true }), { headers });
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
      }
    }

    return new Response("Not Found", { status: 404, headers });
  },
});
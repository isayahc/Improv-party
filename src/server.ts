import { serve } from "bun";
import Anthropic from "@anthropic-ai/sdk";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// --- CONFIGURATION ---
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

// --- GAME STATE ---
type GameState = "LOBBY" | "PLAYING";

type UserSession = {
  id: string;
  lastSeen: number;
};

let sessions: UserSession[] = [];
let gameState: GameState = "LOBBY";
let currentTurnIndex = 0;

// The "Memory" of the game
let chatHistory: any[] = [];
let latestAiMessage = "Waiting for game to start...";

// --- HELPER: AI GENERATION ---
async function generateAiResponse(systemPrompt: string, userInput?: string) {
  // 1. Add user input to history if exists
  if (userInput) {
    chatHistory.push({ role: "user", content: userInput });
  }

  // 2. Call Claude
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-6", // Or "claude-3-sonnet-20240229" for speed
    max_tokens: 400,
    system: systemPrompt,
    messages: chatHistory.length > 0 ? chatHistory : [{ role: "user", content: "Start the game." }],
  });

  const textBlock = msg.content[0];
  if (textBlock.type === "text") {
    const responseText = textBlock.text;
    chatHistory.push({ role: "assistant", content: responseText });
    latestAiMessage = responseText;
    return responseText;
  }
  return "...";
}

console.log(`🎲 Game Server running on port ${process.env.PORT || 3000}`);

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

    // --- 1. STATUS & LOBBY ---
    if (url.pathname === "/status" && req.method === "GET") {
      const userId = url.searchParams.get("id");

      // Heartbeat Logic
      if (userId) {
        const existing = sessions.find((s) => s.id === userId);
        if (existing) existing.lastSeen = Date.now();
        else sessions.push({ id: userId, lastSeen: Date.now() });
      }

      // Cleanup Ghosts
      const now = Date.now();
      sessions = sessions.filter((s) => now - s.lastSeen < 10000); // 10s timeout

      // Turn Logic
      const activeUser = sessions.length > 0 ? sessions[currentTurnIndex % sessions.length].id : null;

      return new Response(
        JSON.stringify({
          gameState,
          activeUser: gameState === "PLAYING" ? activeUser : null,
          onlineCount: sessions.length,
          latestAiMessage, // Send the story text to frontend
        }),
        { headers }
      );
    }

    // --- 2. START GAME (One time trigger) ---
    if (url.pathname === "/start" && req.method === "POST") {
      if (gameState === "PLAYING") return new Response("Already started", { headers });
      
      gameState = "PLAYING";
      chatHistory = []; // Reset history
      
      // Initialize the Game Scenario
      await generateAiResponse(
        "You are a Game Master for an improv game. Set the scene for a sci-fi adventure. Keep it brief (2 sentences). End by asking the first player what they do."
      );

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // --- 3. SUBMIT TURN (Audio -> Text -> AI) ---
    if (url.pathname === "/turn" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const audioFile = formData.get("file");

        if (!audioFile || !(audioFile instanceof Blob)) {
          return new Response("No audio", { status: 400, headers });
        }

        // A. Transcribe (ElevenLabs)
        const transcription = await elevenlabs.speechToText.convert({
          file: audioFile,
          modelId: "scribe_v2",
        });

        const userText = transcription.text;
        console.log("User said:", userText);

        // B. AI Reacts (Claude)
        // It takes the user's text, adds it to history, and generates a response
        await generateAiResponse(
          "You are the Game Master. React to the player's action dramatically, then prompt the NEXT player for their action.",
          userText
        );

        // C. Advance Turn
        currentTurnIndex = (currentTurnIndex + 1) % sessions.length;

        return new Response(JSON.stringify({ success: true, userText }), { 
          headers: { ...headers, "Content-Type": "application/json" } 
        });

      } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
      }
    }

    return new Response("Not Found", { status: 404, headers });
  },
});
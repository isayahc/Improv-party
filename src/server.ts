import { serve } from "bun";

// Store user + timestamp of last "ping"
type UserSession = {
  id: string;
  lastSeen: number;
};

let sessions: UserSession[] = [];
let currentTurnIndex = 0;

console.log(`❤️ Heartbeat Server running on port ${process.env.PORT || 3000}`);

serve({
  port: process.env.PORT || 3003,
  async fetch(req) {
    const url = new URL(req.url);

    // Standard CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") return new Response(null, { headers });

    // --- THE MAGIC: STATUS + HEARTBEAT ---
    // Client polls: GET /status?id=user-123
    if (url.pathname === "/status" && req.method === "GET") {
      const userId = url.searchParams.get("id");

      // 1. REGISTER / UPDATE HEARTBEAT
      if (userId) {
        const existing = sessions.find((s) => s.id === userId);
        if (existing) {
          existing.lastSeen = Date.now(); // Update timestamp
        } else {
          sessions.push({ id: userId, lastSeen: Date.now() }); // New user!
          console.log(`User connected: ${userId}`);
        }
      }

      // 2. CLEANUP (Remove users gone for > 5 seconds)
      const now = Date.now();
      sessions = sessions.filter((s) => now - s.lastSeen < 5000);

      // 3. DETERMINE TURN
      if (sessions.length === 0) currentTurnIndex = 0;
      else currentTurnIndex = currentTurnIndex % sessions.length;

      const activeUser = sessions.length > 0 ? sessions[currentTurnIndex].id : null;

      return new Response(
        JSON.stringify({
          activeUser,
          onlineCount: sessions.length, // accurate count
          users: sessions.map(s => s.id) // helpful for debug
        }),
        { headers }
      );
    }

    // --- PASS TURN ---
    if (url.pathname === "/pass" && req.method === "POST") {
      if (sessions.length > 0) {
        currentTurnIndex = (currentTurnIndex + 1) % sessions.length;
      }
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response("Not Found", { status: 404 });
  },
});
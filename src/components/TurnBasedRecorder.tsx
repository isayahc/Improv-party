"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Mic, Square, User, Radio, Activity } from "lucide-react"

// TODO: Replace with your Railway URL
const API_URL = "http://localhost:3000"

export function TurnBasedRecorder() {
  // Generate a random ID once per session
  const [myId] = useState(() => "User-" + Math.floor(Math.random() * 1000))
  
  const [activeUser, setActiveUser] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  
  // --- POLLING LOOP (The Heartbeat) ---
  useEffect(() => {
    const poll = async () => {
      try {
        // We send OUR ID every time we ask for status
        const res = await fetch(`${API_URL}/status?id=${myId}`)
        const data = await res.json()
        
        setActiveUser(data.activeUser)
        setOnlineCount(data.onlineCount)
      } catch (e) {
        console.error("Server offline?", e)
      }
    }

    // Run immediately, then every 1s
    poll()
    const interval = setInterval(poll, 1000)
    return () => clearInterval(interval)
  }, [myId])

  const isMyTurn = activeUser === myId

  // ... (Rest of your recording logic stays the same) ...

  const handlePass = async () => {
    setIsRecording(false)
    await fetch(`${API_URL}/pass`, { method: "POST" })
  }

  return (
    <div className="p-6 border rounded-xl max-w-sm mx-auto space-y-6">
      
      {/* STATUS HEADER */}
      <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
        <div className="flex items-center gap-2">
           <Activity className="w-3 h-3 text-green-500" />
           <span>ID: {myId}</span>
        </div>
        <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          {onlineCount} Online
        </div>
      </div>

      {/* TURN INDICATOR */}
      <div className="text-center py-4">
        {isMyTurn ? (
           <h2 className="text-2xl font-bold text-green-600 animate-pulse">YOUR TURN</h2>
        ) : (
           <div className="opacity-50">
             <h2 className="text-xl font-bold">WAITING...</h2>
             <p className="text-xs">Current Speaker: {activeUser || "Nobody"}</p>
           </div>
        )}
      </div>

      {/* BUTTON */}
      <button
        disabled={!isMyTurn}
        onClick={isRecording ? handlePass : () => setIsRecording(true)}
        className={`w-full h-16 rounded-xl font-bold transition-all ${
          isMyTurn 
            ? isRecording ? "bg-red-500 text-white" : "bg-black text-white" 
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
      >
        {isRecording ? "STOP & PASS" : "START RECORDING"}
      </button>

    </div>
  )
}
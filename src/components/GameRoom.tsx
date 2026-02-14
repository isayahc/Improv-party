"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Mic, Square, Play, Users, Bot, Loader2 } from "lucide-react"

// ⚠️ Update to your Backend URL
const API_URL = process.env.BUN_PUBLIC_API_URL || "http://localhost:3000"

export function GameRoom() {
  const [myId] = useState(() => "Player-" + Math.floor(Math.random() * 1000))
  
  // Game State
  const [gameState, setGameState] = useState<"LOBBY" | "PLAYING">("LOBBY")
  const [activeUser, setActiveUser] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [storyText, setStoryText] = useState("Waiting for game to start...")
  
  // Local State
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false) // Transcribing + AI Generating
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // --- POLLING LOOP ---
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/status?id=${myId}`)
        const data = await res.json()
        
        setGameState(data.gameState)
        setActiveUser(data.activeUser)
        setOnlineCount(data.onlineCount)
        setStoryText(data.latestAiMessage)
      } catch (e) {
        console.error("Polling error", e)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [myId])

  // --- ACTIONS ---
  const startGame = async () => {
    setIsProcessing(true) // Show loading while AI generates intro
    await fetch(`${API_URL}/start`, { method: "POST" })
    setIsProcessing(false)
  }

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.start()
    setIsRecording(true)
  }

  const stopAndSubmit = async () => {
    if (!mediaRecorderRef.current) return
    
    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    setIsRecording(false)
    setIsProcessing(true)

    // Wait for buffer
    setTimeout(async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" })
      const formData = new FormData()
      formData.append("file", blob, "turn.webm")

      // Submit to Server (Transcribe + AI Response)
      await fetch(`${API_URL}/turn`, { method: "POST", body: formData })
      
      setIsProcessing(false)
    }, 500)
  }

  const isMyTurn = activeUser === myId

  // --- RENDER ---
  return (
    <div className="max-w-md mx-auto p-4 space-y-6 font-sans">
      
      {/* HEADER */}
      <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-widest">
        <span>ID: {myId}</span>
        <div className="flex items-center gap-1 text-emerald-600">
          <Users className="w-3 h-3" />
          {onlineCount} ONLINE
        </div>
      </div>

      {/* GAME DISPLAY */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl min-h-[300px] flex flex-col">
        
        {/* AI AVATAR */}
        <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm">GAME MASTER</h3>
            <p className="text-[10px] text-slate-400">AI Dungeon Master</p>
          </div>
        </div>

        {/* STORY TEXT */}
        <div className="flex-1 space-y-4">
          {gameState === "LOBBY" ? (
            <div className="text-center py-10 space-y-4">
              <p className="text-slate-400">Waiting for players to join...</p>
              <button 
                onClick={startGame}
                disabled={isProcessing}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-full font-bold transition-all flex items-center gap-2 mx-auto"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                START GAME
              </button>
            </div>
          ) : (
            <p className="text-lg leading-relaxed font-serif text-indigo-50 animate-in fade-in duration-700">
              "{storyText}"
            </p>
          )}
        </div>

        {/* CONTROLS (Only visible if playing) */}
        {gameState === "PLAYING" && (
          <div className="mt-8 pt-6 border-t border-slate-800">
            {isProcessing ? (
               <div className="text-center text-slate-500 text-sm animate-pulse">
                 AI is thinking...
               </div>
            ) : isMyTurn ? (
              <button
                onClick={isRecording ? stopAndSubmit : startRecording}
                className={`w-full h-14 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  isRecording 
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
                    : "bg-white text-black hover:bg-gray-200"
                }`}
              >
                {isRecording ? <Square className="w-4 h-4 fill-current"/> : <Mic className="w-4 h-4"/>}
                {isRecording ? "FINISH TURN" : "YOUR TURN - SPEAK"}
              </button>
            ) : (
              <div className="text-center p-3 bg-slate-800/50 rounded-xl text-slate-500 text-sm border border-slate-800">
                Waiting for {activeUser}...
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
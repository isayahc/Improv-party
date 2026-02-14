"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, Square, Play, Users, Bot, Loader2, Volume2 } from "lucide-react"

// ⚠️ Update your URL
const API_URL = process.env.BUN_PUBLIC_API_URL || "http://localhost:3000"

export function GameRoom() {
  const [myId] = useState(() => "Player-" + Math.floor(Math.random() * 1000))
  
  // State
  const [gameState, setGameState] = useState<"LOBBY" | "PLAYING">("LOBBY")
  const [activeUser, setActiveUser] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [storyText, setStoryText] = useState("Waiting for game to start...")
  
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false) // <--- NEW

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  
  // Track previous text to trigger audio
  const prevStoryRef = useRef(storyText)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // --- AUDIO PLAYER ---
  const playLatestAudio = () => {
    // Add timestamp to prevent browser caching the old audio
    const audioUrl = `${API_URL}/audio?t=${Date.now()}`
    
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio
    setIsPlayingAudio(true)
    
    audio.play().catch(e => console.error("Auto-play blocked:", e))
    
    audio.onended = () => setIsPlayingAudio(false)
  }

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

        // DETECT NEW STORY -> PLAY AUDIO
        if (data.latestAiMessage !== prevStoryRef.current && data.gameState === "PLAYING") {
          console.log("New story detected, playing audio...")
          prevStoryRef.current = data.latestAiMessage
          playLatestAudio()
        }

      } catch (e) {
        console.error("Polling error", e)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [myId])

  // --- ACTIONS ---
  const startGame = async () => {
    setIsProcessing(true)
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

    setTimeout(async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" })
      const formData = new FormData()
      formData.append("file", blob, "turn.webm")

      await fetch(`${API_URL}/turn`, { method: "POST", body: formData })
      
      setIsProcessing(false)
    }, 500)
  }

  const isMyTurn = activeUser === myId

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
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl min-h-[400px] flex flex-col relative overflow-hidden">
        
        {/* Active Speaker Indicator */}
        {isPlayingAudio && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse" />
        )}

        {/* AI AVATAR */}
        <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isPlayingAudio ? "bg-indigo-400 scale-110 shadow-indigo-500/50" : "bg-indigo-600"}`}>
            {isPlayingAudio ? <Volume2 className="w-5 h-5 text-white animate-pulse" /> : <Bot className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">GAME MASTER</h3>
            <p className="text-[10px] text-slate-400">AI Dungeon Master</p>
          </div>
          {/* Manual Replay Button */}
          {gameState === "PLAYING" && (
            <button onClick={playLatestAudio} className="text-xs text-slate-500 hover:text-white underline">
              Replay Audio
            </button>
          )}
        </div>

        {/* STORY TEXT */}
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin scrollbar-thumb-slate-700">
          {gameState === "LOBBY" ? (
            <div className="text-center py-10 space-y-4">
              <p className="text-slate-400">Waiting for players to join...</p>
              <button 
                onClick={startGame}
                disabled={isProcessing}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-full font-bold transition-all flex items-center gap-2 mx-auto shadow-lg shadow-emerald-900/20"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                START GAME
              </button>
            </div>
          ) : (
            <p className="text-lg leading-relaxed font-serif text-indigo-50 animate-in fade-in slide-in-from-bottom-2 duration-700">
              "{storyText}"
            </p>
          )}
        </div>

        {/* CONTROLS */}
        {gameState === "PLAYING" && (
          <div className="mt-8 pt-6 border-t border-slate-800">
            {isProcessing ? (
               <div className="flex items-center justify-center gap-2 text-slate-500 text-sm animate-pulse">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 <span>AI is thinking & generating voice...</span>
               </div>
            ) : isMyTurn ? (
              <button
                onClick={isRecording ? stopAndSubmit : startRecording}
                className={`w-full h-16 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isRecording 
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-900/30" 
                    : "bg-white text-black hover:bg-gray-200 shadow-white/10"
                }`}
              >
                {isRecording ? <Square className="w-5 h-5 fill-current"/> : <Mic className="w-5 h-5"/>}
                {isRecording ? "FINISH TURN" : "YOUR TURN - SPEAK"}
              </button>
            ) : (
              <div className="text-center p-4 bg-slate-800/50 rounded-xl text-slate-400 text-sm border border-slate-800">
                Waiting for <span className="text-white font-bold">{activeUser}</span>...
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Mic, Square, Loader2, FileText, Activity, AlertCircle } from "lucide-react"

// ⚠️ Ensure this points to your Railway Backend URL (https://...)
const API_URL = process.env.BUN_PUBLIC_API_URL || "http://localhost:3000"

export function TurnBasedRecorder() {
  // --- STATE ---
  const [myId] = useState(() => "User-" + Math.floor(Math.random() * 1000))
  const [activeUser, setActiveUser] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  // --- REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // --- 1. POLLING (HEARTBEAT) ---
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/status?id=${myId}`)
      if (!res.ok) throw new Error("Server Offline")
      const data = await res.json()
      
      setActiveUser(data.activeUser)
      setOnlineCount(data.onlineCount)
      setError(null)
    } catch (e: any) {
      console.error(e)
      setError("Connecting to server...")
    }
  }, [myId])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 1000)
    return () => clearInterval(interval)
  }, [checkStatus])

  // --- 2. RECORDING ---
  const startRecording = useCallback(async () => {
    if (activeUser !== myId) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = [] // Reset buffer

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start()
      setIsRecording(true)
      setTranscript("") // Clear previous text
    } catch (err) {
      console.error("Mic Error:", err)
      setError("Microphone access denied")
    }
  }, [activeUser, myId])

  // --- 3. STOP & TRANSCRIBE ---
  const stopAndTranscribe = useCallback(async () => {
    if (!mediaRecorderRef.current) return

    // A. Stop Recording
    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    setIsRecording(false)

    // B. Wait 500ms to ensure all chunks are captured
    setTimeout(async () => {
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" })
      
      if (audioBlob.size === 0) {
        setError("Recording was empty.")
        return
      }

      // C. Send to Backend
      setIsTranscribing(true)
      try {
        const formData = new FormData()
        formData.append("file", audioBlob, "voice_note.webm")

        const res = await fetch(`${API_URL}/transcribe`, {
          method: "POST",
          body: formData,
        })
        
        const data = await res.json()
        
        if (data.text) {
          setTranscript(data.text)
        } else {
          setTranscript("No speech detected.")
        }

        // D. Pass Turn (Only after successful upload)
        await fetch(`${API_URL}/pass`, { method: "POST" })
        
      } catch (err) {
        console.error("Transcription failed", err)
        setError("Transcription failed. Check server logs.")
      } finally {
        setIsTranscribing(false)
      }
    }, 500)
  }, [])

  const isMyTurn = activeUser === myId

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4 font-sans">
      
      {/* STATUS HEADER */}
      <div className="flex justify-between items-center text-xs font-medium text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${error ? "bg-red-500" : "bg-emerald-500"}`} />
          <span>{error || "System Online"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span>{onlineCount} Users</span>
        </div>
      </div>

      {/* MAIN CARD */}
      <div className="border rounded-2xl bg-white shadow-sm overflow-hidden transition-all duration-300">
        
        {/* Turn Indicator */}
        <div className={`p-6 text-center transition-colors duration-500 ${isMyTurn ? "bg-emerald-50/50" : "bg-white"}`}>
          {isTranscribing ? (
             <div className="flex flex-col items-center gap-2 text-emerald-600">
               <Loader2 className="w-8 h-8 animate-spin" />
               <span className="text-sm font-bold tracking-wide">PROCESSING AUDIO...</span>
             </div>
          ) : isMyTurn ? (
             <h2 className="text-2xl font-black text-emerald-600 tracking-tight animate-pulse">IT'S YOUR TURN</h2>
          ) : (
             <div className="opacity-40">
               <h2 className="text-xl font-bold text-gray-800">WAITING...</h2>
               <p className="text-xs text-gray-500 mt-1">Current Speaker: {activeUser || "Nobody"}</p>
             </div>
          )}
        </div>

        {/* Action Area */}
        <div className="p-4 bg-white border-t border-gray-100">
          <button
            onClick={isRecording ? stopAndTranscribe : startRecording}
            disabled={!isMyTurn || isTranscribing}
            className={`
              w-full h-16 rounded-xl font-bold text-sm tracking-widest transition-all duration-200 flex items-center justify-center gap-2 shadow-lg
              ${isTranscribing 
                ? "bg-gray-100 text-gray-400 cursor-wait shadow-none" 
                : isRecording 
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-red-200 scale-[1.02]" 
                  : isMyTurn 
                    ? "bg-black hover:bg-gray-900 text-white shadow-gray-200 hover:scale-[1.02]" 
                    : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
              }
            `}
          >
            {isTranscribing ? (
              "GENERATING TEXT..."
            ) : isRecording ? (
              <>
                <Square className="w-4 h-4 fill-current animate-pulse" />
                STOP & SEND
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                START RECORDING
              </>
            )}
          </button>
        </div>
      </div>

      {/* TRANSCRIPT DISPLAY */}
      <div className={`transition-all duration-500 ${transcript || isTranscribing ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 rounded-l-xl" />
          <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <FileText className="w-3 h-3" />
            Live Transcription
          </div>
          <p className="text-sm text-slate-700 leading-relaxed font-medium">
            {isTranscribing ? (
              <span className="animate-pulse text-slate-400">Listening to the matrix...</span>
            ) : (
              transcript
            )}
          </p>
        </div>
      </div>

    </div>
  )
}
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Mic, Square, Activity, RefreshCw, Radio } from "lucide-react"

// ⚠️ KEEP YOUR WORKING URL
const API_URL = process.env.BUN_PUBLIC_API_URL || "http://localhost:3000"

export function TurnBasedRecorder() {
  const [myId] = useState(() => "User-" + Math.floor(Math.random() * 1000))
  const [activeUser, setActiveUser] = useState<string | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  
  // --- NEW: Stores the hex data for visualization ---
  const [byteString, setByteString] = useState<string>("") 
  
  const [connectionStatus, setConnectionStatus] = useState<"ok" | "error" | "init">("init")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // --- POLLING LOOP (Keep this, it works) ---
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/status?id=${myId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      
      setActiveUser(data.activeUser)
      setOnlineCount(data.onlineCount)
      setConnectionStatus("ok")
    } catch (e: any) {
      console.error(e)
      setConnectionStatus("error")
    }
  }, [myId])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 1000)
    return () => clearInterval(interval)
  }, [checkStatus])

  // --- RECORDING LOGIC ---
  const startRecording = useCallback(async () => {
    if (activeUser !== myId) return // Enforce turn (safety lock)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      // 1. Listen for audio chunks
      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          // A. Convert Blob -> Byte Array
          const buffer = await e.data.arrayBuffer()
          const byteArray = new Uint8Array(buffer)

          // B. Convert to Hex String (for display)
          const hex = Array.from(byteArray)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

          // C. Show it on screen
          setByteString(hex)
          
          // (Optional) Print to Console to prove it's real
          console.log(`[Mic Data] ${byteArray.length} bytes:`, hex.substring(0, 50) + "...")
        }
      }

      // 2. Start slicing audio every 250ms so numbers update fast
      recorder.start(250) 
      setIsRecording(true)
    } catch (err) {
      console.error("Mic Error:", err)
    }
  }, [activeUser, myId])

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    }
    setIsRecording(false)
    setByteString("") // Clear the display

    // Pass the turn
    try {
      await fetch(`${API_URL}/pass`, { method: "POST" })
    } catch (e) { console.error("Pass failed", e) }
  }, [])

  const isMyTurn = activeUser === myId

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-6">
      
      {/* 1. STATUS CARD */}
      <div className="border rounded-xl bg-white shadow-sm p-6 space-y-6">
        <div className="flex justify-between items-center text-xs font-mono text-gray-500">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{connectionStatus === 'ok' ? 'Server Connected' : 'Connecting...'}</span>
          </div>
          <div className="bg-gray-100 px-2 py-1 rounded">
            {onlineCount} Online
          </div>
        </div>

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

        <button
          disabled={!isMyTurn}
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-full h-16 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
            isMyTurn 
              ? isRecording ? "bg-red-500 text-white shadow-lg shadow-red-200" : "bg-black text-white" 
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isRecording ? <Square className="w-5 h-5 fill-current"/> : <Mic className="w-5 h-5"/>}
          {isRecording ? "STOP RECORDING" : "START RECORDING"}
        </button>
      </div>

      {/* 2. LIVE DATA VISUALIZER */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between mb-3 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
          <span className="flex items-center gap-2">
            <Radio className={`w-3 h-3 ${isRecording ? "text-red-500 animate-pulse" : "text-slate-600"}`} />
            Live Byte Stream
          </span>
          <span>Hex Output</span>
        </div>
        
        <div className="font-mono text-[10px] leading-relaxed break-all h-32 overflow-y-auto text-emerald-400/90 bg-slate-950/50 p-2 rounded border border-slate-800">
          {isRecording ? (
            byteString || <span className="animate-pulse opacity-50">Listening for audio...</span>
          ) : (
            <span className="text-slate-600 italic">Microphone is idle. Press Record to see data.</span>
          )}
        </div>
      </div>
      
    </div>
  )
}
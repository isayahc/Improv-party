"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Mic, Square, User, Lock, Radio, ArrowRight, Activity } from "lucide-react"

// --- TYPES ---
type UserProfile = {
  id: string
  name: string
  color: string
}

// --- CONFIGURATION ---
const MOCK_USERS: UserProfile[] = [
  { id: "u1", name: "Isayah (You)", color: "bg-blue-500" },
  { id: "u2", name: "Guest User 1", color: "bg-emerald-500" },
  { id: "u3", name: "Guest User 2", color: "bg-purple-500" },
]

// --- SUB-COMPONENT: INDIVIDUAL USER STATION ---
function VoiceStation({ 
  user, 
  isMyTurn, 
  onPassTurn 
}: { 
  user: UserProfile
  isMyTurn: boolean
  onPassTurn: () => void 
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [hexPreview, setHexPreview] = useState("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Auto-stop recording if turn is revoked externally
  useEffect(() => {
    if (!isMyTurn && isRecording) {
      stopRecording()
    }
  }, [isMyTurn])

  const startRecording = async () => {
    if (!isMyTurn) return // Guard clause

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buffer = await e.data.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          const hex = Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
          
          // LOGIC: Print Byte String for this specific user
          console.log(`[${user.name}] ${bytes.length} bytes: ${hex.substring(0, 20)}...`)
          setHexPreview(hex.substring(0, 30) + "...")
        }
      }

      recorder.start(1000) // 1s chunks
      setIsRecording(true)
    } catch (err) {
      console.error("Mic Error", err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()) // Kill light
    }
    setIsRecording(false)
    setHexPreview("") // Clear buffer view
    onPassTurn() // <-- SIGNAL TO PARENT: "I am done"
  }

  return (
    <div className={`
      relative flex flex-col p-4 rounded-xl border-2 transition-all duration-300
      ${isMyTurn 
        ? "border-primary bg-background shadow-lg scale-105 z-10" 
        : "border-border bg-muted/30 opacity-60 scale-95 grayscale"
      }
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${user.color}`}>
            {user.name.charAt(0)}
          </div>
          <span className="font-semibold text-sm">{user.name}</span>
        </div>
        
        {/* Status Badge */}
        {isMyTurn ? (
          <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            <Radio className="w-3 h-3 animate-pulse" />
            ON AIR
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            <Lock className="w-3 h-3" />
            LOCKED
          </div>
        )}
      </div>

      {/* Mic Control */}
      <div className="flex justify-center mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isMyTurn}
          className={`
            h-16 w-16 rounded-full flex items-center justify-center transition-all
            ${isMyTurn 
              ? isRecording 
                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20 shadow-xl animate-pulse" 
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
              : "bg-muted text-muted-foreground cursor-not-allowed"
            }
          `}
        >
          {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
        </button>
      </div>

      {/* Hex Debugger Area */}
      <div className="mt-auto h-12 bg-black/5 rounded border border-black/10 flex items-center px-3 font-mono text-[10px] text-muted-foreground overflow-hidden">
        {isRecording ? (
          <span className="animate-pulse text-foreground">{hexPreview || "Encoding..."}</span>
        ) : (
          <span className="italic">Waiting for audio...</span>
        )}
      </div>
    </div>
  )
}

// --- MAIN PARENT COMPONENT ---
export function VoiceRoom() {
  const [activeUserIndex, setActiveUserIndex] = useState(0)

  const handlePassTurn = () => {
    // Cycle to next user (Round Robin)
    setActiveUserIndex((prev) => (prev + 1) % MOCK_USERS.length)
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      
      {/* Room Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Debate Room (Test Mode)</h1>
        <p className="text-muted-foreground">
          Simulating {MOCK_USERS.length} users. 
          The microphone is locked to one user at a time.
        </p>
      </div>

      {/* Active User Indicator */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary rounded-full text-sm">
          <Activity className="w-4 h-4" />
          <span>Current Turn: </span>
          <span className="font-bold text-primary">
            {MOCK_USERS[activeUserIndex].name}
          </span>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_USERS.map((user, index) => (
          <VoiceStation 
            key={user.id} 
            user={user}
            isMyTurn={index === activeUserIndex}
            onPassTurn={handlePassTurn}
          />
        ))}
      </div>

      {/* Flow Explanation */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground opacity-50">
        <span>User A Records</span>
        <ArrowRight className="w-3 h-3" />
        <span>User A Stops</span>
        <ArrowRight className="w-3 h-3" />
        <span>Token passes to User B</span>
      </div>
    </div>
  )
}
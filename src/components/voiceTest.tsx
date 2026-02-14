"use client"

import { useState, useRef, useCallback } from "react"
import { Mic, Square, Activity, Radio, AlertCircle } from "lucide-react"

export function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [hexPreview, setHexPreview] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create recorder
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      // Event: Data available (fires every 'timeslice' ms)
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const buffer = await event.data.arrayBuffer()
          const byteArray = new Uint8Array(buffer)

          // Convert to Hex String for verification
          const hexString = Array.from(byteArray)
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")

          console.log(`[Chunk] ${byteArray.length} bytes:`, hexString.substring(0, 50) + "...")
          
          // Update UI preview (just the start of the string)
          setHexPreview(hexString.substring(0, 32) + "...")
        }
      }

      // Start recording, slice into 1-second chunks (1000ms)
      mediaRecorder.start(1000)
      setIsRecording(true)
    } catch (err) {
      console.error("Microphone Error:", err)
      setError("Could not access microphone.")
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    
    // Stop the actual microphone stream (turns off the red dot in browser tab)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }

    setIsRecording(false)
    setHexPreview("")
  }, [])

  return (
    <div className="w-full max-w-sm mx-auto p-4 border rounded-xl bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col items-center gap-6">
        
        {/* Header / Status */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground/30"}`} />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {isRecording ? "Live Feed" : "Standby"}
            </span>
          </div>
          {isRecording && <Radio className="h-4 w-4 text-red-500 animate-pulse" />}
        </div>

        {/* Main Action Button */}
        <div className="relative group">
          <div className={`absolute inset-0 rounded-full blur opacity-20 transition-colors duration-500 ${isRecording ? "bg-red-500" : "bg-primary"}`} />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`
              relative flex items-center justify-center h-20 w-20 rounded-full transition-all duration-300 border-4 
              ${isRecording 
                ? "bg-background border-red-500 text-red-500 hover:bg-red-50" 
                : "bg-primary border-primary text-primary-foreground hover:bg-primary/90"
              }
            `}
          >
            {isRecording ? (
              <Square className="h-8 w-8 fill-current" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
        </div>

        {/* Data Visualization Area */}
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Buffer Output</span>
          </div>
          
          <div className="relative h-24 w-full rounded-md bg-muted/50 border border-border overflow-hidden p-3 font-mono text-[10px]">
            {error ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : isRecording ? (
              <div className="space-y-1 break-all">
                <span className="text-primary font-bold">{">"}</span>
                <span className="opacity-80 ml-1">{hexPreview || "Wait..."}</span>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/50">
                Ready to capture
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
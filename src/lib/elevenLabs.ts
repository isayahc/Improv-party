// Use this example if you are unable to use the SDK
import "dotenv/config";
import * as fs from "node:fs";
// Make sure to install the "ws" library beforehand
import WebSocket from "ws";

const uri =
  "wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime";
const websocket = new WebSocket(uri, {
  headers: {
    "xi-api-key": process.env.ELEVENLABS_API_KEY,
  },
});

websocket.on("open", async () => {
  console.log("WebSocket opened");
});

// Listen to the incoming message from the websocket connection
websocket.on("message", function incoming(event) {
  const data = JSON.parse(event.toString());

  switch (data.message_type) {
    case "session_started":
      console.log("Session started", data);
      sendAudio();
      break;
    case "partial_transcript":
      console.log("Partial:", data);
      break;
    case "committed_transcript":
      console.log("Committed:", data);
      break;
    // Committed transcripts with word-level timestamps. Only received when "include_timestamps=true" is included in the query parameters
    case "committed_transcript_with_timestamps":
      console.log("Committed with timestamps:", data);
      websocket.close();
      break;
    default:
      console.log(data);
      break;
  }
});

async function sendAudio() {
  // 16 kHz, mono, 16-bit PCM, little-endian
  const pcmFilePath = "/path/to/audio.pcm";

  const chunkSize = 32000; // 1 second of 16kHz audio (16000 samples * 2 bytes per sample)

  // Read the entire file into a buffer
  const audioBuffer = fs.readFileSync(pcmFilePath);

  // Split the buffer into chunks of exactly chunkSize bytes
  const chunks: Buffer[] = [];
  for (let i = 0; i < audioBuffer.length; i += chunkSize) {
    const chunk = audioBuffer.subarray(i, i + chunkSize);
    chunks.push(chunk);
  }

  // Send each chunk via websocket payload
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkBase64 = chunk.toString("base64");

    websocket.send(
      JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: chunkBase64,
        commit: false,
        sample_rate: 16000,
      }),
    );

    // Wait 1 second between chunks to simulate real-time streaming
    // (each chunk contains 1 second of audio at 16kHz)
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Small delay before final commit to let the last chunk process
  await new Promise((resolve) => setTimeout(resolve, 500));

  // send final commit
  websocket.send(
    JSON.stringify({
      message_type: "input_audio_chunk",
      audio_base_64: "",
      commit: true,
      sample_rate: 16000,
    }),
  );
}

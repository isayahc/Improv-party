import Anthropic from "@anthropic-ai/sdk";
import type { Message, MessageParam } from "@anthropic-ai/sdk/resources/messages";

import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
import { Readable } from "stream";
// import "dotenv/config";


const anthropic = new Anthropic();
const history: MessageParam[] = [];

export async function chat(text: string): Promise<string> {
  history.push({ role: "user", content: text });

  const msg: Message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1000,
    messages: history,
  });

  const firstBlock = msg.content[0];

  if (firstBlock.type === "text") {
    history.push({ role: "assistant", content: firstBlock.text });
    console.log(firstBlock.text);
    return firstBlock.text;
  }

  return "";
}

const elevenlabs = new ElevenLabsClient();

export async function textToSpeech(
  text: string,
  voiceId: string = "JBFqnCBsd6RMkjVDRZzb",
  modelId: string = "eleven_multilingual_v2",
  outputFormat: string = "mp3_44100_128"
): Promise<void> {
  const audio = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId,
    outputFormat,
  });

  const reader = audio.getReader();
  const stream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(value);
      }
    },
  });

  await play(stream);
}

// export { textToSpeech };


// chat("What should I search for to find the latest developments in renewable energy?").catch(console.error);


textToSpeech("hello human")
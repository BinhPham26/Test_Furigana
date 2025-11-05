

import { GoogleGenAI, Type } from "@google/genai";
import { ImageSlide } from "../types";

export async function generateSlides(japaneseText: string, apiKey: string): Promise<ImageSlide[]> {
    try {
      if (!apiKey) {
        throw new Error("An API key is required to generate slides.");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: `
          You are an expert Japanese language learning assistant. Your task is to process a large block of Japanese text and prepare it for a learning application.

          Follow these instructions precisely:
          1.  Your most critical instruction is this: split the provided Japanese text into chunks where each chunk is **ALWAYS** exactly two lines long. Do not create chunks with one, three, or more lines. The only exception is the very final chunk if there is not enough text left for two full lines. This rule is paramount. Break the text at natural points like after commas or at the end of phrases to form these two-line chunks.
          2.  For each chunk, you must provide four pieces of information in a strict JSON format.
          3.  The information for each chunk is:
              a.  'japanese': The original, unmodified Japanese text for the chunk.
              b.  'japaneseWithFurigana': The Japanese text with furigana for all Kanji, formatted using HTML <ruby> tags. Example: <ruby><rb>日本語</rb><rt>にほんご</rt></ruby>.
              c.  'english': Translate the chunk into English. The translation must be natural, fluent, and idiomatic, capturing the nuance and tone of the original Japanese. Avoid literal, word-for-word translations. It should sound like something a native English speaker would say.
              d.  'vietnamese': Translate the chunk into Vietnamese. Similarly, this translation must be natural, smooth, and idiomatic. Avoid a robotic, literal translation. It should reflect how a native Vietnamese speaker would express the same idea.

          Here is the Japanese text to process:
          ---
          ${japaneseText}
          ---
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              slides: {
                type: Type.ARRAY,
                description: "An array where each object represents a content slide.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    japanese: {
                      type: Type.STRING,
                      description: "The original Japanese text chunk.",
                    },
                    japaneseWithFurigana: {
                      type: Type.STRING,
                      description: "The Japanese text with furigana in HTML ruby tag format.",
                    },
                    english: {
                      type: Type.STRING,
                      description: "The English translation of the chunk.",
                    },
                    vietnamese: {
                      type: Type.STRING,
                      description: "The Vietnamese translation of the chunk.",
                    },
                  },
                  required: ["japanese", "japaneseWithFurigana", "english", "vietnamese"],
                },
              },
            },
          },
        },
      });

      const jsonText = response.text.trim();
      const result = JSON.parse(jsonText);

      if (result && result.slides && Array.isArray(result.slides)) {
        return result.slides;
      } else {
        throw new Error("Invalid response structure from API.");
      }
    } catch (error) {
      console.error(`API call failed:`, error);
      throw new Error(`API call failed: ${(error as Error).message}`);
    }
}
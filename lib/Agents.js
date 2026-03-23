require("dotenv").config();

const { generateText, Output } = require("ai");
const { z } = require("zod");
const { createOpenAI } = require("@ai-sdk/openai");
const { createGoogleGenerativeAI } = require("@ai-sdk/google");
const { createAnthropic } = require("@ai-sdk/anthropic");

const openai = createOpenAI({
    compatibility: "strict",
    apiKey: process.env.OPENAI_API_KEY,
});
const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_API_KEY,
});
const anthropic = createAnthropic({
    apiKey: process.env.CLAUDE_API_KEY,
});

class Agents {
    // Structured output — returns a parsed object matching a Zod schema
    async generateSchema({ input }) {
        try {
            const system = `Your system prompt goes here.`;

            const prompt = `Your user prompt goes here.

Input:
<input>
${input}
</input>
`;

            const { output } = await generateText({
                model: openai("gpt-5-mini"),
                system,
                prompt,
                output: Output.object({
                    schema: z.object({
                        field: z.string().nullable().describe("Description of field"),
                    }),
                }),
            });

            return {
                success: true,
                data: output,
            };
        } catch (error) {
            console.error("Error generating schema:", error);
            return {
                success: false,
                message: error.message || "Failed to generate schema",
            };
        }
    }

    async chat({ prompt }) {
        try {
            const system = `You are a helpful AI assistant. Respond clearly and concisely.`;

            const { text } = await generateText({
                model: openai("gpt-5-mini"),
                system,
                prompt,
            });

            return {
                success: true,
                data: text.trim(),
            };
        } catch (error) {
            console.error("Error in chat:", error);
            return {
                success: false,
                message: error.message || "Failed to generate response",
            };
        }
    }

    // Plain text output — returns a raw string response
    async generatePlainText({ input }) {
        try {
            const system = `Your system prompt goes here.`;

            const prompt = `Your user prompt goes here.

    Input:
    <input>
    ${input}
    </input>
`;

            const { text } = await generateText({
                model: openai("gpt-5-mini"),
                system,
                prompt,
            });

            return {
                success: true,
                data: text.trim(),
            };
        } catch (error) {
            console.error("Error generating text:", error);
            return {
                success: false,
                message: error.message || "Failed to generate text",
            };
        }
    }
}

module.exports = new Agents();

import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { tools, systemPrompt } from "@/lib/tools.js";

export async function POST(req) {
    const { messages } = await req.json();

    const result = streamText({
        model: anthropic("claude-sonnet-4-6"),
        system: systemPrompt,
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(5),
        tools,
    });

    return result.toUIMessageStreamResponse({
        sendSources: true,
    });
}

import OpenAI from "openai";
import { ChatOpenAI } from "@langchain/openai";

export const DASHSCOPE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
export const MODEL_NAME = "qwen-flash";

/** OpenAI SDK — used for streaming final answer */
export const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || "",
  baseURL: DASHSCOPE_BASE_URL,
});

/** LangChain ChatOpenAI — used inside LangGraph nodes */
export const langModel = new ChatOpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || "",
  configuration: { baseURL: DASHSCOPE_BASE_URL },
  modelName: MODEL_NAME,
  temperature: 0,
});

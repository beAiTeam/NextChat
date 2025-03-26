export enum LotAiGuessModel {
  Gpt4O = "gpt-4o",
  Gpt4OMini = "gpt-4o-mini",
  O3Mini = "o3-mini",
}

export enum LotAiGuessType {
  Ai5_Normal = "ai_5_normal",
  Ai5_Plus = "ai_5_plus",
  Ai5_Gemini = "ai_5_gemini",
  Ai5_Gemini_Plus = "ai_5_gemini_plus"
}

export interface AiTypeConfig {
  _id: string;
  created_at: string;
  updated_at: string;
  name: string;
  type: string;
  config: {
    prompt: string;
    model: string;
  }
}

export interface AiLogItem {
  _id: string;
  created_at: string;
  updated_at: string;
  ai_type_id: string;
  ai_type: string;
  guess_period: string;
  guess_time: string;
  guess_result: string;
  status: number;
} 
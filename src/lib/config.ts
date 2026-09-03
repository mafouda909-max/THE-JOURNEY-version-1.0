/**
 * APPLICATION CONFIGURATION & AI MODEL ROUTING POLICY
 *
 * Models and provider parameters are configurable via environment variables
 * to prevent hardcoding permanent model assumptions.
 */

export interface AIModelConfig {
  fastModel: string;
  strongModel: string;
  defaultTemperature: number;
}

export const aiConfig: AIModelConfig = {
  fastModel: process.env.AI_MODEL_FAST || "openai/gpt-4o-mini",
  strongModel: process.env.AI_MODEL_STRONG || "anthropic/claude-3.5-sonnet",
  defaultTemperature: 0.1,
};

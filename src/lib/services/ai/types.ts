export interface AIToolParameterProperty {
  type: string
  description: string
  enum?: string[]
}

export interface AIToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, AIToolParameterProperty>
    required: string[]
  }
}

export interface AIToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface AIToolExecutionResult {
  toolName: string
  success: boolean
  data?: any
  error?: string
  displaySummary?: string
  actions?: Array<{
    label: string
    action: () => void
  }>
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: AIToolCall[]
  toolResults?: AIToolExecutionResult[]
}

export type AIProvider = 'built-in' | 'gemini' | 'ollama' | 'openai-compatible'

export interface AIProviderConfig {
  provider: AIProvider
  endpoint: string
  model: string
  apiKey?: string
  geminiApiKey?: string
  geminiModel?: string
}

// Type definitions for capability registry system

/**
 * Gemini function calling parameter schema
 */
export interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  enum?: string[]
  properties?: Record<string, ParameterSchema>
  items?: ParameterSchema
  required?: string[]
}

/**
 * Gemini function declaration format
 */
export interface FunctionDeclaration {
  name: string
  description: string
  parameters: ParameterSchema
}

/**
 * Capability definition
 */
export interface Capability {
  id: string
  description: string
  keywords: string[]
  functionDeclaration: FunctionDeclaration
  requiredContext?: string[] // What context fields this capability needs
  examples?: string[] // Example user prompts
}

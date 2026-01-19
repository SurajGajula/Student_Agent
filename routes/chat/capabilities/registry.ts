import type { Capability, FunctionDeclaration } from './types.js'

class CapabilityRegistry {
  private capabilities = new Map<string, Capability>()

  /**
   * Register a capability
   */
  register(capability: Capability): void {
    if (this.capabilities.has(capability.id)) {
      console.warn(`Capability ${capability.id} is already registered. Overwriting.`)
    }
    this.capabilities.set(capability.id, capability)
  }

  /**
   * Get all registered capabilities
   */
  getAllCapabilities(): Capability[] {
    return Array.from(this.capabilities.values())
  }

  /**
   * Get a capability by ID
   */
  getCapabilityById(id: string): Capability | undefined {
    return this.capabilities.get(id)
  }

  /**
   * Get all capabilities as Gemini function declarations (Vertex AI format)
   *
   * Vertex AI expects:
   * tools: [{ functionDeclarations: [ { name, description, parameters }, ... ] }]
   */
  getFunctionDeclarations(): FunctionDeclaration[] {
    return this.getAllCapabilities().map(cap => cap.functionDeclaration)
  }
}

// Singleton instance
const registry = new CapabilityRegistry()

export default registry

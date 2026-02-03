import registry from './registry.js'
import type { Capability } from './types.js'

const careerPathCapability: Capability = {
  id: 'career_path',
  description: 'Generate skill graphs for career paths based on role and company',
  keywords: ['career', 'job', 'role', 'work', 'position', 'skill', 'graph', 'path', 'career path'],
  requiredContext: [],
  examples: [
    'I want to work as a fullstack engineer at OpenAI',
    'Show me skills needed for a software engineer at Google',
    'What skills do I need for a ML engineer role at Anthropic',
    'Career path for backend developer at Stripe',
    'I want to work as a fullstack OpenAI'
  ],
  functionDeclaration: {
    name: 'generate_career_path',
    description: 'Generate a skill graph for a career path. ALWAYS extract both role and company from the user message, even if the phrasing is informal. Parse natural language to identify: (1) the job role/title, (2) the company name.',
    parameters: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: 'The complete job role or title. MUST extract the full multi-word role name. Parse patterns like: "I want to work as a [ROLE]" or "skills for [ROLE]" or "[ROLE] at". Examples: "fullstack engineer", "software engineer", "ML engineer", "backend developer", "frontend developer", "data scientist". CRITICAL: For "fullstack engineer", extract "fullstack engineer" not just "engineer".'
        },
        company: {
          type: 'string',
          description: 'The company or organization name. MUST extract the company name from phrases like "at [COMPANY]", "for [COMPANY]", or "[COMPANY]". Examples: "OpenAI", "Google", "Anthropic", "Stripe", "Microsoft", "Apple", "Meta", "Amazon". CRITICAL: For "at OpenAI", extract "OpenAI" (not "at OpenAI").'
        },
        seniority: {
          type: 'string',
          description: 'The seniority level ONLY if explicitly mentioned (e.g., "entry", "mid", "senior", "staff", "principal"). If not mentioned, omit this parameter entirely.'
        },
        major: {
          type: 'string',
          description: 'The major or discipline ONLY if explicitly mentioned (e.g., "CS", "Engineering", "Math"). If not mentioned, omit this parameter entirely.'
        }
      },
      required: ['role', 'company']
    }
  }
}

registry.register(careerPathCapability)

export default careerPathCapability

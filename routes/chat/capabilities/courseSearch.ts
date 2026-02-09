import registry from './registry.js'
import type { Capability } from './types.js'

const courseSearchCapability: Capability = {
  id: 'course_search',
  description: 'Search for relevant courses based on career interests or academic requirements',
  keywords: ['course', 'courses', 'class', 'classes', 'curriculum', 'program', 'major', 'department'],
  examples: [
    'recommend Stanford CS courses',
    'courses for AI career',
    'Berkeley Computer Science courses'
  ],
  functionDeclaration: {
    name: 'search_courses',
    description: 'Search for relevant courses based on career interests or academic requirements. Extract school and department only if explicitly mentioned in the user message.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The user\'s query about courses (e.g., "courses for AI career", "CS courses for machine learning")'
        },
        school: {
          type: 'string',
          description: 'The university name (ONLY if explicitly mentioned in the message, otherwise omit)'
        },
        department: {
          type: 'string',
          description: 'The department or major (ONLY if explicitly mentioned in the message, otherwise omit)'
        }
      },
      required: ['query']
    }
  }
}

registry.register(courseSearchCapability)

export default courseSearchCapability

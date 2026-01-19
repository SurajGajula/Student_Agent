import registry from './registry.js'
import type { Capability } from './types.js'

const testCapability: Capability = {
  id: 'test',
  description: 'Generate a test/quiz from notes (requires a note mention like @[note name])',
  keywords: ['test', 'quiz', 'exam', 'questions', 'assessment'],
  examples: [
    'turn @[note] into a test',
    'make a quiz from @[note]',
    'generate practice questions for @[note]'
  ],
  functionDeclaration: {
    name: 'generate_test',
    description: 'Generate a test or quiz from a note. Requires a note mention in the user message.',
    parameters: {
      type: 'object',
      properties: {
        noteId: {
          type: 'string',
          description: 'The ID of the note to generate a test from'
        },
        noteName: {
          type: 'string',
          description: 'The name of the note'
        },
        noteContent: {
          type: 'string',
          description: 'The content of the note to generate questions from'
        }
      },
      required: ['noteId', 'noteName', 'noteContent']
    }
  },
  requiredContext: ['mentions']
}

registry.register(testCapability)

export default testCapability

import registry from './registry.js'
import type { Capability } from './types.js'

const flashcardCapability: Capability = {
  id: 'flashcard',
  description: 'Generate flashcards from notes (requires a note mention like @[note name])',
  keywords: ['flashcard', 'flash card', 'study cards', 'memorization', 'review cards'],
  examples: [
    'create flashcards from @[note]',
    'make study cards for @[note]',
    'flashcards for @[note]'
  ],
  functionDeclaration: {
    name: 'generate_flashcard',
    description: 'Generate flashcards from a note. Requires a note mention in the user message.',
    parameters: {
      type: 'object',
      properties: {
        noteId: {
          type: 'string',
          description: 'The ID of the note to generate flashcards from'
        },
        noteName: {
          type: 'string',
          description: 'The name of the note'
        },
        noteContent: {
          type: 'string',
          description: 'The content of the note to generate flashcards from'
        }
      },
      required: ['noteId', 'noteName', 'noteContent']
    }
  },
  requiredContext: ['mentions']
}

registry.register(flashcardCapability)

export default flashcardCapability

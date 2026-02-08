import registry from './registry.js'
import type { Capability } from './types.js'

const flashcardCapability: Capability = {
  id: 'flashcard',
  description: 'Generate flashcards from notes. User can mention a note with @[note name], or use phrases like "turn note into flashcards", "make flashcards from {note}", etc. If user is on notes page, use the selected note.',
  keywords: ['flashcard', 'flash card', 'study cards', 'memorization', 'review cards', 'turn', 'make', 'create', 'generate'],
  examples: [
    'create flashcards from @[note]',
    'make study cards for @[note]',
    'flashcards for @[note]',
    'turn note into flashcards',
    'make flashcards from the note',
    'generate flash cards'
  ],
  functionDeclaration: {
    name: 'generate_flashcard',
    description: 'Generate flashcards from a note. Call this function when the user wants to create flashcards, study cards, or memorization cards from a note. The user may mention a note with @[note name] format, or use phrases like "turn note into flashcards", "make flashcards", etc. If the user is on the notes page, they likely want to generate flashcards from the currently selected note.',
    parameters: {
      type: 'object',
      properties: {
        noteId: {
          type: 'string',
          description: 'The ID of the note to generate flashcards from. If a note is mentioned with @[note name], extract the noteId from the mention. Otherwise, leave empty and the system will use context.'
        },
        noteName: {
          type: 'string',
          description: 'The name of the note. If a note is mentioned, extract the name. Otherwise, leave empty.'
        },
        noteContent: {
          type: 'string',
          description: 'The content of the note. If a note is mentioned, you may not have access to the content, so leave empty. The system will fetch it.'
        }
      },
      required: []
    }
  },
  requiredContext: []
}

registry.register(flashcardCapability)

export default flashcardCapability

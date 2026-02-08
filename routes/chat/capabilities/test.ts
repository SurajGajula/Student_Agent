import registry from './registry.js'
import type { Capability } from './types.js'

const testCapability: Capability = {
  id: 'test',
  description: 'Generate a test/quiz from notes. The user can mention a note using @[note name] format, or the system can infer the note from context (e.g., "turn note into test", "make a quiz from {note}").',
  keywords: ['test', 'quiz', 'exam', 'questions', 'assessment', 'turn', 'make', 'generate', 'create'],
  examples: [
    'turn @[note] into a test',
    'make a quiz from @[note]',
    'generate practice questions for @[note]',
    'turn note into test',
    'create a test from the note',
    'make quiz questions'
  ],
  functionDeclaration: {
    name: 'generate_test',
    description: 'Call this function when the user wants to create a test, quiz, exam, or practice questions from a note. Examples: "turn @[note] into a test", "make a quiz from @[note]", "turn note into test", "create test questions", "generate quiz". If the message contains words like "test", "quiz", "exam", "questions" combined with "turn", "make", "create", "generate" and mentions a note (with @[note] or references a note), ALWAYS call this function.',
    parameters: {
      type: 'object',
      properties: {
        noteId: {
          type: 'string',
          description: 'The ID of the note to generate a test from. If a note is mentioned with @[note name] format, extract the noteId from the mention. Otherwise, leave empty.'
        },
        noteName: {
          type: 'string',
          description: 'The name of the note. If a note is mentioned with @[note name] format, extract the name from the mention. Otherwise, leave empty.'
        },
        noteContent: {
          type: 'string',
          description: 'The content of the note. If a note is mentioned with @[note name] format, you may not have access to the content, so leave empty. The system will fetch it.'
        }
      },
      required: []
    }
  },
  requiredContext: []
}

registry.register(testCapability)

export default testCapability

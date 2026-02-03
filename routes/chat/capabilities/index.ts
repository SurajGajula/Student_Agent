// Import all capabilities so they register themselves with the registry.
// This avoids circular imports inside registry.ts itself.

import registry from './registry.js'

import './test.js'
import './flashcard.js'
import './courseSearch.js'
import './careerPath.js'

export default registry


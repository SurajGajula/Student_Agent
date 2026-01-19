import { fetchUserProfile } from './userProfile.js'
import { fetchDatabaseContext } from './database.js'
import type { ChatContext, PageContext } from './types.js'

/**
 * Build comprehensive chat context from multiple sources
 */
export async function buildContext(
  userId: string,
  pageContext?: PageContext,
  mentions?: Array<{ noteId: string; noteName: string }>,
  userEmail?: string | null,
  username?: string
): Promise<ChatContext> {
  // Fetch user profile (plan, usage, metadata)
  const user = await fetchUserProfile(userId, userEmail, username)

  // Fetch relevant database data based on page context
  const database = await fetchDatabaseContext(userId, pageContext)

  return {
    user,
    page: pageContext,
    database,
    mentions
  }
}

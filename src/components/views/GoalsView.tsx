import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Platform, FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useGoalsStore, type Goal, type CourseRecommendation } from '../../stores/goalsStore'
import { useAuthStore } from '../../stores/authStore'
import { BackIcon, DeleteIcon } from '../icons'
import MobileBackButton from '../MobileBackButton'
import { useDetailMode } from '../../contexts/DetailModeContext'
import BetaModal from '../modals/BetaModal'
import { getStorage } from '../../lib/storage'

interface GoalsViewProps {
  onOpenLoginModal?: () => void
  onOpenUpgradeModal?: () => void
}

function GoalsView({ onOpenLoginModal, onOpenUpgradeModal }: GoalsViewProps = {}) {
  const [currentGoalId, setCurrentGoalId] = useState<string | null>(null)
  const { goals, removeGoal, getGoalById, syncFromSupabase } = useGoalsStore()
  const { isLoggedIn } = useAuthStore()
  const currentGoal = currentGoalId ? getGoalById(currentGoalId) : null
  const { setIsInDetailMode } = useDetailMode()
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const numColumns = windowWidth > 768 ? 4 : windowWidth > 480 ? 3 : 2
  const insets = useSafeAreaInsets()
  const isMobile = windowWidth <= 768
  const [showBetaModal, setShowBetaModal] = useState(false)

  // Update window width on resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width)
    })
    return () => subscription?.remove()
  }, [])

  // Sync goals on mount
  useEffect(() => {
    if (isLoggedIn) {
      syncFromSupabase()
    }
  }, [isLoggedIn, syncFromSupabase])

  // Reset local state when logged out
  useEffect(() => {
    if (!isLoggedIn) {
      setCurrentGoalId(null)
    }
  }, [isLoggedIn])

  // Note: fetchUsage is already called by syncAllStores in initializeAuth,
  // so we don't need to call it here to avoid duplicates
  // The usage store will be populated when the app initializes

  // Check if beta modal should be shown on mount
  useEffect(() => {
    const checkBetaModal = async () => {
      const storage = getStorage()
      if (!storage) {
        // If no storage available, show modal by default
        setShowBetaModal(true)
        return
      }

      try {
        let dismissed = false
        if (Platform.OS === 'web') {
          // Web: localStorage is synchronous
          const result = storage.getItem('goals-beta-modal-dismissed')
          dismissed = result === 'true'
        } else {
          // Native: AsyncStorage is asynchronous
          const result = await storage.getItem('goals-beta-modal-dismissed')
          dismissed = result === 'true'
        }

        if (!dismissed) {
          setShowBetaModal(true)
        }
      } catch (error) {
        console.error('Failed to check beta modal dismissal status:', error)
        // Show modal if we can't check (better to show than not show)
        setShowBetaModal(true)
      }
    }

    checkBetaModal()
  }, [])

  const handleGoalClick = (goalId: string) => {
    setCurrentGoalId(goalId)
  }

  const handleBackClick = () => {
    setCurrentGoalId(null)
  }

  const handleDeleteGoal = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return

    try {
      await removeGoal(goalId)
      if (currentGoalId === goalId) {
        setCurrentGoalId(null)
      }
    } catch (error) {
      console.error('Failed to delete goal:', error)
    }
  }

  // Update detail mode when entering/exiting goal detail
  useEffect(() => {
    setIsInDetailMode(!!(currentGoalId && currentGoal))
    return () => setIsInDetailMode(false)
  }, [currentGoalId, currentGoal, setIsInDetailMode])

  // Render goal detail view with courses
  if (currentGoalId && currentGoal) {
    return (
      <View style={styles.container}>
        {isMobile && <MobileBackButton onPress={handleBackClick} />}
        <View style={[
          styles.header,
          isMobile && {
            paddingTop: Math.max(insets.top + 8 + 8, 28),
            paddingLeft: 80,
            paddingRight: 20,
          }
        ]}>
          <View style={[styles.headerTitle, isMobile && {
            flex: 0,
            maxWidth: '100%',
          }]}>
            {!isMobile && (
              <Pressable style={styles.backButton} onPress={handleBackClick}>
                <BackIcon />
              </Pressable>
            )}
            <View style={styles.headerTitleContent}>
              <Text style={[styles.headerTitleText, isMobile && styles.headerTitleTextMobile]}>
                {currentGoal.name}
              </Text>
            <Text style={styles.headerSubtitle}>
                {currentGoal.department 
                  ? `${currentGoal.school} ${currentGoal.department} • ${currentGoal.courses.length} courses`
                  : `${currentGoal.school} • ${currentGoal.courses.length} courses`}
            </Text>
            </View>
          </View>
        </View>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.coursesContainer}>
            {currentGoal.courses.map((rec: CourseRecommendation, index: number) => (
              <View key={index} style={styles.courseCard}>
                <View style={styles.courseHeader}>
                  <View style={styles.courseNumberContainer}>
                    <Text style={styles.courseNumber}>{rec.course.course_number}</Text>
                    <Text style={styles.relevanceScore}>{rec.relevanceScore}% match</Text>
                  </View>
                </View>
                <Text style={styles.courseName}>{rec.course.name}</Text>
                <View style={styles.reasoningContainer}>
                  <Text style={styles.reasoningLabel}>Why this course:</Text>
                  <Text style={styles.reasoning}>{rec.reasoning}</Text>
                </View>
                <View style={styles.courseDetails}>
                  {rec.course.credits && (
                    <Text style={styles.detailText}>{rec.course.credits} credits</Text>
                  )}
                  {rec.course.prerequisites && rec.course.prerequisites.length > 0 && (
                    <Text style={styles.detailText}>
                      Prereqs: {rec.course.prerequisites.join(', ')}
                    </Text>
                  )}
                  {rec.course.semesters && rec.course.semesters.length > 0 && (
                    <Text style={styles.detailText}>
                      Offered: {rec.course.semesters.join(', ')}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    )
  }

  // Render goals grid
  return (
    <View style={styles.container}>
      <BetaModal isOpen={showBetaModal} onClose={() => setShowBetaModal(false)} />
      <View style={[
        styles.header,
        isMobile && {
          paddingTop: Math.max(insets.top + 8 + 8, 28),
          paddingLeft: 80,
          paddingRight: 20,
          paddingBottom: 64, // Match height of other views that have button rows (20px marginTop + 44px button height)
          flexDirection: 'column',
          alignItems: 'flex-start',
        }
      ]}>
        <View style={[styles.headerTitle, isMobile && { 
          flex: 0,
          maxWidth: '100%',
        }]}>
          <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1}>Goals</Text>
        </View>
      </View>

      {goals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No goals yet. Ask in the chat to find courses for your career goals!
          </Text>
        </View>
      ) : (
        <FlatList
          key={`goals-grid-${numColumns}`}
          data={goals}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          renderItem={({ item: goal }) => (
            <Pressable
              style={styles.goalCard}
              onPress={() => handleGoalClick(goal.id)}
            >
              <Pressable
                style={styles.cardDeleteButton}
                    onPress={(e) => {
                      e.stopPropagation()
                  handleDeleteGoal(goal.id)
                    }}
                  >
                    <DeleteIcon />
                  </Pressable>
              <Text style={styles.goalCardTitle} numberOfLines={2}>
                {goal.name}
              </Text>
              <Text style={styles.goalCardMeta}>
                {goal.department 
                  ? `${goal.school} ${goal.department}`
                  : goal.school}
                </Text>
              <Text style={styles.goalCardMeta}>
                {goal.courses.length} {goal.courses.length === 1 ? 'course' : 'courses'}
                </Text>
              </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  titleMobile: {
    fontSize: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
  },
  title: {
      fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    color: '#0f0f0f',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  grid: {
    padding: 10,
    gap: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '300',
    textAlign: 'center',
  },
  goalCard: {
    backgroundColor: '#e8e8e8',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    minHeight: 180,
    gap: 12,
    flex: 1,
    margin: 5,
    maxWidth: (Dimensions.get('window').width - 60) / 2,
    position: 'relative',
    ...(Platform.OS === 'web' && {
      height: 160,
      maxWidth: 320,
      minWidth: 320,
      flex: 0,
      width: 320,
    }),
  },
  cardDeleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },
  goalCardTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  goalCardMeta: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
    marginTop: 4,
  },
  // Detail view styles
  headerTitleContent: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    color: '#0f0f0f',
  },
  headerTitleTextMobile: {
    fontSize: 24,
  },
  headerSubtitle: {
    color: '#666',
    fontSize: 14,
    fontWeight: '300',
    marginTop: 4,
  },
  coursesContainer: {
    gap: 20,
  },
  courseCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 20,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }),
  },
  courseHeader: {
    marginBottom: 12,
  },
  courseNumberContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseNumber: {
    color: '#0f0f0f',
    fontSize: 20,
    fontWeight: '600',
  },
  relevanceScore: {
    backgroundColor: '#0f0f0f',
    color: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  courseName: {
    color: '#0f0f0f',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 12,
  },
  courseDescription: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  reasoningContainer: {
    backgroundColor: '#f8f8f8',
    borderLeftWidth: 3,
    borderLeftColor: '#0f0f0f',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  reasoningLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  reasoning: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  courseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailText: {
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f0f0f',
    textAlign: 'center',
  },
  lockedMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 500,
  },
  lockedSubmessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 500,
    marginTop: 8,
  },
  upgradeButton: {
    backgroundColor: '#0f0f0f',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 12,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
})

export default GoalsView


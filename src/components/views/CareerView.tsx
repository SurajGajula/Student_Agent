import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, FlatList, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../stores/authStore'
import { useCareerStore, type CareerPath } from '../../stores/careerStore'
import { DeleteIcon, CareerIcon, BackIcon } from '../icons'
import MobileBackButton from '../MobileBackButton'
import { useDetailMode } from '../../contexts/DetailModeContext'
import CareerGraph from '../CareerGraph'

interface CareerViewProps {
  onNavigate?: (view: string, noteId?: string) => void
}

import SkillDetailView from './SkillDetailView'
import type { SkillNode } from '../../stores/careerStore'

function CareerView({ onNavigate }: CareerViewProps = {}) {
  const [currentPathId, setCurrentPathId] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillNode | null>(null)
  const { careerPaths, removeCareerPath, getCareerPathById, syncFromSupabase } = useCareerStore()
  const { isLoggedIn } = useAuthStore()
  const currentPath = currentPathId ? getCareerPathById(currentPathId) : null
  const { setIsInDetailMode } = useDetailMode()
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const numColumns = windowWidth > 768 ? 4 : windowWidth > 480 ? 3 : 2
  const insets = useSafeAreaInsets()
  const isMobile = windowWidth <= 768

  const handleNavigateToNote = (noteId: string) => {
    if (onNavigate) {
      onNavigate('notes', noteId)
    } else if (Platform.OS === 'web') {
      window.location.pathname = '/notes'
      // Use a small delay to ensure view is mounted, then trigger note selection
      setTimeout(() => {
        window.location.hash = `note-${noteId}`
      }, 100)
    }
  }

  // Update window width on resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width)
    })
    return () => subscription?.remove()
  }, [])

  // Sync career paths on mount
  useEffect(() => {
    if (isLoggedIn) {
      syncFromSupabase()
    }
  }, [isLoggedIn, syncFromSupabase])

  // Reset local state when logged out
  useEffect(() => {
    if (!isLoggedIn) {
      setCurrentPathId(null)
    }
  }, [isLoggedIn])

  const handlePathClick = (pathId: string) => {
    setCurrentPathId(pathId)
  }

  const handleBackClick = () => {
    if (selectedSkill) {
      setSelectedSkill(null)
    } else {
      setCurrentPathId(null)
    }
  }

  const handleSkillClick = (skill: SkillNode) => {
    setSelectedSkill(skill)
  }

  const handleDeletePath = async (pathId: string) => {
    const path = careerPaths.find(p => p.id === pathId)
    if (!path) return

    try {
      await removeCareerPath(pathId)
      if (currentPathId === pathId) {
        setCurrentPathId(null)
      }
    } catch (error) {
      console.error('Failed to delete career path:', error)
    }
  }

  // Update detail mode when entering/exiting path detail
  useEffect(() => {
    setIsInDetailMode(!!(currentPathId && currentPath))
    return () => setIsInDetailMode(false)
  }, [currentPathId, currentPath, setIsInDetailMode])

  // Button center calculation: button is at top (insets.top + 8 on iOS, 50 on web), height is 40px (8px padding + 24px icon + 8px padding)
  // Button center = (insets.top + 8) + 20 = insets.top + 28 on iOS, or 50 + 20 = 70 on web
  // Title is 32px tall, so half-height is 16px
  // For iOS: paddingTop = (insets.top + 28) - 16 = insets.top + 12
  // For web: paddingTop = 70 - 16 = 54
  const mobilePaddingTop = Platform.OS === 'ios' 
    ? Math.max(insets.top + 12, 20) 
    : Math.max(54, 20)

  // Render skill detail view
  if (selectedSkill && currentPath) {
    return (
      <SkillDetailView
        skill={selectedSkill}
        careerPathId={currentPath.id}
        onBack={handleBackClick}
        onNavigateToNote={handleNavigateToNote}
      />
    )
  }

  // Render career path detail view
  if (currentPathId && currentPath) {
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
                {currentPath.role}
              </Text>
              <Text style={styles.headerSubtitle}>
                {currentPath.company} • {currentPath.nodes.length} skills
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.graphContainer}>
          <CareerGraph 
            nodes={currentPath.nodes}
            careerPathId={currentPath.id}
            onSkillClick={handleSkillClick}
            onNavigateToNote={handleNavigateToNote}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[
        styles.header,
        isMobile && {
          paddingTop: mobilePaddingTop,
          paddingLeft: 80,
          paddingRight: 20,
        }
      ]}>
        <Text style={[
          styles.title,
          isMobile && styles.titleMobile
        ]}>Career</Text>
      </View>

      {!isLoggedIn ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Please log in to view your career paths.
          </Text>
        </View>
      ) : careerPaths.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No career paths yet. Use the chat to generate a career path. For example:
          </Text>
          <Text style={styles.exampleText}>
            "I want to work as a fullstack engineer at OpenAI"
          </Text>
        </View>
      ) : (
        <FlatList
          key={`career-grid-${numColumns}`}
          data={careerPaths}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          renderItem={({ item: path }) => (
            <Pressable
              style={styles.pathCard}
              onPress={() => handlePathClick(path.id)}
            >
              <Pressable
                style={styles.cardDeleteButton}
                onPress={(e) => {
                  e.stopPropagation()
                  handleDeletePath(path.id)
                }}
              >
                <DeleteIcon />
              </Pressable>
              <CareerIcon />
              <Text style={styles.pathCardTitle} numberOfLines={2}>
                {path.role}
              </Text>
              <Text style={styles.pathCardMeta}>
                {path.company}
              </Text>
              <Text style={styles.pathCardMeta}>
                {path.nodes.length} {path.nodes.length === 1 ? 'skill' : 'skills'}
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
    padding: 20,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    color: '#0f0f0f',
  },
  titleMobile: {
    paddingLeft: 64, // Position title to the right of sidebar button (16px button left + 40px button width + 8px gap = 64px)
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  backButton: {
    padding: 8,
  },
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
    fontSize: 16,
    fontWeight: '300',
    color: '#666',
    marginTop: 4,
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
    marginBottom: 16,
  },
  exampleText: {
    fontSize: 14,
    color: '#4A90E2',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  pathCard: {
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
  pathCardTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#0f0f0f',
    marginTop: 8,
  },
  pathCardMeta: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
  },
  graphContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  statsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 20,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '300',
    color: '#0f0f0f',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#0f0f0f',
    marginBottom: 16,
  },
  skillNode: {
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skillName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f0f0f',
    flex: 1,
  },
  skillMeta: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  skillMetaText: {
    fontSize: 12,
    color: '#999',
  },
})

export default CareerView

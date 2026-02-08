import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, Pressable, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getApiBaseUrl } from '../../lib/platform'
import { useAuthStore } from '../../stores/authStore'
import { BackIcon } from '../icons'
import MobileBackButton from '../MobileBackButton'
import type { SkillNode, CourseRecommendation } from '../../stores/careerStore'

interface SkillDetailViewProps {
  skill: SkillNode
  careerPathId: string
  onBack: () => void
  onNavigateToNote?: (noteId: string) => void
}

interface Note {
  id: string
  name: string
  content: string
  skillIds: string[]
  createdAt: string
  updatedAt: string
}

function SkillDetailView({ skill, careerPathId, onBack, onNavigateToNote }: SkillDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'courses'>('notes')
  const [scannedNotes, setScannedNotes] = useState<{ notes: Note[]; isLoading: boolean } | null>(null)
  const [scannedCourses, setScannedCourses] = useState<{ courses: CourseRecommendation[]; isLoading: boolean } | null>(null)
  const { session } = useAuthStore()
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const insets = useSafeAreaInsets()
  const isMobile = windowWidth <= 768

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width)
    })
    return () => subscription?.remove()
  }, [])

  const handleScanNotes = async (fullScan: boolean = false) => {
    if (!session) return

    setScannedNotes({ notes: [], isLoading: true })

    try {
      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/notes/scan/${skill.skill_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          skillName: skill.name,
          fullScan: fullScan // true for full scan with auto-tagging, false for just tagged notes
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to scan notes')
      }

      const data = await response.json()
      console.log('[SkillDetailView] Notes scan response:', data)
      setScannedNotes({ notes: data.notes || [], isLoading: false })
    } catch (error) {
      console.error('Error scanning notes:', error)
      setScannedNotes({ notes: [], isLoading: false })
    }
  }

  const handleScanCourses = async (forceRescan: boolean = false) => {
    if (!session) return

    setScannedCourses({ courses: [], isLoading: true })

    try {
      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/career/scan-courses/${skill.skill_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          skillName: skill.name,
          careerPathId,
          forceRescan
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || 'Failed to scan courses')
      }

      const data = await response.json()
      console.log('[SkillDetailView] Courses scan response:', data)
      setScannedCourses({ courses: data.courses || [], isLoading: false })
    } catch (error) {
      console.error('Error scanning courses:', error)
      setScannedCourses({ courses: [], isLoading: false })
    }
  }

  // Auto-load cached notes when component mounts
  useEffect(() => {
    if (session) {
      handleScanNotes(false) // Load tagged/cached notes by default
    }
  }, [session, skill.skill_id])

  // Auto-load cached courses when switching to courses tab
  useEffect(() => {
    if (activeTab === 'courses' && !scannedCourses && session) {
      handleScanCourses()
    }
  }, [activeTab, session])

  const mobilePaddingTop = Platform.OS === 'ios' 
    ? Math.max(insets.top + 12, 20) 
    : Math.max(54, 20)

  return (
    <View style={styles.container}>
      {isMobile && <MobileBackButton onPress={onBack} />}
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
            <Pressable style={styles.backButton} onPress={onBack}>
              <BackIcon />
            </Pressable>
          )}
          <View style={styles.headerTitleContent}>
            <Text style={[styles.headerTitleText, isMobile && styles.headerTitleTextMobile]}>
              {skill.name}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'notes' && styles.tabActive]}
          onPress={() => setActiveTab('notes')}
        >
          <Text style={[styles.tabText, activeTab === 'notes' && styles.tabTextActive]}>
            Notes
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'courses' && styles.tabActive]}
          onPress={() => setActiveTab('courses')}
        >
          <Text style={[styles.tabText, activeTab === 'courses' && styles.tabTextActive]}>
            Courses
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'notes' && (
          <>
            {!scannedNotes || scannedNotes.isLoading ? (
              <View style={[styles.emptyState, (isMobile || Platform.OS === 'web') && styles.emptyStateMobile]}>
                <ActivityIndicator size="large" color="#0f0f0f" />
                <Text style={styles.emptyStateText}>Loading notes...</Text>
              </View>
            ) : (
              <ScrollView style={styles.list} contentContainerStyle={(isMobile || Platform.OS === 'web') && styles.listContentMobile}>
                {scannedNotes.notes.length === 0 ? (
                  <View style={[styles.emptyState, (isMobile || Platform.OS === 'web') && styles.emptyStateMobile]}>
                    <Text style={styles.emptyStateText}>No tagged notes found for this skill</Text>
                    <Pressable
                      style={styles.scanButton}
                      onPress={() => handleScanNotes(true)}
                    >
                      <Text style={styles.scanButtonText}>Scan & Auto-tag Notes</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.listHeader}>
                      <Text style={styles.count}>
                        {scannedNotes.notes.length} note{scannedNotes.notes.length !== 1 ? 's' : ''} found
                      </Text>
                      <Pressable
                        style={styles.rescanButton}
                        onPress={() => handleScanNotes(true)}
                      >
                        <Text style={styles.rescanButtonText}>Scan for more</Text>
                      </Pressable>
                    </View>
                    {scannedNotes.notes.map(note => (
                      <Pressable
                        key={note.id}
                        style={styles.item}
                        onPress={() => {
                          if (onNavigateToNote) {
                            onNavigateToNote(note.id)
                          }
                        }}
                      >
                        <Text style={styles.itemName}>{note.name}</Text>
                      </Pressable>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </>
        )}

        {activeTab === 'courses' && (
          <>
            {!scannedCourses || scannedCourses.isLoading ? (
              <View style={[styles.emptyState, (isMobile || Platform.OS === 'web') && styles.emptyStateMobile]}>
                <ActivityIndicator size="large" color="#0f0f0f" />
                <Text style={styles.emptyStateText}>Loading courses...</Text>
              </View>
            ) : (
              <ScrollView style={styles.list} contentContainerStyle={(isMobile || Platform.OS === 'web') && styles.listContentMobile}>
                {scannedCourses.courses.length === 0 ? (
                  <View style={[styles.emptyState, (isMobile || Platform.OS === 'web') && styles.emptyStateMobile]}>
                    <Text style={styles.emptyStateText}>No courses found for this skill</Text>
                    <Pressable
                      style={styles.scanButton}
                      onPress={() => handleScanCourses(true)}
                    >
                      <Text style={styles.scanButtonText}>Scan Courses</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.listHeader}>
                      <Text style={styles.count}>
                        {scannedCourses.courses.length} course{scannedCourses.courses.length !== 1 ? 's' : ''} found
                      </Text>
                      <Pressable
                        style={styles.rescanButton}
                        onPress={() => handleScanCourses(true)}
                      >
                        <Text style={styles.rescanButtonText}>Rescan</Text>
                      </Pressable>
                    </View>
                    {scannedCourses.courses.map((courseRec, index) => (
                      <View key={index} style={styles.courseItem}>
                        <Text style={styles.courseName}>
                          {courseRec.course.course_number}: {courseRec.course.name}
                        </Text>
                        {courseRec.reasoning && (
                          <Text style={styles.courseReasoning}>{courseRec.reasoning}</Text>
                        )}
                        {courseRec.course.credits && (
                          <Text style={styles.courseMeta}>{courseRec.course.credits} credits</Text>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitleContent: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  headerTitleTextMobile: {
    fontSize: 20,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0f0f0f',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
  },
  tabTextActive: {
    color: '#0f0f0f',
    fontWeight: '400',
  },
  content: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  list: {
    flex: 1,
    padding: 20,
  },
  listContentMobile: {
    paddingBottom: 120, // Account for ChatBar on mobile and web
  },
  count: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
    marginBottom: 12,
  },
  item: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  courseItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  courseName: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0f0f0f',
    marginBottom: 4,
  },
  courseReasoning: {
    fontSize: 12,
    fontWeight: '300',
    color: '#666',
    marginBottom: 4,
  },
  courseMeta: {
    fontSize: 12,
    fontWeight: '300',
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateMobile: {
    paddingBottom: 120, // Account for ChatBar on mobile and web
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  scanButton: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    minWidth: 150,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#ffffff',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rescanButton: {
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rescanButtonText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#0f0f0f',
  },
})

export default SkillDetailView

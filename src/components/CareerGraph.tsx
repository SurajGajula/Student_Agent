import { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, Pressable, Modal } from 'react-native'
import type { SkillNode } from '../stores/careerStore'
import { getApiBaseUrl } from '../lib/platform'
import { useAuthStore } from '../stores/authStore'

interface CareerGraphProps {
  nodes: SkillNode[]
  onNavigateToNote?: (noteId: string) => void
}

export default function CareerGraph({ nodes, onNavigateToNote }: CareerGraphProps) {
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [scannedNotes, setScannedNotes] = useState<{ skillId: string; notes: any[]; isLoading: boolean } | null>(null)
  const { session } = useAuthStore()

  // Update window width on resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width)
    })
    return () => subscription?.remove()
  }, [])

  // Calculate number of columns based on screen width
  const numColumns = windowWidth > 1200 ? 6 : windowWidth > 768 ? 4 : windowWidth > 480 ? 3 : 2
  const cardWidth = (windowWidth - 40 - (numColumns - 1) * 12) / numColumns // 40px padding, 12px gap

  // Scan notes for selected skill
  const handleScanNotes = async (skillId: string, skillName: string) => {
    if (!session) return

    setScannedNotes({ skillId, notes: [], isLoading: true })

    try {
      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/notes/scan/${skillId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ skillName })
      })

      if (!response.ok) {
        throw new Error('Failed to scan notes')
      }

      const data = await response.json()
      setScannedNotes({ skillId, notes: data.notes || [], isLoading: false })
    } catch (error) {
      console.error('Error scanning notes:', error)
      setScannedNotes({ skillId, notes: [], isLoading: false })
    }
  }

  const handleSkillClick = (skillId: string) => {
    // If clicking the same skill that's already scanned, keep the scanned notes
    if (selectedSkillId === skillId && scannedNotes && scannedNotes.skillId === skillId) {
      // Already showing this skill with scanned notes, no need to reset
      return
    }
    // If clicking a different skill, reset scanned notes
    if (selectedSkillId !== skillId) {
      setScannedNotes(null)
    }
    setSelectedSkillId(skillId)
  }

  if (nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No skills to display</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.grid}>
          {nodes.map((node) => (
            <Pressable
              key={node.skill_id}
              style={[styles.skillCard, { width: cardWidth }]}
              onPress={() => handleSkillClick(node.skill_id)}
            >
              <Text style={styles.skillName} numberOfLines={2}>
                {node.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Skill Notes Modal */}
      <Modal
        visible={selectedSkillId !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setSelectedSkillId(null)
          setScannedNotes(null)
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setSelectedSkillId(null)
            setScannedNotes(null)
          }}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {(() => {
              const skillNode = nodes.find(n => n.skill_id === selectedSkillId)
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {skillNode?.name || 'Unknown Skill'}
                    </Text>
                    <Pressable
                      style={styles.modalCloseButton}
                      onPress={() => {
                        setSelectedSkillId(null)
                        setScannedNotes(null)
                      }}
                    >
                      <Text style={styles.modalCloseText}>×</Text>
                    </Pressable>
                  </View>
                  
                  {!scannedNotes ? (
                    <View style={styles.modalBody}>
                      <Text style={styles.modalDescription}>
                        Find notes related to this skill
                      </Text>
                      <Pressable
                        style={styles.scanButton}
                        onPress={() => {
                          if (selectedSkillId && skillNode) {
                            handleScanNotes(selectedSkillId, skillNode.name)
                          }
                        }}
                      >
                        <Text style={styles.scanButtonText}>Scan Notes</Text>
                      </Pressable>
                    </View>
                  ) : scannedNotes.isLoading ? (
                    <View style={styles.modalBody}>
                      <Text style={styles.modalLoadingText}>Scanning notes...</Text>
                    </View>
                  ) : (
                    <View style={styles.modalBody}>
                      <Text style={styles.modalCount}>
                        {scannedNotes.notes.length} note{scannedNotes.notes.length !== 1 ? 's' : ''} found
                      </Text>
                      <ScrollView style={styles.modalNotesList}>
                        {scannedNotes.notes.length === 0 ? (
                          <Text style={styles.modalEmptyText}>No notes found for this skill</Text>
                        ) : (
                          scannedNotes.notes.map(note => (
                            <Pressable
                              key={note.id}
                              style={styles.modalNoteItem}
                              onPress={() => {
                                setSelectedSkillId(null)
                                setScannedNotes(null)
                                if (onNavigateToNote) {
                                  onNavigateToNote(note.id)
                                }
                              }}
                            >
                              <Text style={styles.modalNoteName}>{note.name}</Text>
                            </Pressable>
                          ))
                        )}
                      </ScrollView>
                    </View>
                  )}
                </>
              )
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#000000',
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  skillName: {
    fontSize: 14,
    fontWeight: '300',
    color: '#000000',
    textAlign: 'center',
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '300',
    color: '#0f0f0f',
    flex: 1,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  modalCloseText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
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
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#ffffff',
  },
  modalLoadingText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  modalCount: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
    marginBottom: 12,
  },
  modalNotesList: {
    maxHeight: 400,
  },
  modalEmptyText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  modalNoteItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalNoteName: {
    fontSize: 14,
    fontWeight: '300',
    color: '#0f0f0f',
  },
})

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, Dimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CreateFolderModal from '../modals/CreateFolderModal'
import { useTestsStore, type Test } from '../../stores/testsStore'
import { useFolderStore, type Folder } from '../../stores/folderStore'
import { BackIcon, FolderIcon, DeleteIcon, TestsIcon, EyeIcon, EyeOffIcon } from '../icons'
import { showConfirm } from '../../lib/platformHelpers'
import MobileBackButton from '../MobileBackButton'
import { useDetailMode } from '../../contexts/DetailModeContext'

function TestsView() {
  const [currentTestId, setCurrentTestId] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [userResponses, setUserResponses] = useState<Record<string, string>>({})
  const { tests, removeTest, getTestById } = useTestsStore()
  const { getFoldersByType, addFolder, removeFolder } = useFolderStore()
  const currentTest = currentTestId ? getTestById(currentTestId) : null
  const { setIsInDetailMode } = useDetailMode()
  
  const folders = getFoldersByType('test')
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null
  const displayedTests = currentFolderId 
    ? tests.filter(t => t.folderId === currentFolderId)
    : tests.filter(t => !t.folderId)
  const displayedFolders = currentFolderId ? [] : folders
  const windowWidth = Dimensions.get('window').width
  const numColumns = windowWidth > 768 ? 4 : windowWidth > 480 ? 3 : 2
  const insets = useSafeAreaInsets()
  const isMobile = windowWidth <= 768

  const handleTestClick = (testId: string) => {
    setCurrentTestId(testId)
  }

  const handleBackClick = () => {
    if (currentTestId) {
      setCurrentTestId(null)
      setShowAnswers(false)
      setUserResponses({})
    } else {
      setCurrentFolderId(null)
    }
  }

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId)
  }

  const handleCreateFolder = () => {
    setIsFolderModalOpen(true)
  }

  const handleCloseFolderModal = () => {
    setIsFolderModalOpen(false)
  }

  const handleSubmitFolder = async (folderName: string) => {
    try {
      await addFolder(folderName, 'test')
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleResponseChange = (questionId: string, response: string) => {
    setUserResponses(prev => ({
      ...prev,
      [questionId]: response
    }))
  }

  const toggleAnswers = () => {
    setShowAnswers(prev => !prev)
  }

  const handleDeleteTest = async (testId: string) => {
    const confirmed = await showConfirm('Delete Test', 'Are you sure you want to delete this test?')
    if (confirmed) {
      removeTest(testId)
      if (currentTestId === testId) {
        setCurrentTestId(null)
      }
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return

    const confirmed = await showConfirm(
      'Delete Folder',
      `Are you sure you want to delete "${folder.name}"? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      await removeFolder(folderId, 'test')
      // If we're inside the deleted folder, navigate back
      if (currentFolderId === folderId) {
        setCurrentFolderId(null)
      }
    } catch (error) {
      console.error('Failed to delete folder:', error)
    }
  }

  // Update detail mode when entering/exiting test detail
  useEffect(() => {
    setIsInDetailMode(!!(currentTestId && currentTest))
    return () => setIsInDetailMode(false)
  }, [currentTestId, currentTest, setIsInDetailMode])

  // Render test detail view with questions
  if (currentTestId && currentTest) {
    return (
      <View style={styles.container}>
        {isMobile && <MobileBackButton onPress={handleBackClick} />}
        <View style={[
          styles.header,
          isMobile && {
            paddingTop: Math.max(insets.top + 8 + 8, 28), // Center with back button (same as sidebar button)
            paddingLeft: 80, // Account for back button + extra space (16px left + 8px padding + 24px icon + 8px padding + 24px gap = 80px)
            paddingRight: 20,
          }
        ]}>
          <View style={[styles.headerTitle, isMobile && {
            flex: 0,
            maxWidth: '100%',
          }]}>
            <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1} ellipsizeMode="tail">{currentTest.name}</Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable 
              style={[styles.toggleButton, showAnswers && styles.toggleButtonActive]}
              onPress={toggleAnswers}
            >
              {showAnswers ? (
                <>
                  <EyeIcon />
                  <Text style={styles.toggleButtonText}>
                    {isMobile ? 'Hide' : 'Show Practice Mode'}
                  </Text>
                </>
              ) : (
                <>
                  <EyeOffIcon />
                  <Text style={styles.toggleButtonText}>
                    {isMobile ? 'Show' : 'Show Answers'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.testInfo}>
            <Text style={styles.testSource}>Based on note: {currentTest.noteName}</Text>
            <Text style={styles.testCount}>{currentTest.questions.length} questions</Text>
          </View>
          <View style={styles.questionsContainer}>
            {currentTest.questions.map((question, index) => {
              const userResponse = userResponses[question.id] || ''
              const isCorrect = question.correctAnswer && 
                (question.type === 'multiple-choice' 
                  ? userResponse === question.correctAnswer
                  : userResponse.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase())
              
              return (
                <View key={question.id} style={styles.questionCard}>
                  <View style={styles.questionHeader}>
                    <Text style={styles.questionNumber}>Question {index + 1}</Text>
                    <Text style={styles.questionType}>
                      {question.type === 'multiple-choice' ? 'Multiple Choice' : 'Short Answer'}
                    </Text>
                  </View>
                  <Text style={styles.questionText}>{question.question}</Text>
                  
                  {question.type === 'multiple-choice' && question.options && (
                    <View style={styles.optionsContainer}>
                      {question.options.map((option, optIndex) => {
                        const isSelected = userResponse === option
                        const isCorrectOption = showAnswers && question.correctAnswer === option
                        const isWrongSelection = showAnswers && isSelected && question.correctAnswer !== option
                        
                        return (
                          <Pressable
                            key={optIndex}
                            style={[
                              styles.option,
                              isSelected && styles.optionSelected,
                              isCorrectOption && styles.optionCorrect,
                              isWrongSelection && styles.optionIncorrect,
                              !showAnswers && styles.optionClickable,
                            ]}
                            onPress={() => !showAnswers && handleResponseChange(question.id, option)}
                            disabled={showAnswers}
                          >
                            <Text style={styles.optionLabel}>{String.fromCharCode(65 + optIndex)}.</Text>
                            <Text style={styles.optionText}>{option}</Text>
                            {isSelected && !showAnswers && (
                              <Text style={styles.selectedIndicator}>✓ Selected</Text>
                            )}
                            {showAnswers && isCorrectOption && (
                              <Text style={styles.correctIndicator}>✓ Correct</Text>
                            )}
                            {showAnswers && isWrongSelection && (
                              <Text style={styles.incorrectIndicator}>✗ Incorrect</Text>
                            )}
                          </Pressable>
                        )
                      })}
                    </View>
                  )}
                  
                  {question.type === 'short-answer' && (
                    <>
                      {!showAnswers ? (
                        <View style={styles.inputContainer}>
                          <TextInput
                            style={styles.shortAnswerInput}
                            placeholder="Type your answer here..."
                            value={userResponse}
                            onChangeText={(text) => handleResponseChange(question.id, text)}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        </View>
                      ) : (
                        <View style={styles.answerComparison}>
                          <View style={[
                            styles.answerSection,
                            userResponse && (isCorrect ? styles.answerSectionCorrect : styles.answerSectionIncorrect)
                          ]}>
                            <Text style={styles.answerSectionTitle}>
                              Your Answer:
                              {userResponse && (
                                <Text style={isCorrect ? styles.correctStatus : styles.incorrectStatus}>
                                  {isCorrect ? ' ✓ Correct' : ' ✗ Incorrect'}
                                </Text>
                              )}
                            </Text>
                            <Text style={styles.answerText}>{userResponse || '(No answer provided)'}</Text>
                          </View>
                          <View style={[styles.answerSection, styles.answerSectionCorrect]}>
                            <Text style={styles.answerSectionTitle}>Correct Answer:</Text>
                            <Text style={styles.answerText}>{question.correctAnswer}</Text>
                          </View>
                        </View>
                      )}
                    </>
                  )}
                </View>
              )
            })}
          </View>
        </ScrollView>
      </View>
    )
  }

  // Render tests grid/list view
  type GridItem = (Folder & { itemType: 'folder' }) | (Test & { itemType: 'test' })
  const gridData: GridItem[] = [
    ...displayedFolders.map(f => ({ ...f, itemType: 'folder' as const })),
    ...displayedTests.map(t => ({ ...t, itemType: 'test' as const })),
  ]

  return (
    <View style={styles.container}>
      <View style={[
        styles.header,
        isMobile && {
          paddingTop: Math.max(insets.top + 8 + 8, 28), // Center with menu button (button center is at insets.top + 8 + 20, minus half title height ~12px)
          paddingLeft: 80, // Account for menu button + extra space (16px left + 8px padding + 24px icon + 8px padding + 24px gap = 80px)
          paddingRight: 20,
          flexDirection: 'column',
          alignItems: 'flex-start',
        }
      ]}>
        <View style={[styles.headerTitle, isMobile && { 
          flex: 0, // Don't take flex space on mobile
          maxWidth: '100%', // Prevent overflow
        }]}>
          {currentFolder ? (
            <>
              <Pressable style={styles.backButton} onPress={handleBackClick}>
                <BackIcon />
              </Pressable>
              <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1} ellipsizeMode="tail">{currentFolder.name}</Text>
            </>
          ) : (
            <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1}>Tests</Text>
          )}
        </View>
        <View style={[
          styles.headerButtons, 
          isMobile && [
            styles.headerButtonsMobile,
            { width: windowWidth } // Use actual screen width dynamically
          ]
        ]}>
          <Pressable style={[styles.createFolderButton, isMobile && styles.buttonMobile]} onPress={handleCreateFolder}>
            <View style={isMobile && styles.iconWrapperMobile}>
            <FolderIcon />
            </View>
            <Text style={[styles.createFolderButtonText, isMobile && styles.buttonTextMobile]}>Create Folder</Text>
          </Pressable>
        </View>
      </View>

      {gridData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No tests yet. Use @ to mention a note in chat and ask to "turn notes into a test" to create one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={gridData}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            if (item.itemType === 'folder') {
              const folder = item as Folder & { itemType: 'folder' }
              return (
                <Pressable style={styles.folderCard} onPress={() => handleFolderClick(folder.id)}>
                  <Pressable 
                    style={styles.cardDeleteButton}
                    onPress={async (e) => {
                      e.stopPropagation()
                      await handleDeleteFolder(folder.id)
                    }}
                  >
                    <DeleteIcon />
                  </Pressable>
                  <FolderIcon />
                  <Text style={styles.folderCardTitle}>{folder.name}</Text>
                </Pressable>
              )
            } else {
              const test = item as Test & { itemType: 'test' }
              return (
                <Pressable style={styles.testCard} onPress={() => handleTestClick(test.id)}>
                  <Pressable 
                    style={styles.cardDeleteButton}
                    onPress={(e) => {
                      e.stopPropagation()
                      handleDeleteTest(test.id)
                    }}
                  >
                    <DeleteIcon />
                  </Pressable>
                  <View style={styles.testCardIcon}>
                    <TestsIcon />
                  </View>
                  <Text style={styles.testCardTitle}>{test.name}</Text>
                  <Text style={styles.testCardMeta}>
                    {test.questions.length} questions • From: {test.noteName}
                  </Text>
                </Pressable>
              )
            }
          }}
        />
      )}

      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={handleCloseFolderModal}
        onSubmit={handleSubmitFolder}
      />
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
  headerButtonsMobile: {
    marginTop: 20, // More space from the title/sidebar button
    flexDirection: 'row',
    marginLeft: -80, // Offset the header's paddingLeft (80px) to align with sidebar button
    paddingLeft: 16, // Start from same position as sidebar button (left: 16)
    paddingRight: 16, // Right padding to match left
    gap: 6, // Gap between buttons
  },
  buttonMobile: {
    paddingVertical: 8,
    paddingLeft: 0, // Remove left padding, handled by icon wrapper
    paddingRight: 12, // Right padding to fill width
    minWidth: 0,
    minHeight: 44, // Uniform height for all buttons
    maxHeight: 44, // Prevent buttons from getting taller
    flex: 1,
    flexBasis: 0, // Ensure equal distribution
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8, // Gap between icon and text
    overflow: 'hidden', // Prevent content overflow
  },
  iconWrapperMobile: {
    marginLeft: 16, // Space to the left of the icon
  },
  buttonTextMobile: {
    fontSize: 13,
    flexShrink: 1, // Allow text to shrink if needed
    marginRight: 8, // Space to the right of the text to fill button width
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
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: 'transparent',
  },
  toggleButtonActive: {
    backgroundColor: '#e8e8e8',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  createFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: 'transparent',
  },
  createFolderButtonText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  testInfo: {
    marginBottom: 20,
    gap: 8,
  },
  testSource: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
  },
  testCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
  },
  questionsContainer: {
    gap: 20,
  },
  questionCard: {
    backgroundColor: '#e8e8e8',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    gap: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '400',
    color: '#0f0f0f',
  },
  questionType: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '300',
    color: '#0f0f0f',
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#ffffff',
  },
  optionClickable: {
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  optionSelected: {
    borderColor: '#0f0f0f',
    backgroundColor: '#f0f0f0',
  },
  optionCorrect: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  optionIncorrect: {
    borderColor: '#c62828',
    backgroundColor: '#ffebee',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#0f0f0f',
    minWidth: 24,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  selectedIndicator: {
    fontSize: 14,
    color: '#0f0f0f',
    fontWeight: '400',
  },
  correctIndicator: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '400',
  },
  incorrectIndicator: {
    fontSize: 14,
    color: '#c62828',
    fontWeight: '400',
  },
  inputContainer: {
    marginTop: 8,
  },
  shortAnswerInput: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f0f0f',
    backgroundColor: '#ffffff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  answerComparison: {
    gap: 16,
    marginTop: 8,
  },
  answerSection: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  answerSectionCorrect: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  answerSectionIncorrect: {
    borderColor: '#c62828',
    backgroundColor: '#ffebee',
  },
  answerSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f0f0f',
  },
  answerText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  correctStatus: {
    color: '#2e7d32',
  },
  incorrectStatus: {
    color: '#c62828',
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
  folderCard: {
    backgroundColor: '#e8e8e8',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    margin: 5,
    maxWidth: (Dimensions.get('window').width - 60) / 2,
    ...(Platform.OS === 'web' && {
      height: 160,
      maxWidth: 320,
      minWidth: 320,
      flex: 0,
      width: 320,
    }),
  },
  folderCardTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  testCard: {
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
  testCardIcon: {
    marginBottom: 8,
  },
  testCardTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  testCardMeta: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
    marginTop: 4,
  },
})

export default TestsView

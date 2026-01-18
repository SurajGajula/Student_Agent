import { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, Dimensions, Platform, PanResponder } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CreateFolderModal from '../modals/CreateFolderModal'
import { useTestsStore, type Test } from '../../stores/testsStore'
import { useFolderStore, type Folder } from '../../stores/folderStore'
import { useAuthStore } from '../../stores/authStore'
import { useNotesStore } from '../../stores/notesStore'
import { getApiBaseUrl } from '../../lib/platform'
import { BackIcon, FolderIcon, DeleteIcon, TestsIcon } from '../icons'
import MobileBackButton from '../MobileBackButton'
import { useDetailMode } from '../../contexts/DetailModeContext'

interface TestsViewProps {
  onOpenLoginModal?: () => void
}

function TestsView({ onOpenLoginModal }: TestsViewProps = {}) {
  const [currentTestId, setCurrentTestId] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userResponses, setUserResponses] = useState<Record<string, string>>({})
  const [gradedQuestions, setGradedQuestions] = useState<Record<string, boolean>>({})
  const [showResults, setShowResults] = useState(false)
  const { tests, removeTest, getTestById, addTest } = useTestsStore()
  const { getFoldersByType, addFolder, removeFolder } = useFolderStore()
  const { isLoggedIn } = useAuthStore()
  const { notes } = useNotesStore()
  const [isGeneratingTest, setIsGeneratingTest] = useState(false)
  const currentTest = currentTestId ? getTestById(currentTestId) : null
  const { setIsInDetailMode } = useDetailMode()
  
  const folders = getFoldersByType('test')
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null
  const displayedTests = currentFolderId 
    ? tests.filter(t => t.folderId === currentFolderId)
    : tests.filter(t => !t.folderId)
  const displayedFolders = currentFolderId ? [] : folders
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const numColumns = windowWidth > 768 ? 4 : windowWidth > 480 ? 3 : 2
  const insets = useSafeAreaInsets()
  const isMobile = windowWidth <= 768

  // Update window width on resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width)
    })
    return () => subscription?.remove()
  }, [])

  // Reset local state when logged out
  useEffect(() => {
    if (!isLoggedIn) {
      setCurrentTestId(null)
      setCurrentFolderId(null)
      setCurrentQuestionIndex(0)
      setUserResponses({})
      setGradedQuestions({})
      setShowResults(false)
      setIsFolderModalOpen(false)
    }
  }, [isLoggedIn])

  const handleTestClick = (testId: string) => {
    setCurrentTestId(testId)
    setCurrentQuestionIndex(0)
    setUserResponses({})
    setGradedQuestions({})
    setShowResults(false)
  }

  const handleBackClick = () => {
    if (showResults) {
      // From results screen, go back to test grid
      setCurrentTestId(null)
      setCurrentQuestionIndex(0)
      setUserResponses({})
      setGradedQuestions({})
      setShowResults(false)
    } else if (currentTestId) {
      setCurrentTestId(null)
      setCurrentQuestionIndex(0)
      setUserResponses({})
      setGradedQuestions({})
      setShowResults(false)
    } else {
      setCurrentFolderId(null)
    }
  }

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId)
  }

  const handleCreateFolder = () => {
    if (!isLoggedIn) {
      onOpenLoginModal?.()
      return
    }
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

  const handleResponseChange = (questionId: string, response: string, questionType?: 'multiple-choice' | 'short-answer') => {
    setUserResponses(prev => ({
      ...prev,
      [questionId]: response
    }))
    
    // Auto-grade only for multiple-choice questions when an option is selected
    // Short-answer questions require explicit submission
    if (questionType === 'multiple-choice' && response && response.trim()) {
      setGradedQuestions(prev => ({
        ...prev,
        [questionId]: true
      }))
    }
  }

  const handleSubmitAnswer = (questionId: string) => {
    const response = userResponses[questionId] || ''
    if (response && response.trim()) {
      setGradedQuestions(prev => ({
        ...prev,
        [questionId]: true
      }))
    }
  }

  const handleNextQuestion = () => {
    if (currentTest && currentQuestionIndex < currentTest.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const handleRestartTest = () => {
    setCurrentQuestionIndex(0)
    setUserResponses({})
    setGradedQuestions({})
    setShowResults(false)
  }

  const handleViewResults = () => {
    setShowResults(true)
  }

  // Get wrong question texts for focused test generation
  const getWrongQuestionTexts = (): string[] => {
    if (!currentTest) return []
    
    const wrongTexts: string[] = []
    currentTest.questions.forEach(question => {
      if (gradedQuestions[question.id]) {
        const userResponse = userResponses[question.id] || ''
        const isCorrect = question.correctAnswer && 
          (question.type === 'multiple-choice' 
            ? userResponse === question.correctAnswer
            : userResponse.trim().toLowerCase() === question.correctAnswer!.trim().toLowerCase())
        
        if (!isCorrect) {
          wrongTexts.push(question.question)
        }
      }
    })
    
    return wrongTexts
  }

  // Generate a new test focusing on wrong answers or making it harder
  const handleGenerateNewTest = async () => {
    if (!currentTest || !isLoggedIn) {
      onOpenLoginModal?.()
      return
    }

    setIsGeneratingTest(true)
    
    try {
      // Find the note content
      const note = notes.find(n => n.id === currentTest.noteId)
      if (!note || !note.content) {
        throw new Error('Note content not found. Please sync your notes.')
      }

      const wrongQuestionTexts = getWrongQuestionTexts()
      const score = calculateTestScore()
      const makeHarder = score.wrong === 0 // Make harder if no wrong answers

      const { supabase } = await import('../../lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('You must be logged in to use this feature')
      }

      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/tests/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          noteId: currentTest.noteId,
          noteName: currentTest.noteName,
          noteContent: note.content,
          wrongQuestionTexts: wrongQuestionTexts.length > 0 ? wrongQuestionTexts : undefined,
          makeHarder: makeHarder || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in to use this feature.')
        }
        
        if (response.status === 429) {
          const remaining = data.remaining || 0
          const limit = data.limit || 0
          throw new Error(
            `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
            `Please upgrade your plan or wait until next month.`
          )
        }
        
        throw new Error(data.message || data.error || 'Failed to generate test')
      }

      if (data.success && data.test) {
        // Create a new test name based on the focus
        const testName = wrongQuestionTexts.length > 0 
          ? `Test: ${currentTest.noteName} (Focus on Wrong Answers)`
          : `Test: ${currentTest.noteName} (Harder)`
        
        await addTest({
          name: testName,
          folderId: currentTest.folderId || undefined,
          noteId: data.test.noteId,
          noteName: data.test.noteName,
          questions: data.test.questions
        })

        // Navigate to the new test - wait a bit for store to update, then find it by testName
        setTimeout(() => {
          const newTest = tests.find(t => t.name === testName && t.noteId === currentTest.noteId)
          
          if (newTest) {
            setCurrentTestId(newTest.id)
            setCurrentQuestionIndex(0)
            setUserResponses({})
            setGradedQuestions({})
            setShowResults(false)
          }
        }, 100)
      }
    } catch (error) {
      console.error('Failed to generate new test:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate new test')
    } finally {
      setIsGeneratingTest(false)
    }
  }

  // Calculate test score (session-only, not saved)
  const calculateTestScore = () => {
    if (!currentTest) return { correct: 0, wrong: 0, total: 0, wrongQuestions: [] }
    
    let correct = 0
    let wrong = 0
    const wrongQuestions: string[] = []
    
    currentTest.questions.forEach(question => {
      if (gradedQuestions[question.id]) {
        const userResponse = userResponses[question.id] || ''
        const isCorrect = question.correctAnswer && 
          (question.type === 'multiple-choice' 
            ? userResponse === question.correctAnswer
            : userResponse.trim().toLowerCase() === question.correctAnswer!.trim().toLowerCase())
        
        if (isCorrect) {
          correct++
        } else {
          wrong++
          wrongQuestions.push(question.question)
        }
      }
    })
    
    return { correct, wrong, total: currentTest.questions.length, wrongQuestions }
  }

  const handleGenerateFocusedTest = async () => {
    if (!currentTest || !isLoggedIn) {
      onOpenLoginModal?.()
      return
    }

    setIsGeneratingTest(true)
    try {
      // Find the note content
      const note = notes.find(n => n.id === currentTest.noteId)
      if (!note || !note.content) {
        throw new Error('Note content not found. Please sync your notes.')
      }

      const wrongQuestionTexts = getWrongQuestionTexts()
      const score = calculateTestScore()
      const makeHarder = score.wrong === 0 // Make harder if no wrong answers

      const { supabase } = await import('../../lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('You must be logged in to use this feature')
      }

      const API_BASE_URL = getApiBaseUrl()
      const response = await fetch(`${API_BASE_URL}/api/tests/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          noteId: currentTest.noteId,
          noteName: currentTest.noteName,
          noteContent: note.content,
          wrongQuestionTexts: wrongQuestionTexts.length > 0 ? wrongQuestionTexts : undefined,
          makeHarder: makeHarder || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in to use this feature.')
        }
        
        if (response.status === 429) {
          const remaining = data.remaining || 0
          const limit = data.limit || 0
          throw new Error(
            `Monthly token limit exceeded. You have used ${limit - remaining} of ${limit} tokens. ` +
            `Please upgrade your plan or wait until next month.`
          )
        }
        
        throw new Error(data.message || data.error || 'Failed to generate test')
      }

      if (data.success && data.test) {
        // Create a new test name based on the focus
        const testName = wrongQuestionTexts.length > 0 
          ? `Test: ${currentTest.noteName} (Focus on Wrong Answers)`
          : `Test: ${currentTest.noteName} (Harder)`
        
        await addTest({
          name: testName,
          folderId: currentTest.folderId || undefined,
          noteId: data.test.noteId,
          noteName: data.test.noteName,
          questions: data.test.questions
        })

        // Sync tests to get the new test ID
        const { syncFromSupabase } = useTestsStore.getState()
        await syncFromSupabase()
        
        // Find the newly created test and navigate to it
        const updatedTests = useTestsStore.getState().tests
        const newTest = updatedTests.find(t => 
          t.noteId === currentTest.noteId && 
          (t.name === testName || t.name === data.test.name)
        )

        if (newTest) {
          setCurrentTestId(newTest.id)
          setCurrentQuestionIndex(0)
          setUserResponses({})
          setGradedQuestions({})
          setShowResults(false)
        }
      }
    } catch (error) {
      console.error('Failed to generate focused test:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate focused test')
    } finally {
      setIsGeneratingTest(false)
    }
  }

  const handleDeleteTest = async (testId: string) => {
    removeTest(testId)
    if (currentTestId === testId) {
      setCurrentTestId(null)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return

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

  // PanResponder for swipe right gesture (mobile only, after question is answered)
  const currentQuestionIdRef = useRef<string | null>(null)
  const currentQuestionIsGradedRef = useRef<boolean>(false)
  const currentQuestionIndexRef = useRef<number>(0)
  const questionsLengthRef = useRef<number>(0)
  
  useEffect(() => {
    if (currentTest && currentTest.questions[currentQuestionIndex]) {
      currentQuestionIdRef.current = currentTest.questions[currentQuestionIndex].id
      currentQuestionIsGradedRef.current = gradedQuestions[currentTest.questions[currentQuestionIndex].id] || false
      currentQuestionIndexRef.current = currentQuestionIndex
      questionsLengthRef.current = currentTest.questions.length
    }
  }, [currentTest, currentQuestionIndex, gradedQuestions])

  const panResponder = useMemo(
    () => {
      if (Platform.OS === 'web') return null
      
      return PanResponder.create({
        onStartShouldSetPanResponderCapture: (evt, gestureState) => {
          // Capture gesture early if question is graded - helps compete with ScrollView
          if (!currentQuestionIsGradedRef.current) return false
          // Don't capture on initial touch, wait for movement
          return false
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          // Only respond to horizontal swipes (more horizontal than vertical)
          // Only allow swipe if question is graded
          if (!currentQuestionIsGradedRef.current) return false
          // Require significant horizontal movement
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 15
        },
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
          // Capture horizontal gestures to prevent ScrollView from taking them
          if (!currentQuestionIsGradedRef.current) return false
          // Capture if it's clearly a horizontal swipe
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 15
        },
        onPanResponderTerminationRequest: () => false, // Don't allow other handlers to take over
        onPanResponderGrant: () => {
          // Prevent ScrollView from scrolling when we start a horizontal swipe
        },
        onPanResponderRelease: (evt, gestureState) => {
          // Only trigger if question is graded and swipe is significant
          if (!currentQuestionIsGradedRef.current) return
          
          const swipeThreshold = 50
          const swipeVelocity = 0.5
          
          // Swipe left (next question) - only if not on last question
          if ((gestureState.dx < -swipeThreshold || gestureState.vx < -swipeVelocity)) {
            if (currentQuestionIndexRef.current < questionsLengthRef.current - 1) {
              handleNextQuestion()
            }
          }
        },
      })
    },
    [handleNextQuestion]
  )

  // Render test detail view with questions
  if (currentTestId && currentTest) {
    // Render results screen
    if (showResults) {
      const score = calculateTestScore()
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
              <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1} ellipsizeMode="tail">Test Results</Text>
            </View>
          </View>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreTitle}>Test Results</Text>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Correct:</Text>
                <Text style={styles.scoreValueCorrect}>{score.correct}</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Wrong:</Text>
                <Text style={styles.scoreValueWrong}>{score.wrong}</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Total:</Text>
                <Text style={styles.scoreValue}>{score.total}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.generateTestButton, isGeneratingTest && styles.generateTestButtonDisabled]}
              onPress={handleGenerateNewTest}
              disabled={isGeneratingTest}
            >
              <Text style={styles.generateTestButtonText}>
                {isGeneratingTest 
                  ? 'Generating...' 
                  : score.wrong > 0 
                    ? 'Generate Test on Wrong Answers' 
                    : 'Generate Harder Test'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.restartButton}
              onPress={handleRestartTest}
            >
              <Text style={styles.restartButtonText}>Restart Test</Text>
            </Pressable>
          </ScrollView>
        </View>
      )
    }

    // Render question view
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
            flex: 1,
            maxWidth: '100%',
            minWidth: 0, // Allow shrinking for truncation
          }]}>
            {!isMobile && (
            <Pressable style={styles.backButton} onPress={handleBackClick}>
              <BackIcon />
            </Pressable>
            )}
            <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1} ellipsizeMode="tail">{currentTest.name}</Text>
          </View>
        </View>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={Platform.OS === 'web' || !(currentTest.questions[currentQuestionIndex] && gradedQuestions[currentTest.questions[currentQuestionIndex].id])}
        >
          <View style={styles.testInfo}>
            <Text style={styles.testCount}>
              Question {currentQuestionIndex + 1} of {currentTest.questions.length}
            </Text>
          </View>
          
          {currentTest.questions[currentQuestionIndex] && (() => {
            const question = currentTest.questions[currentQuestionIndex]
            const userResponse = userResponses[question.id] || ''
            const isGraded = gradedQuestions[question.id] || false
            const isCorrect = question.correctAnswer && 
              (question.type === 'multiple-choice' 
                ? userResponse === question.correctAnswer
                : userResponse.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase())
            
            return (
              <View 
                style={styles.questionCard}
                {...(panResponder?.panHandlers || {})}
              >
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Question {currentQuestionIndex + 1}</Text>
                  <Text style={styles.questionType}>
                    {question.type === 'multiple-choice' ? 'Multiple Choice' : 'Short Answer'}
                  </Text>
                </View>
                <Text style={styles.questionText}>{question.question}</Text>
                
                {question.type === 'multiple-choice' && question.options && (
                  <View style={styles.optionsContainer}>
                    {question.options.map((option, optIndex) => {
                      const isSelected = userResponse === option
                      const isCorrectOption = isGraded && question.correctAnswer === option
                      const isWrongSelection = isGraded && isSelected && question.correctAnswer !== option
                      
                      return (
                        <Pressable
                          key={optIndex}
                          style={[
                            styles.option,
                            isSelected && styles.optionSelected,
                            isCorrectOption && styles.optionCorrect,
                            isWrongSelection && styles.optionIncorrect,
                            !isGraded && styles.optionClickable,
                          ]}
                          onPress={() => !isGraded && handleResponseChange(question.id, option, 'multiple-choice')}
                          disabled={isGraded}
                        >
                          <Text style={styles.optionLabel}>{String.fromCharCode(65 + optIndex)}.</Text>
                          <Text style={styles.optionText}>{option}</Text>
                          {isSelected && !isGraded && (
                            <Text style={styles.selectedIndicator}>✓ Selected</Text>
                          )}
                          {isGraded && isCorrectOption && (
                            <Text style={styles.correctIndicator}>✓ Correct</Text>
                          )}
                          {isGraded && isWrongSelection && (
                            <Text style={styles.incorrectIndicator}>✗ Incorrect</Text>
                          )}
                        </Pressable>
                      )
                    })}
                  </View>
                )}
                
                {question.type === 'short-answer' && (
                  <>
                    {!isGraded ? (
                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.shortAnswerInput}
                          placeholder="Type your answer here..."
                          value={userResponse}
                          onChangeText={(text) => handleResponseChange(question.id, text, 'short-answer')}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                        <Pressable
                          style={[styles.submitButton, (!userResponse || !userResponse.trim()) && styles.submitButtonDisabled]}
                          onPress={() => handleSubmitAnswer(question.id)}
                          disabled={!userResponse || !userResponse.trim()}
                        >
                          <Text style={styles.submitButtonText}>Submit Answer</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.answerComparison}>
                        <View style={userResponse 
                          ? [styles.answerSection, isCorrect ? styles.answerSectionCorrect : styles.answerSectionIncorrect]
                          : styles.answerSection}>
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
          })()}
          
          {currentTest.questions[currentQuestionIndex] && gradedQuestions[currentTest.questions[currentQuestionIndex].id] && (
            <View style={styles.navigationContainer}>
              {currentQuestionIndex < currentTest.questions.length - 1 ? (
                <Pressable
                  style={styles.nextButton}
                  onPress={handleNextQuestion}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.nextButton}
                  onPress={handleViewResults}
                >
                  <Text style={styles.nextButtonText}>View Results</Text>
                </Pressable>
              )}
            </View>
          )}
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
          {/* <Pressable style={[styles.createFolderButton, isMobile && styles.buttonMobile]} onPress={handleCreateFolder}>
            <View style={isMobile && styles.iconWrapperMobile}>
            <FolderIcon />
            </View>
            <Text style={[styles.createFolderButtonText, isMobile && styles.buttonTextMobile]}>Create Folder</Text>
          </Pressable> */}
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
          key={`tests-grid-${numColumns}`}
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
                  <Text style={styles.testCardTitle} numberOfLines={2} ellipsizeMode="tail">{test.name}</Text>
                  <Text style={styles.testCardMeta} numberOfLines={1} ellipsizeMode="tail">
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
    minWidth: 0, // Allow text truncation
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
    flexShrink: 1, // Allow title to shrink when needed
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    minHeight: 44, // Match NotesView button height (paddingVertical: 12 * 2 + text/icon height)
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
    gap: 12,
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
  submitButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f0f0f',
    backgroundColor: '#0f0f0f',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  submitButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#d0d0d0',
    borderColor: '#d0d0d0',
    ...(Platform.OS === 'web' && {
      cursor: 'not-allowed',
    }),
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ffffff',
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
  navigationContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
    alignItems: 'center',
  },
  nextButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f0f0f',
    backgroundColor: '#0f0f0f',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ffffff',
  },
  restartButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f0f0f',
    backgroundColor: '#0f0f0f',
    alignSelf: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#ffffff',
  },
  scoreContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    width: '100%',
    ...(Platform.OS === 'web' && {
      maxWidth: 400,
      alignSelf: 'center',
    }),
  },
  scoreTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f0f0f',
    marginBottom: 16,
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f0f0f',
  },
  scoreValueCorrect: {
    fontSize: 18,
    fontWeight: '600',
    color: '#28a745',
  },
  scoreValueWrong: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc3545',
  },
  generateTestButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0f0f0f',
    backgroundColor: '#ffffff',
    alignSelf: 'center',
    marginBottom: 16,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  generateTestButtonDisabled: {
    opacity: 0.5,
    ...(Platform.OS === 'web' && {
      cursor: 'not-allowed',
    }),
  },
  generateTestButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f0f0f',
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

import { useState, useRef, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, FlatList, Dimensions, Animated, Platform, PanResponder } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFlashcardsStore, type FlashcardSet } from '../../stores/flashcardsStore'
import { useAuthStore } from '../../stores/authStore'
import { BackIcon, FolderIcon, DeleteIcon, FlashcardsIcon, ArrowLeftIcon, ArrowRightIcon } from '../icons'
import MobileBackButton from '../MobileBackButton'
import { useDetailMode } from '../../contexts/DetailModeContext'

interface FlashcardsViewProps {
  onOpenLoginModal?: () => void
}

function FlashcardsView({ onOpenLoginModal }: FlashcardsViewProps = {}) {
  const [currentSetId, setCurrentSetId] = useState<string | null>(null)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [prevCardIndex, setPrevCardIndex] = useState<number | null>(null)
  const { flashcardSets, removeFlashcardSet, getFlashcardSetById } = useFlashcardsStore()
  const { isLoggedIn } = useAuthStore()
  
  // Animation refs
  const flipAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const prevSlideAnim = useRef(new Animated.Value(0)).current
  
  const displayedFlashcardSets = flashcardSets
  
  const currentSet = currentSetId ? getFlashcardSetById(currentSetId) : null
  const cards = currentSet ? currentSet.cards : []
  const currentCard = cards[currentCardIndex]
  const prevCard = prevCardIndex !== null ? cards[prevCardIndex] : null
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const numColumns = windowWidth > 768 ? 4 : windowWidth > 480 ? 3 : 2
  const insets = useSafeAreaInsets()
  const isMobile = windowWidth <= 768
  const { setIsInDetailMode } = useDetailMode()

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
      setCurrentSetId(null)
      setCurrentCardIndex(0)
      setIsFlipped(false)
      setIsTransitioning(false)
      setPrevCardIndex(null)
      flipAnim.setValue(0)
      slideAnim.setValue(0)
      prevSlideAnim.setValue(0)
    }
  }, [isLoggedIn])

  // Handle flip animation
  useEffect(() => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      duration: 300,
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [isFlipped, flipAnim])

  const handleSetClick = (setId: string) => {
    setCurrentSetId(setId)
    setCurrentCardIndex(0)
    setIsFlipped(false)
    flipAnim.setValue(0)
  }

  const handleBackFromStudy = () => {
    setCurrentSetId(null)
    setCurrentCardIndex(0)
    setIsFlipped(false)
    flipAnim.setValue(0)
  }

  const handleBackClick = () => {
    if (currentSetId) {
      setCurrentSetId(null)
      setCurrentCardIndex(0)
      setIsFlipped(false)
      flipAnim.setValue(0)
    }
  }

  const handleCardFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleNextCard = () => {
    if (currentCardIndex < cards.length - 1 && !isTransitioning) {
      setIsTransitioning(true)
      setPrevCardIndex(currentCardIndex)
      
      // Update card index immediately so the incoming card's text is set
      const nextIndex = currentCardIndex + 1
      setCurrentCardIndex(nextIndex)
      setIsFlipped(false) // Reset flip state for new card
      flipAnim.setValue(0) // Reset flip animation
      
      // Animate previous card out
      Animated.timing(prevSlideAnim, {
        toValue: -windowWidth,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start()
      
      // Animate new card in
      slideAnim.setValue(windowWidth)
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setTimeout(() => {
          setPrevCardIndex(null)
          setIsTransitioning(false)
          prevSlideAnim.setValue(0)
          slideAnim.setValue(0)
        }, 100)
      })
    }
  }

  const handlePrevCard = () => {
    if (currentCardIndex > 0 && !isTransitioning) {
      setIsTransitioning(true)
      setPrevCardIndex(currentCardIndex)
      
      // Update card index immediately so the incoming card's text is set
      const prevIndex = currentCardIndex - 1
      setCurrentCardIndex(prevIndex)
      setIsFlipped(false) // Reset flip state for new card
      flipAnim.setValue(0) // Reset flip animation
      
      // Animate previous card out
      Animated.timing(prevSlideAnim, {
        toValue: windowWidth,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start()
      
      // Animate new card in
      slideAnim.setValue(-windowWidth)
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setTimeout(() => {
          setPrevCardIndex(null)
          setIsTransitioning(false)
          prevSlideAnim.setValue(0)
          slideAnim.setValue(0)
        }, 100)
      })
    }
  }

  const handleDeleteSet = async (setId: string) => {
    removeFlashcardSet(setId)
    if (currentSetId === setId) {
      setCurrentSetId(null)
    }
  }

  // Refs to store latest values for PanResponder (to avoid stale closures)
  const currentCardIndexRef = useRef(currentCardIndex)
  const isTransitioningRef = useRef(isTransitioning)
  const cardsLengthRef = useRef(cards.length)
  
  // Update refs when values change
  useEffect(() => {
    currentCardIndexRef.current = currentCardIndex
  }, [currentCardIndex])
  
  useEffect(() => {
    isTransitioningRef.current = isTransitioning
  }, [isTransitioning])
  
  useEffect(() => {
    cardsLengthRef.current = cards.length
  }, [cards.length])

  // PanResponder for swipe gestures (mobile only)
  const panResponder = useMemo(
    () => {
      if (Platform.OS === 'web') return null
      
      return PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          // Only respond to horizontal swipes (more horizontal than vertical)
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10
        },
        onPanResponderRelease: (evt, gestureState) => {
          // Only trigger if not transitioning and swipe is significant
          if (isTransitioningRef.current) return
          
          const swipeThreshold = 50
          const swipeVelocity = 0.5
          
          // Swipe left (next card)
          if (gestureState.dx < -swipeThreshold || gestureState.vx < -swipeVelocity) {
            if (currentCardIndexRef.current < cardsLengthRef.current - 1) {
              handleNextCard()
            }
          }
          // Swipe right (previous card)
          else if (gestureState.dx > swipeThreshold || gestureState.vx > swipeVelocity) {
            if (currentCardIndexRef.current > 0) {
              handlePrevCard()
            }
          }
        },
      })
    },
    [handleNextCard, handlePrevCard] // Only recreate if handlers change (they don't, so this is stable)
  )

  // Card flip animation interpolations
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  })

  // Update detail mode when entering/exiting flashcard study
  useEffect(() => {
    setIsInDetailMode(!!(currentSetId && currentSet && currentCard))
    return () => setIsInDetailMode(false)
  }, [currentSetId, currentSet, currentCard, setIsInDetailMode])

  // Render flashcard study view
  if (currentSetId && currentSet && currentCard) {
    const frontAnimatedStyle = {
      transform: [{ rotateY: frontInterpolate }],
    }
    const backAnimatedStyle = {
      transform: [{ rotateY: backInterpolate }],
    }

    return (
      <View style={styles.container}>
        {isMobile && <MobileBackButton onPress={handleBackFromStudy} />}
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
            {!isMobile && (
            <Pressable style={styles.backButton} onPress={handleBackFromStudy}>
              <BackIcon />
            </Pressable>
            )}
            <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1} ellipsizeMode="tail">{currentSet.name}</Text>
          </View>
        </View>
        <View style={styles.studyContainer}>
          <Text style={styles.progress}>
            Card {currentCardIndex + 1} of {cards.length}
          </Text>
          <View 
            style={styles.cardSlideContainer}
            {...(panResponder?.panHandlers || {})}
          >
            {/* Previous card sliding out */}
            {prevCard && prevCardIndex !== null && (
              <Animated.View
                style={[
                  styles.flashcard,
                  {
                    transform: [{ translateX: prevSlideAnim }],
                    position: 'absolute',
                    ...(Platform.OS === 'web' && {
                      zIndex: 1, // Lower z-index for sliding out card
                    }),
                  },
                ]}
              >
                <View style={styles.flashcardInner}>
                  <Animated.View style={[styles.flashcardSide, frontAnimatedStyle]}>
                    <View style={styles.flashcardContent}>
                      <Text style={styles.flashcardText}>{prevCard.front}</Text>
                    </View>
                    <Text style={styles.flashcardHint}>Click to flip</Text>
                  </Animated.View>
                  <Animated.View style={[styles.flashcardSide, styles.flashcardBack, backAnimatedStyle]}>
                    <View style={styles.flashcardContent}>
                      <Text style={styles.flashcardText}>{prevCard.back}</Text>
                    </View>
                    <Text style={styles.flashcardHint}>Click to flip</Text>
                  </Animated.View>
                </View>
              </Animated.View>
            )}
            {/* Current card */}
            <Animated.View
              style={[
                styles.flashcard,
                {
                  transform: [{ translateX: slideAnim }],
                  ...(Platform.OS === 'web' && {
                    zIndex: 2, // Higher z-index for current card
                  }),
                },
              ]}
            >
              <Pressable onPress={handleCardFlip} style={styles.flashcardPressable}>
                <View style={styles.flashcardInner}>
                  <Animated.View style={[styles.flashcardSide, frontAnimatedStyle]}>
                    <View style={styles.flashcardContent}>
                      <Text style={styles.flashcardText}>{currentCard.front}</Text>
                    </View>
                    <Text style={styles.flashcardHint}>Click to flip</Text>
                  </Animated.View>
                  <Animated.View style={[styles.flashcardSide, styles.flashcardBack, backAnimatedStyle]}>
                    <View style={styles.flashcardContent}>
                      <Text style={styles.flashcardText}>{currentCard.back}</Text>
                    </View>
                    <Text style={styles.flashcardHint}>Click to flip</Text>
                  </Animated.View>
                </View>
              </Pressable>
            </Animated.View>
          </View>
          <View style={styles.navigation}>
            <Pressable
              style={[styles.navButton, currentCardIndex === 0 && styles.navButtonDisabled]}
              onPress={handlePrevCard}
              disabled={currentCardIndex === 0 || isTransitioning}
            >
              <ArrowLeftIcon />
              <Text style={styles.navButtonText}>Previous</Text>
            </Pressable>
            <Pressable
              style={[styles.navButton, currentCardIndex === cards.length - 1 && styles.navButtonDisabled]}
              onPress={handleNextCard}
              disabled={currentCardIndex === cards.length - 1 || isTransitioning}
            >
              <Text style={styles.navButtonText}>Next</Text>
              <ArrowRightIcon />
            </Pressable>
          </View>
        </View>
      </View>
    )
  }

  // Render flashcard sets grid view
  type GridItem = FlashcardSet & { itemType: 'set' }
  const gridData: GridItem[] = [
    ...displayedFlashcardSets.map(s => ({ ...s, itemType: 'set' as const })),
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
          <Text style={[styles.title, isMobile && styles.titleMobile]} numberOfLines={1}>Flashcards</Text>
        </View>
        <View style={[
          styles.headerButtons, 
          isMobile && [
            styles.headerButtonsMobile,
            { width: windowWidth } // Use actual screen width dynamically
          ]
        ]}>
        </View>
      </View>

      {gridData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No flashcards yet. Use @ to mention a note in chat and ask to "turn notes into flashcards" to create one.
          </Text>
        </View>
      ) : (
        <FlatList
          key={`flashcards-grid-${numColumns}`}
          data={gridData}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const set = item as FlashcardSet & { itemType: 'set' }
            return (
              <Pressable style={styles.setCard} onPress={() => handleSetClick(set.id)}>
                <Pressable 
                  style={styles.cardDeleteButton}
                  onPress={(e) => {
                    e.stopPropagation()
                    handleDeleteSet(set.id)
                  }}
                >
                  <DeleteIcon />
                </Pressable>
                <View style={styles.setCardIcon}>
                  <FlashcardsIcon />
                </View>
                <Text style={styles.setCardTitle}>{set.name}</Text>
                <Text style={styles.setCardMeta}>
                  {set.cards.length} cards • From: {set.noteName}
                </Text>
              </Pressable>
            )
          }}
        />
      )}

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    ...(Platform.OS === 'web' && {
      position: 'relative',
      // Don't set z-index here - let it be in normal flow so ChatBar can appear on top
    }),
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
    minHeight: 44, // Match NotesView button height (paddingVertical: 12 * 2 + text/icon height)
  },
  studyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' && {
      overflow: 'hidden', // Clip cards that go outside bounds
    }),
  },
  progress: {
    fontSize: 16,
    fontWeight: '300',
    color: '#666',
    marginBottom: 20,
  },
  cardSlideContainer: {
    width: '100%',
    maxWidth: 600,
    height: 400,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // Clip cards that go outside bounds
    ...(Platform.OS === 'web' && {
      overflow: 'hidden',
    }),
  },
  flashcard: {
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web' && {
      perspective: 1000,
    }),
  },
  flashcardPressable: {
    width: '100%',
    height: '100%',
  },
  flashcardInner: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  flashcardSide: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    ...(Platform.OS === 'web' && {
      WebkitBackfaceVisibility: 'hidden',
    }),
  },
  flashcardBack: {
    ...(Platform.OS === 'web' && {
      transform: [{ rotateY: '180deg' }],
    }),
  },
  flashcardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashcardText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#0f0f0f',
    textAlign: 'center',
    lineHeight: 32,
  },
  flashcardHint: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
    marginTop: 20,
  },
  navigation: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 40,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#ffffff',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '300',
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
  setCard: {
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
  setCardIcon: {
    marginBottom: 8,
  },
  setCardTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  setCardMeta: {
    fontSize: 14,
    color: '#666',
    fontWeight: '300',
    marginTop: 4,
  },
})

export default FlashcardsView

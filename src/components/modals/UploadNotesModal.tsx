import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, StyleSheet, Modal, Pressable, Platform } from 'react-native'
import { createPortal } from 'react-dom'
import { Svg, Line } from 'react-native-svg'
import { pickImage } from '../../lib/platformHelpers'

interface UploadNotesModalProps {
  isOpen: boolean
  onClose: () => void
  onFileSelect: (file: File | Blob) => void
  onYouTubeUrlSubmit: (url: string) => void
  isPro: boolean
  onOpenUpgradeModal?: () => void
  onOpenLoginModal?: () => void
}

const CloseIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
)

function UploadNotesModal({ isOpen, onClose, onFileSelect, onYouTubeUrlSubmit, isPro, onOpenUpgradeModal, onOpenLoginModal }: UploadNotesModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('file')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      setYoutubeUrl('')
      setActiveTab('file')
      // Initialize file input for web
      if (Platform.OS === 'web' && !fileInputRef.current) {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*,application/pdf'
        input.style.display = 'none'
        input.onchange = (e: any) => {
          const file = e.target.files?.[0]
          if (file) {
            onFileSelect(file)
            onClose()
          }
          if (input.parentNode) {
            input.parentNode.removeChild(input)
          }
          fileInputRef.current = null
        }
        document.body.appendChild(input)
        fileInputRef.current = input
      }
    }
  }, [isOpen, onFileSelect, onClose])

  // Reset to file tab if user is not Pro and tries to access YouTube tab
  useEffect(() => {
    if (activeTab === 'youtube' && !isPro) {
      setActiveTab('file')
    }
  }, [isPro, activeTab])

  const handleFileUpload = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click()
    } else {
      // Native: use pickImage
      pickImage().then((file) => {
        if (file) {
          onFileSelect(file as File)
          onClose()
        }
      }).catch((error) => {
        console.error('Failed to pick file:', error)
      })
    }
  }

  const handleYouTubeSubmit = () => {
    if (!isPro) {
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal()
      } else if (onOpenLoginModal) {
        onOpenLoginModal()
      }
      return
    }
    
    const trimmedUrl = youtubeUrl.trim()
    if (trimmedUrl) {
      // Validate YouTube URL format
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      if (youtubeRegex.test(trimmedUrl)) {
        onYouTubeUrlSubmit(trimmedUrl)
        setYoutubeUrl('')
        onClose()
      } else {
        // Try to extract video ID from various YouTube URL formats
        const videoIdMatch = trimmedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
        if (videoIdMatch) {
          onYouTubeUrlSubmit(trimmedUrl)
          setYoutubeUrl('')
          onClose()
        } else {
          alert('Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID)')
        }
      }
    }
  }

  const handleClose = () => {
    setYoutubeUrl('')
    setActiveTab('file')
    onClose()
  }

  // Web-specific rendering
  if (Platform.OS === 'web') {
    if (!isOpen) return null

    const modalContent = (
      <View style={styles.modalContainer}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View style={styles.contentWrapper}>
            <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
              <View style={styles.header}>
                <Text style={styles.title}>Upload Notes</Text>
                <Pressable onPress={handleClose} style={styles.closeButton}>
                  <CloseIcon />
                </Pressable>
              </View>
              
              <View style={styles.tabs}>
                <Pressable 
                  style={[styles.tab, activeTab === 'file' && styles.tabActive]}
                  onPress={() => setActiveTab('file')}
                >
                  <Text style={[styles.tabText, activeTab === 'file' && styles.tabTextActive]}>File</Text>
                </Pressable>
                <Pressable 
                  style={[styles.tab, activeTab === 'youtube' && styles.tabActive, !isPro && styles.tabDisabled]}
                  onPress={() => {
                    if (isPro) {
                      setActiveTab('youtube')
                    } else {
                      if (onOpenUpgradeModal) {
                        onOpenUpgradeModal()
                      } else if (onOpenLoginModal) {
                        onOpenLoginModal()
                      }
                    }
                  }}
                >
                  <Text style={[styles.tabText, activeTab === 'youtube' && styles.tabTextActive, !isPro && styles.tabTextDisabled]}>YouTube</Text>
                </Pressable>
              </View>
              
              <View style={styles.body}>
                {activeTab === 'file' ? (
                  <View style={styles.fileSection}>
                    <Text style={styles.sectionDescription}>
                      Upload an image or PDF file to extract notes
                    </Text>
                    <Pressable style={styles.uploadButton} onPress={handleFileUpload}>
                      <Text style={styles.uploadButtonText}>Choose File</Text>
                    </Pressable>
                    <Text style={styles.fileHint}>Supports: Images (JPG, PNG) and PDF files</Text>
                  </View>
                ) : !isPro ? (
                  <View style={styles.lockedSection}>
                    <Text style={styles.lockedTitle}>YouTube Notes is a Pro Feature</Text>
                    <Text style={styles.lockedMessage}>
                      Upgrade to Pro to generate notes from YouTube videos.
                    </Text>
                    <Pressable 
                      style={styles.upgradeButton}
                      onPress={() => {
                        handleClose()
                        if (onOpenUpgradeModal) {
                          onOpenUpgradeModal()
                        } else if (onOpenLoginModal) {
                          onOpenLoginModal()
                        }
                      }}
                    >
                      <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.youtubeSection}>
                    <Text style={styles.sectionDescription}>
                      Enter a YouTube video URL to generate notes
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChangeText={setYoutubeUrl}
                      onSubmitEditing={handleYouTubeSubmit}
                      autoFocus
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={styles.youtubeHint}>
                      Paste a YouTube video URL (e.g., youtube.com/watch?v=... or youtu.be/...)
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.footer}>
                <Pressable style={styles.buttonSecondary} onPress={handleClose}>
                  <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </Pressable>
                {activeTab === 'youtube' && isPro && (
                  <Pressable style={styles.buttonPrimary} onPress={handleYouTubeSubmit}>
                    <Text style={styles.buttonPrimaryText}>Generate Notes</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </View>
        </Pressable>
      </View>
    )

    return typeof document !== 'undefined' 
      ? createPortal(modalContent, document.body)
      : modalContent
  }

  // Native Modal
  if (!isOpen) return null

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlayNative} onPress={handleClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Upload Notes</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <CloseIcon />
            </Pressable>
          </View>
          
          <View style={styles.tabs}>
            <Pressable 
              style={[styles.tab, activeTab === 'file' && styles.tabActive]}
              onPress={() => setActiveTab('file')}
            >
              <Text style={[styles.tabText, activeTab === 'file' && styles.tabTextActive]}>File</Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, activeTab === 'youtube' && styles.tabActive, !isPro && styles.tabDisabled]}
              onPress={() => {
                if (isPro) {
                  setActiveTab('youtube')
                } else {
                  if (onOpenUpgradeModal) {
                    onOpenUpgradeModal()
                  } else if (onOpenLoginModal) {
                    onOpenLoginModal()
                  }
                }
              }}
            >
              <Text style={[styles.tabText, activeTab === 'youtube' && styles.tabTextActive, !isPro && styles.tabTextDisabled]}>YouTube</Text>
            </Pressable>
          </View>
          
          <View style={styles.body}>
            {activeTab === 'file' ? (
              <View style={styles.fileSection}>
                <Text style={styles.sectionDescription}>
                  Upload an image or PDF file to extract notes
                </Text>
                <Pressable style={styles.uploadButton} onPress={handleFileUpload}>
                  <Text style={styles.uploadButtonText}>Choose File</Text>
                </Pressable>
                <Text style={styles.fileHint}>Supports: Images (JPG, PNG) and PDF files</Text>
              </View>
            ) : !isPro ? (
              <View style={styles.lockedSection}>
                <Text style={styles.lockedTitle}>YouTube Notes is a Pro Feature</Text>
                <Text style={styles.lockedMessage}>
                  Upgrade to Pro to generate notes from YouTube videos.
                </Text>
                <Pressable 
                  style={styles.upgradeButton}
                  onPress={() => {
                    handleClose()
                    if (onOpenUpgradeModal) {
                      onOpenUpgradeModal()
                    } else if (onOpenLoginModal) {
                      onOpenLoginModal()
                    }
                  }}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.youtubeSection}>
                <Text style={styles.sectionDescription}>
                  Enter a YouTube video URL to generate notes
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChangeText={setYoutubeUrl}
                  onSubmitEditing={handleYouTubeSubmit}
                  autoFocus
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.youtubeHint}>
                  Paste a YouTube video URL (e.g., youtube.com/watch?v=... or youtu.be/...)
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.footer}>
            <Pressable style={styles.buttonSecondary} onPress={handleClose}>
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </Pressable>
            {activeTab === 'youtube' && isPro && (
              <Pressable style={styles.buttonPrimary} onPress={handleYouTubeSubmit}>
                <Text style={styles.buttonPrimaryText}>Generate Notes</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2147483647,
      pointerEvents: 'none',
      width: '100vw' as any,
      height: '100vh' as any,
    }),
  } as any,
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      zIndex: 2147483646,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      pointerEvents: 'auto',
    }),
  } as any,
  overlayNative: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentWrapper: {
    ...(Platform.OS === 'web' && {
      width: '100%',
      maxWidth: 500,
      zIndex: 2147483647,
      pointerEvents: 'auto',
      position: 'relative',
    }),
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    ...(Platform.OS === 'web' && {
      maxWidth: 500,
      position: 'relative',
      zIndex: 2147483647,
      pointerEvents: 'auto',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  closeButton: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0f0f0f',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '300',
    color: '#666',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#0f0f0f',
    fontWeight: '400',
  },
  tabDisabled: {
    opacity: 0.5,
  },
  tabTextDisabled: {
    opacity: 0.5,
  },
  body: {
    padding: 20,
  },
  fileSection: {
    alignItems: 'center',
  },
  youtubeSection: {
    width: '100%',
  },
  lockedSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0f0f0f',
    marginBottom: 12,
    textAlign: 'center',
  },
  lockedMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  upgradeButton: {
    backgroundColor: '#0f0f0f',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '300',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  uploadButton: {
    backgroundColor: '#0f0f0f',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadButtonText: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '300',
  },
  fileHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f0f0f',
    marginBottom: 12,
  },
  youtubeHint: {
    fontSize: 12,
    color: '#999',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
  },
  buttonPrimary: {
    backgroundColor: '#0f0f0f',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonPrimaryText: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '300',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  buttonSecondaryText: {
    color: '#0f0f0f',
    fontSize: 16,
    fontWeight: '300',
  },
})

export default UploadNotesModal

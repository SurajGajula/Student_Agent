import { View, Text, StyleSheet, Pressable, Platform, Modal } from 'react-native'
import { createPortal } from 'react-dom'
import { Svg, Line } from 'react-native-svg'
import { getStorage } from '../../lib/storage'

interface BetaModalProps {
  isOpen: boolean
  onClose: () => void
}

const CloseIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
)

const BetaBadge = () => (
  <View style={{ backgroundColor: '#ff9800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 }}>BETA</Text>
  </View>
)

function BetaModal({ isOpen, onClose }: BetaModalProps) {
  const handleClose = async () => {
    // Remember that user has dismissed the modal
    const storage = getStorage()
    if (storage && storage.setItem) {
      try {
        if (Platform.OS === 'web') {
          // Web: localStorage is synchronous
          storage.setItem('goals-beta-modal-dismissed', 'true')
        } else {
          // Native: AsyncStorage is asynchronous
          await storage.setItem('goals-beta-modal-dismissed', 'true')
        }
      } catch (error) {
        console.error('Failed to save beta modal dismissal:', error)
      }
    }
    onClose()
  }

  // Web-specific rendering for immediate display and z-index control
  if (Platform.OS === 'web') {
    if (!isOpen) return null

    const modalContent = (
      <View style={styles.modalContainer}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View style={styles.contentWrapper}>
            <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
              <View style={styles.header}>
                <View style={styles.titleContainer}>
                  <BetaBadge />
                  <Text style={styles.title}>Beta Feature</Text>
                </View>
                <Pressable onPress={handleClose} style={styles.closeButton}>
                  <CloseIcon />
                </Pressable>
              </View>
              
              <View style={styles.body}>
                <Text style={styles.message}>
                  The Goals feature is currently in beta and supports CS courses from UC Berkeley, UC Santa Cruz, and Stanford.
                </Text>
                <Text style={styles.submessage}>
                  We're working on expanding support to more schools and departments. Stay tuned for updates!
                </Text>
              </View>
              
              <View style={styles.footer}>
                <Pressable style={styles.buttonPrimary} onPress={handleClose}>
                  <Text style={styles.buttonPrimaryText}>Got it</Text>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </View>
    )

    return typeof document !== 'undefined' 
      ? createPortal(modalContent, document.body)
      : null
  }

  // Native rendering
  if (!isOpen) return null

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlayNative} onPress={handleClose}>
        <View style={styles.contentWrapperNative}>
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <BetaBadge />
                <Text style={styles.title}>Beta Feature</Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <CloseIcon />
              </Pressable>
            </View>
            
            <View style={styles.body}>
              <Text style={styles.message}>
                The Goals feature is currently in beta and supports CS courses from UC Berkeley, UC Santa Cruz, and Stanford.
              </Text>
              <Text style={styles.submessage}>
                We're working on expanding support to more schools and departments. Stay tuned for updates!
              </Text>
            </View>
            
            <View style={styles.footer}>
              <Pressable style={styles.buttonPrimary} onPress={handleClose}>
                <Text style={styles.buttonPrimaryText}>Got it</Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
    }),
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(4px)',
    }),
  },
  overlayNative: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentWrapperNative: {
    width: '100%',
    maxWidth: 500,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 500,
    padding: 20,
    ...(Platform.OS === 'web' && {
      maxWidth: 480,
    }),
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f0f0f',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      ':hover': {
        backgroundColor: '#f0f0f0',
      },
    }),
  },
  body: {
    padding: 20,
    gap: 16,
  },
  message: {
    fontSize: 16,
    color: '#0f0f0f',
    lineHeight: 24,
    fontWeight: '400',
  },
  submessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontWeight: '300',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    gap: 12,
  },
  buttonPrimary: {
    backgroundColor: '#0f0f0f',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      ':hover': {
        backgroundColor: '#333',
      },
    }),
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
})

export default BetaModal

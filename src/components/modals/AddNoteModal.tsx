import { useState, useEffect } from 'react'
import { View, Text, TextInput, StyleSheet, Modal, Pressable, Platform } from 'react-native'
import { createPortal } from 'react-dom'
import { Svg, Line } from 'react-native-svg'

interface AddNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (noteName: string) => void
}

const CloseIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
)

function AddNoteModal({ isOpen, onClose, onSubmit }: AddNoteModalProps) {
  const [noteName, setNoteName] = useState('')

  useEffect(() => {
    if (isOpen) {
      setNoteName('')
    }
  }, [isOpen])

  const handleSubmit = () => {
    if (noteName.trim()) {
      onSubmit(noteName.trim())
      setNoteName('')
      onClose()
    }
  }

  const handleClose = () => {
    setNoteName('')
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
                <Text style={styles.title}>Add New Note</Text>
                <Pressable onPress={handleClose} style={styles.closeButton}>
                  <CloseIcon />
                </Pressable>
              </View>
              
              <View style={styles.body}>
                <TextInput
                  style={styles.input}
                  placeholder="Note name"
                  value={noteName}
                  onChangeText={setNoteName}
                  onSubmitEditing={handleSubmit}
                  autoFocus
                />
              </View>
              
              <View style={styles.footer}>
                <Pressable style={styles.buttonSecondary} onPress={handleClose}>
                  <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.buttonPrimary} onPress={handleSubmit}>
                  <Text style={styles.buttonPrimaryText}>Create</Text>
                </Pressable>
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
            <Text style={styles.title}>Add New Note</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <CloseIcon />
            </Pressable>
          </View>
          
          <View style={styles.body}>
            <TextInput
              style={styles.input}
              placeholder="Note name"
              value={noteName}
              onChangeText={setNoteName}
              onSubmitEditing={handleSubmit}
              autoFocus
            />
          </View>
          
          <View style={styles.footer}>
            <Pressable style={styles.buttonSecondary} onPress={handleClose}>
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.buttonPrimary} onPress={handleSubmit}>
              <Text style={styles.buttonPrimaryText}>Create</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2147483647,
      pointerEvents: 'none',
      width: '100vw',
      height: '100vh',
    }),
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
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
  },
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
  body: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f0f0f',
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

export default AddNoteModal

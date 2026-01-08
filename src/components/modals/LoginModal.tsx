import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, StyleSheet, Modal, Pressable, Platform, KeyboardAvoidingView, ScrollView, Keyboard } from 'react-native'
import { createPortal } from 'react-dom'
import { Svg, Line } from 'react-native-svg'
import { useAuthStore } from '../../stores/authStore'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

const CloseIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
)

function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { signIn, signUp, isLoading } = useAuthStore()
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const nameInputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setPassword('')
      setName('')
      setError(null)
      setIsLogin(true)
    }
  }, [isOpen])

  // Handle keyboard on web (mobile browsers)
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return

    const handleResize = () => {
      // Scroll the active input into view when keyboard appears
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        }, 100)
      }
    }

    // Prevent body scroll when modal is open on mobile
    if (window.innerWidth <= 768) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    }

    window.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
      if (window.innerWidth <= 768) {
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.width = ''
      }
    }
  }, [isOpen])

  const handleSubmit = async () => {
    setError(null)

    if (isLogin) {
      if (email.trim() && password.trim()) {
        try {
          await signIn(email.trim(), password.trim())
          handleClose()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to sign in'
          setError(errorMessage)
        }
      } else {
        setError('Please fill in all fields')
      }
    } else {
      if (email.trim() && password.trim() && name.trim()) {
        try {
          await signUp(email.trim(), password.trim(), name.trim())
          handleClose()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to sign up'
          setError(errorMessage)
        }
      } else {
        setError('Please fill in all fields')
      }
    }
  }

  const handleClose = () => {
    setEmail('')
    setPassword('')
    setName('')
    setIsLogin(true)
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
                <View style={styles.tabs}>
                  <Pressable
                    style={[styles.tab, isLogin && styles.tabActive]}
                    onPress={() => setIsLogin(true)}
                  >
                    <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Login</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tab, !isLogin && styles.tabActive]}
                    onPress={() => setIsLogin(false)}
                  >
                    <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Sign Up</Text>
                  </Pressable>
                </View>
                <Pressable onPress={handleClose} style={styles.closeButton}>
                  <CloseIcon />
                </Pressable>
              </View>
              
              <ScrollView 
                style={styles.bodyScroll}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {!isLogin && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      ref={nameInputRef}
                      style={styles.input}
                      placeholder="Enter your name"
                      value={name}
                      onChangeText={setName}
                      autoComplete="off"
                      returnKeyType="next"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                    />
                  </View>
                )}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    ref={emailInputRef}
                    style={styles.input}
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    autoComplete="email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.input}
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                </View>
                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </ScrollView>
              
              <View style={styles.footer}>
                <Pressable style={styles.buttonSecondary} onPress={handleClose} disabled={isLoading}>
                  <Text style={styles.buttonSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.buttonPrimary} onPress={handleSubmit} disabled={isLoading}>
                  <Text style={styles.buttonPrimaryText}>
                    {isLoading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
                  </Text>
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Pressable style={styles.overlayNative} onPress={handleClose}>
          <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <View style={styles.tabs}>
                <Pressable
                  style={[styles.tab, isLogin && styles.tabActive]}
                  onPress={() => setIsLogin(true)}
                >
                  <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Login</Text>
                </Pressable>
                <Pressable
                  style={[styles.tab, !isLogin && styles.tabActive]}
                  onPress={() => setIsLogin(false)}
                >
                  <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Sign Up</Text>
                </Pressable>
              </View>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <CloseIcon />
              </Pressable>
            </View>
            
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!isLogin && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    ref={nameInputRef}
                    style={styles.input}
                    placeholder="Enter your name"
                    value={name}
                    onChangeText={setName}
                    autoComplete="off"
                    returnKeyType="next"
                    onSubmitEditing={() => emailInputRef.current?.focus()}
                  />
                </View>
              )}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  ref={emailInputRef}
                  style={styles.input}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  autoComplete="email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>
            
            <View style={styles.footer}>
              <Pressable style={styles.buttonSecondary} onPress={handleClose} disabled={isLoading}>
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.buttonPrimary} onPress={handleSubmit} disabled={isLoading}>
                <Text style={styles.buttonPrimaryText}>
                  {isLoading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyScroll: {
    flexGrow: 0,
    maxHeight: 400,
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
  closeOverlay: {
    ...(Platform.OS === 'web' && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: -1,
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
  tabs: {
    flexDirection: 'row',
    flex: 1,
    gap: 0,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
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
  },
  tabTextActive: {
    color: '#0f0f0f',
    fontWeight: '400',
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  body: {
    padding: 20,
    gap: 16,
    ...(Platform.OS === 'web' && {
      minHeight: 'auto',
    }),
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '300',
    color: '#0f0f0f',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f0f0f',
    backgroundColor: '#ffffff',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ffe6e6',
    borderRadius: 4,
    marginTop: 8,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
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
    minWidth: 100,
  },
  buttonPrimaryText: {
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: '300',
    textAlign: 'center',
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

export default LoginModal

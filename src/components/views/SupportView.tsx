import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, Pressable, TextInput, Alert, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getApiBaseUrl } from '../../lib/platform'

interface SupportViewProps {
  onNavigate?: (view: string) => void
}

function SupportView({ onNavigate }: SupportViewProps) {
  const insets = useSafeAreaInsets()
  const windowWidth = Dimensions.get('window').width
  const isMobile = windowWidth <= 768
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const mobilePaddingTop = Platform.OS === 'ios' 
    ? Math.max(insets.top + 12, 20) 
    : Math.max(54, 20)

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('settings')
    } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.back()
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in all required fields')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/api/support/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        Alert.alert('Success', data.message || 'Support request sent successfully! We will get back to you soon.')
        setName('')
        setEmail('')
        setSubject('')
        setMessage('')
      } else {
        Alert.alert('Error', data.error || 'Failed to send support request. Please try again or email us directly.')
      }
    } catch (error) {
      Alert.alert(
        'Network Error',
        'Unable to send support request. Please check your connection and try again, or email us directly at surajgajula@thesfstudio.com'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailDirect = () => {
    const emailUrl = 'mailto:surajgajula@thesfstudio.com'
    if (Platform.OS === 'web') {
      window.location.href = emailUrl
    } else {
      Linking.openURL(emailUrl).catch(err => console.error('Failed to open email:', err))
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isMobile && {
            paddingTop: mobilePaddingTop,
            paddingLeft: 16,
            paddingRight: 20,
          }
        ]}
      >
        <View style={styles.content}>
          {isMobile && (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          )}
          
          <Text style={[
            styles.title,
            isMobile && styles.titleMobile
          ]}>Support</Text>
          
          <Text style={styles.subtitle}>Get help with Student Agent</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Us</Text>
            <Text style={styles.paragraph}>
              Have a question, issue, or feedback? Fill out the form below or email us directly.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#999"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Subject (optional)</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief subject"
                placeholderTextColor="#999"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Message *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Describe your question or issue..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
            </View>

            <Pressable
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Sending...' : 'Send Support Request'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alternative Contact</Text>
            <Text style={styles.paragraph}>
              You can also email us directly at:{' '}
              <Text style={styles.link} onPress={handleEmailDirect}>
                surajgajula@thesfstudio.com
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 100,
  },
  content: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#0f0f0f',
    fontWeight: '400',
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5,
    color: '#0f0f0f',
    marginBottom: 8,
  },
  titleMobile: {
    paddingLeft: 0,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '300',
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: -0.3,
    color: '#0f0f0f',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
    fontWeight: '300',
    marginBottom: 12,
  },
  form: {
    marginBottom: 32,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 12,
    fontSize: 15,
    color: '#333',
    minHeight: 44,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  submitButton: {
    backgroundColor: '#667eea',
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#667eea',
    textDecorationLine: 'underline',
  },
})

export default SupportView

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { getApiBaseUrl } from '../../lib/platform'

interface Capability {
  id: string
  description: string
  keywords: string[]
  requiredContext: string[]
  examples: string[]
}

function ChatHelpView() {
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const API_BASE_URL = getApiBaseUrl()
        const response = await fetch(`${API_BASE_URL}/api/capabilities`)
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || 'Failed to load capabilities')
        }
        setCapabilities(data.capabilities || [])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load capabilities'
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading chat commands...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Chat Commands</Text>
      <Text style={styles.subtitle}>
        Use these prompts in chat. Mention notes with @ to link them.
      </Text>
      {capabilities.map(cap => (
        <View key={cap.id} style={styles.card}>
          {cap.id === 'course_search' && (
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>BETA</Text>
            </View>
          )}
          <Text style={styles.capTitle}>{cap.id}</Text>
          <Text style={styles.capDescription}>{cap.description}</Text>
          {cap.id === 'course_search' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Supported schools / majors</Text>
              <Text style={styles.keywords}>
                Stanford (CS), Berkeley (CS), University of Waterloo (Engineering), Western University (Engineering)
              </Text>
            </View>
          )}
          {cap.examples?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Examples</Text>
              {cap.examples.map((ex, idx) => (
                <Text key={idx} style={styles.example}>• {ex}</Text>
              ))}
            </View>
          )}
          {cap.keywords?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Keywords</Text>
              <Text style={styles.keywords}>{cap.keywords.join(', ')}</Text>
            </View>
          )}
          {cap.requiredContext?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Context Needed</Text>
              <Text style={styles.keywords}>{cap.requiredContext.join(', ')}</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    color: '#555',
  },
  errorText: {
    color: '#c00',
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
    position: 'relative',
  },
  betaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  betaBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  capTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  capDescription: {
    fontSize: 14,
    color: '#444',
  },
  section: {
    marginTop: 4,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
  },
  example: {
    fontSize: 13,
    color: '#333',
  },
  keywords: {
    fontSize: 12,
    color: '#555',
  },
})

export default ChatHelpView


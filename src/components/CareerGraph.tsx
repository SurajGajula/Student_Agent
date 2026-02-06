import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions, Pressable } from 'react-native'
import type { SkillNode } from '../stores/careerStore'
import { getApiBaseUrl } from '../lib/platform'
import { useAuthStore } from '../stores/authStore'

interface CareerGraphProps {
  nodes: SkillNode[]
  careerPathId: string
  onSkillClick?: (skill: SkillNode) => void
  onNavigateToNote?: (noteId: string) => void
}

export default function CareerGraph({ nodes, careerPathId, onSkillClick, onNavigateToNote }: CareerGraphProps) {
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width)
  const { session } = useAuthStore()

  // Update window width on resize
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width)
    })
    return () => subscription?.remove()
  }, [])

  // Calculate number of columns based on screen width
  const isMobile = windowWidth <= 768
  const numColumns = windowWidth > 1200 ? 6 : windowWidth > 768 ? 4 : 2 // 2 columns on mobile
  // On mobile, use percentage-based width for reliable 2-column layout
  const cardWidth = isMobile 
    ? '48%' as any // ~48% width for 2 columns with gap
    : (windowWidth - 40 - (numColumns - 1) * 12) / numColumns // 40px padding, 12px gap

  const handleSkillClick = (skill: SkillNode) => {
    if (onSkillClick) {
      onSkillClick(skill)
    }
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
        contentContainerStyle={[styles.scrollContent, isMobile && { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.grid}>
          {nodes.map((node) => (
            <Pressable
              key={node.skill_id}
              style={[styles.skillCard, { width: cardWidth }]}
              onPress={() => handleSkillClick(node)}
            >
              <Text style={styles.skillName} numberOfLines={2}>
                {node.name}
              </Text>
            </Pressable>
          ))}
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
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
})

import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native'
import { useCareerStore, type SkillNode } from '../stores/careerStore'

interface SkillSelectorProps {
  selectedSkillIds: string[]
  onSelectionChange: (skillIds: string[]) => void
}

export default function SkillSelector({ selectedSkillIds, onSelectionChange }: SkillSelectorProps) {
  const { careerPaths } = useCareerStore()
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // Collect all unique skills from all career paths
  const allSkills = new Map<string, { skill: SkillNode; pathName: string }>()
  careerPaths.forEach(path => {
    path.nodes.forEach(node => {
      if (!allSkills.has(node.skill_id)) {
        allSkills.set(node.skill_id, { skill: node, pathName: `${path.role} at ${path.company}` })
      }
    })
  })

  const skillsArray = Array.from(allSkills.values())

  const togglePath = (pathId: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(pathId)) {
        next.delete(pathId)
      } else {
        next.add(pathId)
      }
      return next
    })
  }

  const toggleSkill = (skillId: string) => {
    const newSelection = selectedSkillIds.includes(skillId)
      ? selectedSkillIds.filter(id => id !== skillId)
      : [...selectedSkillIds, skillId]
    onSelectionChange(newSelection)
  }

  // Group skills by career path
  const skillsByPath = new Map<string, { path: typeof careerPaths[0]; skills: SkillNode[] }>()
  careerPaths.forEach(path => {
    skillsByPath.set(path.id, { path, skills: path.nodes })
  })

  if (careerPaths.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No career paths yet. Create one to tag notes with skills.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Associate Skills</Text>
      <Text style={styles.subtitle}>Tag this note with skills from your career paths</Text>
      
      {Array.from(skillsByPath.entries()).map(([pathId, { path, skills }]) => {
        const isExpanded = expandedPaths.has(pathId)
        const pathSelectedSkills = skills.filter(s => selectedSkillIds.includes(s.skill_id))
        
        return (
          <View key={pathId} style={styles.pathGroup}>
            <Pressable 
              style={styles.pathHeader}
              onPress={() => togglePath(pathId)}
            >
              <Text style={styles.pathName}>{path.role} at {path.company}</Text>
              <Text style={styles.pathToggle}>{isExpanded ? '−' : '+'}</Text>
            </Pressable>
            
            {isExpanded && (
              <View style={styles.skillsList}>
                {skills.map(skill => {
                  const isSelected = selectedSkillIds.includes(skill.skill_id)
                  return (
                    <Pressable
                      key={skill.skill_id}
                      style={[styles.skillItem, isSelected && styles.skillItemSelected]}
                      onPress={() => toggleSkill(skill.skill_id)}
                    >
                      <Text style={[styles.skillName, isSelected && styles.skillNameSelected]}>
                        {skill.name}
                      </Text>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </Pressable>
                  )
                })}
              </View>
            )}
            
            {pathSelectedSkills.length > 0 && !isExpanded && (
              <Text style={styles.selectedCount}>
                {pathSelectedSkills.length} skill{pathSelectedSkills.length !== 1 ? 's' : ''} selected
              </Text>
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: '#0f0f0f',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '300',
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
  pathGroup: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  pathHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  pathName: {
    fontSize: 16,
    fontWeight: '300',
    color: '#0f0f0f',
    flex: 1,
  },
  pathToggle: {
    fontSize: 20,
    fontWeight: '300',
    color: '#0f0f0f',
    width: 24,
    textAlign: 'center',
  },
  skillsList: {
    padding: 8,
  },
  skillItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginBottom: 4,
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
  },
  skillItemSelected: {
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#0f0f0f',
  },
  skillName: {
    fontSize: 14,
    fontWeight: '300',
    color: '#0f0f0f',
    flex: 1,
  },
  skillNameSelected: {
    fontWeight: '400',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '400',
    color: '#0f0f0f',
    marginLeft: 8,
  },
  selectedCount: {
    fontSize: 12,
    fontWeight: '300',
    color: '#666',
    padding: 8,
    paddingTop: 4,
  },
})

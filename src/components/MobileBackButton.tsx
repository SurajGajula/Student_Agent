import { View, StyleSheet, Pressable, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BackIcon } from './icons'

interface MobileBackButtonProps {
  onPress: () => void
}

function MobileBackButton({ onPress }: MobileBackButtonProps) {
  const insets = useSafeAreaInsets()
  const topOffset = Platform.OS === 'ios' ? insets.top + 8 : 50
  
  return (
    <Pressable 
      style={[styles.button, { top: topOffset }]}
      onPress={onPress}
      accessibilityLabel="Go back"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.iconContainer}>
        <BackIcon />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 16,
    zIndex: 1002, // Higher than MobileMenuButton (1001) to ensure it appears on top
    padding: 8,
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      zIndex: 1002,
    }),
  } as any,
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default MobileBackButton


import { View, StyleSheet, Pressable, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Svg, Line } from 'react-native-svg'

interface MobileMenuButtonProps {
  onPress: () => void
  isOpen: boolean
}

function MobileMenuButton({ onPress, isOpen }: MobileMenuButtonProps) {
  const insets = useSafeAreaInsets()
  const topOffset = Platform.OS === 'ios' ? insets.top + 8 : 50
  
  return (
    <Pressable 
      style={[styles.button, { top: topOffset }]}
      onPress={onPress}
      accessibilityLabel={isOpen ? "Close menu" : "Open menu"}
      accessibilityState={{ expanded: isOpen }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.iconContainer}>
        {isOpen ? (
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Line x1="18" y1="6" x2="6" y2="18" />
            <Line x1="6" y1="6" x2="18" y2="18" />
          </Svg>
        ) : (
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <Line x1="3" y1="12" x2="21" y2="12" />
            <Line x1="3" y1="6" x2="21" y2="6" />
            <Line x1="3" y1="18" x2="21" y2="18" />
          </Svg>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 16,
    zIndex: 1001,
    padding: 8,
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      zIndex: 1001,
    }),
  } as any,
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default MobileMenuButton

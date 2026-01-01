import { Platform, Alert, Linking } from 'react-native'

/**
 * Platform-aware alert dialog
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title)
  } else {
    Alert.alert(title, message, buttons)
  }
}

/**
 * Platform-aware confirm dialog
 * Returns a promise that resolves to true if confirmed, false if cancelled
 */
export function showConfirm(title: string, message?: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      const result = window.confirm(message ? `${title}\n\n${message}` : title)
      resolve(result)
    } else {
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'OK',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      )
    }
  })
}

/**
 * Platform-aware URL opening
 */
export async function openURL(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.location.href = url
  } else {
    const supported = await Linking.canOpenURL(url)
    if (supported) {
      await Linking.openURL(url)
    } else {
      throw new Error(`Cannot open URL: ${url}`)
    }
  }
}

/**
 * Platform-aware image picker
 * Returns a promise that resolves to a file/blob (web) or image URI (native)
 */
export async function pickImage(): Promise<File | string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0] || null
        resolve(file)
      }
      input.oncancel = () => {
        resolve(null)
      }
      input.click()
    })
  } else {
    // Native implementation - will need react-native-image-picker
    // For now, return null and let the component handle it
    // TODO: Implement with react-native-image-picker
    throw new Error('Image picker not yet implemented for native. Please install react-native-image-picker.')
  }
}


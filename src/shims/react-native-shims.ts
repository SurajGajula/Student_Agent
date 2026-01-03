// Shim for React Native Fabric imports that don't exist in react-native-web
// These are only needed for native code generation, not for web

export default function codegenNativeComponent<T>(_componentName: string, _options?: any): T {
  // Return a no-op component for web
  return (() => null) as unknown as T
}


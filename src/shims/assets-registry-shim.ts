// Shim for @react-native/assets-registry that doesn't exist in react-native-web
// This is only needed for resolving asset URIs on native platforms

export function getAssetByID(assetId: number): any {
  return null
}

export function registerAsset(asset: any): number {
  return 0
}

export default {
  getAssetByID,
  registerAsset,
}


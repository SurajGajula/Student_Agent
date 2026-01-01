import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius } from './theme';

export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Button styles
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  
  buttonPrimary: {
    backgroundColor: colors.text,
  },
  
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  buttonText: {
    ...typography.body,
    color: colors.textLight,
  },
  
  buttonTextSecondary: {
    ...typography.body,
    color: colors.text,
  },
  
  // Card styles
  card: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  // Input styles
  input: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    ...typography.body,
    color: colors.text,
  },
  
  // Text styles
  text: {
    ...typography.body,
    color: colors.text,
  },
  
  textSecondary: {
    ...typography.small,
    color: colors.textSecondary,
  },
  
  heading: {
    ...typography.h1,
    color: colors.text,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    width: Platform.OS === 'web' ? '90%' : '95%',
    maxWidth: 500,
    padding: 0,
  },
});


// Loading, empty and error states with 44 px tap targets. Screens render these instead of their own one-offs.
import React from 'react';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { View } from 'react-native';

const box = { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 } as const;
export const MIN_TAP = 44;

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <View style={box} accessible accessibilityRole="progressbar" accessibilityLabel={label}><ActivityIndicator animating /></View>;
}

export function Empty({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={box}>
      <Text variant="bodyLarge">{message}</Text>
      {actionLabel && onAction ? <Button mode="contained" onPress={onAction} style={{ minHeight: MIN_TAP }}>{actionLabel}</Button> : null}
    </View>
  );
}

/** Shows a generic message, never the raw error text from a failed call. */
export function ErrorState({ message = 'Something went wrong.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={box} accessible accessibilityRole="alert">
      <Text variant="bodyLarge">{message}</Text>
      {onRetry ? <Button mode="contained" onPress={onRetry} style={{ minHeight: MIN_TAP }}>Try again</Button> : null}
    </View>
  );
}

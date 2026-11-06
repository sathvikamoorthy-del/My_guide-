import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useAuth } from '../../src/auth/AuthProvider';
import { MIN_TAP } from '../../src/ui/StateViews';

export default function Settings() {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text variant="titleLarge">Settings</Text>
      <Button mode="outlined" onPress={() => { void signOut(); }} style={{ minHeight: MIN_TAP }}>Sign out</Button>
    </View>
  );
}

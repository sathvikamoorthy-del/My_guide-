import { Link } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
export default function NotFound() {
    return (<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text variant="titleLarge">Page not found</Text>
      <Link href="/" style={{ minHeight: 44 }}>Go home</Link>
    </View>);
}

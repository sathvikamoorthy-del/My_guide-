import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../../src/auth/AuthProvider';
import { signInMessage } from '../../src/auth/signInMessage';
import { MIN_TAP } from '../../src/ui/StateViews';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError('');
    try { await signIn(email.trim(), password); }
    catch (e) { setError(signInMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text variant="headlineMedium">Sign in</Text>
      <TextInput label="Email" accessibilityLabel="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextInput label="Password" accessibilityLabel="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      <Button mode="contained" onPress={submit} loading={busy} disabled={busy || !email || !password} style={{ minHeight: MIN_TAP }}>Sign in</Button>
    </View>
  );
}

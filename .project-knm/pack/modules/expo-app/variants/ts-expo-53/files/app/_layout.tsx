// Root layout: providers from the scaffold glue (first = outermost), the Paper theme, and the auth gate.
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { providers } from '../src/app/providers';
import { gateRedirect } from '../src/auth/authGate';
import { useAuth } from '../src/auth/AuthProvider';
import { Loading } from '../src/ui/StateViews';

function Gate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const to = gateRedirect(status, segments);
  useEffect(() => { if (to) router.replace(to as never); }, [to, router]);
  return status === 'loading' ? <Loading /> : <Slot />;
}

export default function RootLayout() {
  const inner = (
    <PaperProvider>
      <StatusBar style="auto" />
      <Gate />
    </PaperProvider>
  );
  return <>{[...providers].reverse().reduce((child, p: { id: string; component: React.ComponentType<{ children?: React.ReactNode }> }) => <p.component>{child}</p.component>, inner)}</>;
}

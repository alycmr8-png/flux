import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "../lib/tokenCache";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { loadI18n } from "../lib/i18n";

function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuth = segments[0] === "(auth)";
    if (!isSignedIn && !inAuth) router.replace("/(auth)/sign-in");
    if (isSignedIn && inAuth) router.replace("/(tabs)");
  }, [isSignedIn, isLoaded]);

  return <Slot />;
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    loadI18n().finally(() => setI18nReady(true));
  }, []);

  if (!i18nReady) return null;

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <AuthGate />
    </ClerkProvider>
  );
}

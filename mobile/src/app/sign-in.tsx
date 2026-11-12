import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { TextField } from "@/components/fields";
import { Screen } from "@/components/layout";
import { Text } from "@/components/Text";
import { auth, AuthError } from "@/lib/auth";
import { useApp } from "@/providers/app";
import { useTheme } from "@/theme";

export default function SignIn() {
  const { onSignedIn } = useApp();
  const { colors } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [challenge, setChallenge] = useState<{ session: string; username: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (challenge) {
        await auth.completeNewPassword(challenge.username, newPassword, challenge.session);
        onSignedIn();
      } else {
        const r = await auth.signIn(username.trim(), password);
        if (r.kind === "new_password_required") setChallenge(r);
        else onSignedIn();
      }
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen>
        <View style={{ gap: 8, marginTop: 48, marginBottom: 16 }}>
          <Text variant="display" color={colors.accent}>
            Atelier
          </Text>
          <Text muted>Your jewelry records — available offline, synced when you are connected.</Text>
        </View>
        {challenge ? (
          <>
            <Text>Choose a new password to finish setting up your account.</Text>
            <TextField
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              hint="At least 8 characters."
            />
          </>
        ) : (
          <>
            <TextField
              testID="sign-in-username"
              label="Username or email"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
            />
            <TextField
              testID="sign-in-password"
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submit}
            />
          </>
        )}
        {error ? (
          <Text color={colors.danger} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}
        <Button
          testID="sign-in-submit"
          label={challenge ? "Set password" : "Sign in"}
          onPress={submit}
          busy={busy}
          disabled={challenge ? newPassword.length < 8 : !username || !password}
        />
      </Screen>
    </SafeAreaView>
  );
}

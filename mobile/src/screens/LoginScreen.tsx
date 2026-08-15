import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';
import { messageOf } from '../lib/errors';
import { colors, fontSize, spacing } from '../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.replace('/(tabs)/fields');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Chào mừng trở lại</Text>
        <Text style={styles.subheading}>Đăng nhập để đặt sân và thi đấu</Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="ban@example.com"
        />
        <TextField
          label="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="••••••••"
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          title="Đăng nhập"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />

        <Link href="/(auth)/forgot-password" style={styles.link}>
          Quên mật khẩu?
        </Link>
        <Link href="/(auth)/register" style={styles.link}>
          Chưa có tài khoản? Đăng ký
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.xl },
  heading: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  subheading: { color: colors.textMuted, marginBottom: spacing.xl, marginTop: spacing.xs },
  error: { color: colors.danger, marginBottom: spacing.lg },
  link: { color: colors.primary, marginTop: spacing.lg, textAlign: 'center' },
});

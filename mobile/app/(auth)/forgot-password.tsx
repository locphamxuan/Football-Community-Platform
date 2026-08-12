import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, TextField } from '../../src/components/ui';
import { authService } from '../../src/services/auth.service';
import { messageOf } from '../../src/lib/errors';
import { colors, fontSize, spacing } from '../../src/lib/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Quên mật khẩu</Text>
        <Text style={styles.subheading}>
          {sent
            // Backend cố tình trả cùng một câu cho mọi email để không tiết lộ email nào có tài khoản.
            ? 'Nếu email này có tài khoản, liên kết đặt lại mật khẩu đã được gửi tới đó.'
            : 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.'}
        </Text>

        {!sent && (
          <>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button
              title="Gửi liên kết"
              onPress={onSubmit}
              disabled={!email.trim()}
              loading={submitting}
            />
          </>
        )}

        {sent && <Button title="Về màn đăng nhập" onPress={() => router.replace('/(auth)/login')} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  heading: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  subheading: { color: colors.textMuted, marginBottom: spacing.xl, marginTop: spacing.xs },
  error: { color: colors.danger, marginBottom: spacing.lg },
});

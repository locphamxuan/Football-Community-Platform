import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, TextField } from '../components/ui';
import { authService } from '../services/auth.service';
import { messageOf } from '../lib/errors';
import { colors, fontSize, spacing } from '../theme';

/** Cùng luật với backend (auth.validation.js): ≥ 8 ký tự, có chữ hoa và có số. */
const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function RegisterScreen() {
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const passwordError =
    form.password.length > 0 && !PASSWORD_RULE.test(form.password)
      ? 'Ít nhất 8 ký tự, có chữ hoa và số'
      : undefined;

  const canSubmit =
    form.fullName.trim() && form.username.trim() && form.email.trim() && !passwordError && form.password;

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await authService.register({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      setDone(true);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Kiểm tra email của bạn</Text>
        <Text style={styles.subheading}>
          Chúng tôi đã gửi liên kết xác minh tới {form.email.trim()}. Xác minh xong mới đăng nhập được.
        </Text>
        <Button title="Về màn đăng nhập" onPress={() => router.replace('/(auth)/login')} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Tạo tài khoản</Text>
        <Text style={styles.subheading}>Vài bước là bắt đầu đá được</Text>

        <TextField label="Họ và tên" value={form.fullName} onChangeText={set('fullName')} />
        <TextField
          label="Tên đăng nhập"
          value={form.username}
          onChangeText={set('username')}
          autoCapitalize="none"
        />
        <TextField
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField
          label="Số điện thoại (không bắt buộc)"
          value={form.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
        />
        <TextField
          label="Mật khẩu"
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
          error={passwordError}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          title="Đăng ký"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />

        <Link href="/(auth)/login" style={styles.link}>
          Đã có tài khoản? Đăng nhập
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

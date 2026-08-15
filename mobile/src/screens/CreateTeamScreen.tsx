import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Button, TextField } from '../components/ui';
import ChipRow from '../components/ChipRow';
import RequireAuth from '../components/RequireAuth';
import { teamService } from '../services/team.service';
import { messageOf } from '../lib/errors';
import { colors, fontSize, spacing } from '../theme';

const SKILL_OPTIONS = [
  { value: 'beginner', label: 'Mới chơi' },
  { value: 'intermediate', label: 'Trung bình' },
  { value: 'advanced', label: 'Khá' },
  { value: 'professional', label: 'Chuyên nghiệp' },
];

const SIZE_OPTIONS = [
  { value: '5v5', label: '5v5' },
  { value: '7v7', label: '7v7' },
  { value: '11v11', label: '11v11' },
];

function CreateTeamForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [description, setDescription] = useState('');
  const [skillLevel, setSkillLevel] = useState('intermediate');
  const [fieldSize, setFieldSize] = useState('7v7');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      teamService.create({
        name: name.trim(),
        homeCity: homeCity.trim(),
        description: description.trim(),
        skillLevel,
        fieldSize,
      }),
    onSuccess: ({ team }) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      router.replace(`/teams/${team._id}`);
    },
    onError: (err) => setError(messageOf(err)),
  });

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Tạo đội bóng</Text>
      <Text style={styles.subheading}>Người tạo đội trở thành quản lý và nhận mã mời.</Text>

      <TextField label="Tên đội" value={name} onChangeText={setName} placeholder="FC Sân Chiều" />
      <TextField
        label="Thành phố"
        value={homeCity}
        onChangeText={setHomeCity}
        placeholder="Hà Nội"
      />
      <TextField
        label="Giới thiệu (không bắt buộc)"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <ChipRow label="Trình độ" options={SKILL_OPTIONS} value={skillLevel} onChange={setSkillLevel} />
      <ChipRow label="Cỡ sân" options={SIZE_OPTIONS} value={fieldSize} onChange={setFieldSize} />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        title="Tạo đội"
        onPress={() => {
          setError(null);
          create.mutate();
        }}
        disabled={!name.trim()}
        loading={create.isPending}
      />
    </ScrollView>
  );
}

export default function CreateTeamScreen() {
  return (
    <RequireAuth message="Đăng nhập để tạo đội bóng của bạn.">
      <CreateTeamForm />
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  heading: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  subheading: { color: colors.textMuted, marginBottom: spacing.xl, marginTop: spacing.xs },
  error: { color: colors.danger, marginBottom: spacing.md },
});

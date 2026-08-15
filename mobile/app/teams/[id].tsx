import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/ui';
import TeamDetailScreen from '../../src/screens/TeamDetailScreen';

export default function TeamDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <TeamDetailScreen teamId={id} />
    </Screen>
  );
}

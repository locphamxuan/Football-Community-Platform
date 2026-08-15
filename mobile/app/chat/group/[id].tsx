import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/ui';
import GroupInfoScreen from '../../../src/screens/GroupInfoScreen';

export default function GroupInfoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <GroupInfoScreen conversationId={id} />
    </Screen>
  );
}

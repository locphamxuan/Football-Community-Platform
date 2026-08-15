import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/ui';
import NewChatScreen from '../../src/screens/NewChatScreen';

export default function NewChatRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  return (
    <Screen>
      <NewChatScreen mode={mode === 'group' ? 'group' : 'direct'} />
    </Screen>
  );
}

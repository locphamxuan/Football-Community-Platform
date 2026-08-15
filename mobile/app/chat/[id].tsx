import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/ui';
import ChatThreadScreen from '../../src/screens/ChatThreadScreen';

export default function ChatThreadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <ChatThreadScreen conversationId={id} />
    </Screen>
  );
}

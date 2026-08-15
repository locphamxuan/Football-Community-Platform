import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/ui';
import BookFieldScreen from '../../../src/screens/BookFieldScreen';

export default function BookFieldRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <BookFieldScreen fieldId={id} />
    </Screen>
  );
}

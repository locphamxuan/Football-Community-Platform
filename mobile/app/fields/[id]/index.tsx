import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/ui';
import FieldDetailScreen from '../../../src/screens/FieldDetailScreen';

export default function FieldDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <FieldDetailScreen fieldId={id} />
    </Screen>
  );
}

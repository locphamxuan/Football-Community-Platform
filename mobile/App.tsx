import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import PlansScreen from './src/screens/PlansScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <PlansScreen />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

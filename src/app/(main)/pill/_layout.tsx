import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function PillLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}

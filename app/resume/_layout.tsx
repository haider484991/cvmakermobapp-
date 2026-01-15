import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function ResumeRootLayout() {
    const { colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="[id]" />
        </Stack>
    );
}

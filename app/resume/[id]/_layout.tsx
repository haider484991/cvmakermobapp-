import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function ResumeLayout() {
    const { colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="edit" />
            <Stack.Screen name="preview" />
            <Stack.Screen name="export" />
            <Stack.Screen name="tailor" />
            <Stack.Screen name="cover-letter" />
            <Stack.Screen name="versions" />
        </Stack>
    );
}

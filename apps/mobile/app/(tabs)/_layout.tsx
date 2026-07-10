import {Tabs} from 'expo-router';
import {TrendingUp, Briefcase, Wallet} from 'lucide-react-native';
import {colors} from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {backgroundColor: colors.background},
        headerTintColor: colors.foreground,
        tabBarStyle: {backgroundColor: colors.card, borderTopColor: colors.border},
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Markets',
          tabBarIcon: ({color, size}) => <TrendingUp color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({color, size}) => <Briefcase color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({color, size}) => <Wallet color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

import { TabBar } from '@sigmela/router';

import { ChatScreen } from '../screens/ChatScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { homeStack, settingsStack, catalogStack, ordersStack, userStack } from './stacks';

export const tabBar = new TabBar({
  tabBarStyle: {
    backgroundColor: '#ffffff',
  },
  tabBarItemStyle: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabBarActiveTintColor: '#007AFF',
  tabBarInactiveTintColor: '#999999',
  hapticFeedbackEnabled: true,
  labeled: true,
})
  .addTab({
    stack: homeStack,
    title: 'Home',
    icon: { sfSymbol: 'house' },
  })
  .addTab({
    stack: settingsStack,
    title: 'Settings',
    icon: { sfSymbol: 'gearshape' },
  })
  .addTab({
    stack: catalogStack,
    title: 'Catalog',
    icon: { sfSymbol: 'bag' },
  })
  .addTab({
    stack: ordersStack,
    title: 'Orders',
    icon: { sfSymbol: 'calendar' },
  })
  .addTab({
    stack: userStack,
    title: 'Users',
    icon: { sfSymbol: 'person.3' },
  })
  .addTab({
    screen: ChatScreen,
    title: 'Chat',
    icon: { sfSymbol: 'message' },
    badge: '5',
  })
  .addTab({
    screen: ProfileScreen,
    title: 'Profile',
    icon: { sfSymbol: 'person.circle' },
  });

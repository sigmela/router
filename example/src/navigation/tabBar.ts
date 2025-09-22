import { TabBar } from '@sigmela/router';
import { homeStack, settingsStack, catalogStack, ordersStack } from './stacks';

export const tabBar = new TabBar()
  .addTab({
    key: 'home',
    stack: homeStack,
    title: 'Home',
    icon: { sfSymbolName: 'house' },
  })
  .addTab({
    key: 'settings',
    stack: settingsStack,
    title: 'Settings',
    icon: { sfSymbolName: 'gearshape' },
  })
  .addTab({
    key: 'catalog',
    stack: catalogStack,
    title: 'Catalog',
    icon: { sfSymbolName: 'bag' },
  })
  .addTab({
    key: 'orders',
    stack: ordersStack,
    title: 'Orders',
    icon: { sfSymbolName: 'list.bullet' },
  });

import { TabBar } from '@sigmela/router';
// import { CustomIosTabBar } from '../components/CustomIosTabBar';
import { homeStack, settingsStack, catalogStack, ordersStack } from './stacks';

export const tabBar = new TabBar({ component: undefined })
  .addTab({
    key: 'home',
    stack: homeStack,
    title: 'Home',
    icon: require('../../assets/icons/ic-more-h-circle-24.png'),
  })
  .addTab({
    key: 'catalog',
    stack: catalogStack,
    title: 'Catalog',
    icon: require('../../assets/icons/ic-products-outline-24.png'),
  })
  .addTab({
    key: 'orders',
    stack: ordersStack,
    title: 'Orders',
    icon: require('../../assets/icons/ic-orders-24.png'),
  })
  .addTab({
    key: 'settings',
    stack: settingsStack,
    title: 'Settings',
    icon: require('../../assets/icons/ic-settings-outline-24.png'),
  });

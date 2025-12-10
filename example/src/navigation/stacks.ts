import { NavigationStack } from '@sigmela/router';

import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { ProductScreen } from '../screens/ProductScreen';
import { AuthRootScreen } from '../screens/AuthRootScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { UserScreen, UserDetailsScreen } from '../screens/UserScreen';
import { EmailAuthModal } from '../screens/EmailAuthModal';
import { SmsAuthModal } from '../screens/SmsAuthModal';
import { GenericAuthModal } from '../screens/GenericAuthModal';
import { PromoModal } from '../screens/PromoModal';
import { AuthScreen } from '../screens/AuthScreen';
import { TabBar } from '@sigmela/router';

export const homeStack = new NavigationStack().addScreen('/', HomeScreen, {
  header: { title: 'Home' },
});

export const catalogStack = new NavigationStack()
  .addScreen('/catalog', CatalogScreen, {
    header: { title: 'Catalog' },
  })
  .addScreen('/catalog/products/:productId', ProductScreen, {
    header: { title: 'Product' },
  });

export const settingsStack = new NavigationStack().addScreen(
  '/settings',
  SettingsScreen,
  {
    header: { title: 'Settings' },
  }
);

// Used in ProfileScreen.tsx
export const authStack = new NavigationStack()
  .addModal('/auth', AuthRootScreen, {
    header: { title: 'Login', hidden: true },
  })
  .addModal('/auth?kind=email', EmailAuthModal, {
    header: { title: 'Email login' },
  })
  .addModal('/auth?kind=sms', SmsAuthModal, {
    header: { title: 'SMS login' },
  })
  .addModal('/auth?kind=:kind', GenericAuthModal);

export const ordersStack = new NavigationStack()
  .addScreen('/orders', OrdersScreen, {
    header: { title: 'Orders' },
  })
  .addScreen('/orders/:year/:month', OrdersScreen, {
    header: { title: 'Orders' },
  });

// Exported for potential future use
export const userStack = new NavigationStack()
  .addScreen('/users/:userId', UserScreen, { header: { title: 'User' } })
  .addScreen('/users/:userId/details', UserDetailsScreen, {
    header: { title: 'Details' },
  });

export function getRootStack() {
  const tabBar = new TabBar({ component: undefined })
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

  const rootStack = new NavigationStack()
    .addScreen('/', tabBar)
    .addScreen('/auth', AuthScreen, {
      header: { title: 'Login', hidden: true },
    })
    .addModal('/auth?kind=email', EmailAuthModal, {
      header: { title: 'Email login' },
    })
    .addModal('/auth?kind=sms', SmsAuthModal, {
      // syncWithUrl: true,
      header: { title: 'SMS login' },
    })
    .addModal('/auth?kind=:kind', GenericAuthModal)
    .addModal('*?modal=promo', PromoModal);

  return rootStack;
}

// Ensure exported stacks are considered used by TypeScript
// These are used in other files (ProfileScreen.tsx, tabBar.ts)
void authStack;
void userStack;

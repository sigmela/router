import { NavigationStack } from '@sigmela/router';

import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { ProductScreen } from '../screens/ProductScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { AuthRootScreen } from '../screens/AuthRootScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { UserScreen, UserDetailsScreen } from '../screens/UserScreen';

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

export const globalStack = new NavigationStack().addSheet('/auth', AuthScreen, {
  header: { title: 'Sign in' },
});

export const ordersStack = new NavigationStack()
  .addScreen('/orders', OrdersScreen, {
    header: { title: 'Orders' },
  })
  .addScreen('/orders/:year/:month', OrdersScreen, {
    header: { title: 'Orders' },
  });

export const userStack = new NavigationStack()
  .addScreen('/users/:userId', UserScreen, { header: { title: 'User' } })
  .addScreen('/users/:userId/details', UserDetailsScreen, {
    header: { title: 'Details' },
  });

export const authStack = new NavigationStack().addScreen(
  '/login',
  AuthRootScreen,
  {
    header: { title: 'Login', hidden: true },
  }
);

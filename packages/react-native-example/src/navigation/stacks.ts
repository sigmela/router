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
  headerConfig: { title: 'Home' },
});

export const catalogStack = new NavigationStack()
  .addScreen('/catalog', CatalogScreen, {
    headerConfig: { title: 'Catalog' },
  })
  .addScreen('/catalog/products/:productId', ProductScreen, {
    headerConfig: { title: 'Product' },
  });

export const settingsStack = new NavigationStack().addScreen('/settings', SettingsScreen, {
  headerConfig: { title: 'Settings' },
});

export const globalStack = new NavigationStack().addScreen('/auth', AuthScreen, {
  stackPresentation: 'modal',
  headerConfig: { title: 'Sign in', hidden: false },
});

export const ordersStack = new NavigationStack().addScreen(
  '/orders/:year/:month',
  OrdersScreen,
  { headerConfig: { title: 'Orders' } },
);

export const userStack = new NavigationStack()
  .addScreen('/users/:userId', UserScreen, { headerConfig: { title: 'User' } })
  .addScreen('/users/:userId/details', UserDetailsScreen, { headerConfig: { title: 'Details' } });

export const authStack = new NavigationStack().addScreen('/login', AuthRootScreen, {
  headerConfig: { title: 'Login', hidden: true },
});


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

export const globalStack = new NavigationStack()
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

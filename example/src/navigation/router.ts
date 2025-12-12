import { Router } from '@sigmela/router';
import { authStack, getRootStack } from './stacks';

export const router = new Router({
  roots: {
    app: getRootStack(),
    auth: authStack,
  },
  // Demo: start from auth root, then switch to app on login.
  root: 'auth',
  debug: true,
});

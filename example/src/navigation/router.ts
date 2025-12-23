import { Router } from '@sigmela/router';
import { authStack, getRootStack } from './stacks';

export const router = new Router({
  roots: {
    app: getRootStack(),
    auth: authStack,
  },
  // Start from app root (main navigation with tabs)
  root: 'app',
  debug: true,
});

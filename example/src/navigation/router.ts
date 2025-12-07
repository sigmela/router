import { Router } from '@sigmela/router';
import { globalStack } from './stacks';
import { tabBar } from './tabBar';

export const router = new Router({
  root: tabBar,
  global: globalStack,
  debug: true,
});

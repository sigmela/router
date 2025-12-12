import { Router } from '@sigmela/router';
import { getRootStack } from './stacks';

export const router = new Router({
  root: getRootStack(),
  debug: true,
});

import { Router } from '@sigmela/router';
import { rootStack } from './stacks';

export const router = new Router({
  root: rootStack,
  debug: true,
});

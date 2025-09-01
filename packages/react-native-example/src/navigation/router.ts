import { Router } from '@sigmela/router';
import { globalStack, authStack } from './stacks';

export const router = new Router({ root: authStack, global: globalStack });

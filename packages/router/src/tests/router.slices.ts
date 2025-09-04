import assert from 'node:assert';
import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import { TabBar } from '../TabBar/TabBar';
import { createController } from '../createController';

// Dummy components (placeholders)
const ScreenA: React.ComponentType<any> = () => null;
const ScreenB: React.ComponentType<any> = () => null;
const ScreenAuth: React.ComponentType<any> = () => null;

function run() {
  // Build stacks
  const stackA = new NavigationStack()
    .addScreen('/a', ScreenA)
    .addScreen('/a/one', ScreenA)
    .addScreen('/a/two', ScreenA);

  const stackB = new NavigationStack()
    .addScreen('/b', ScreenB)
    .addScreen('/b/one', ScreenB)
    .addScreen('/b/two', ScreenB);

  const globalStack = new NavigationStack().addScreen('/auth', ScreenAuth, {
    stackPresentation: 'modal',
  });

  // Build TabBar-like
  const tabBar = new TabBar()
    .addTab({ stack: stackA, title: 'A' })
    .addTab({ stack: stackB, title: 'B' });

  // Create router
  const router = new Router({ root: tabBar as any, global: globalStack });

  // After seed: first tab should have 1 item, second empty
  const aId = stackA.getId();
  const bId = stackB.getId();
  const gId = globalStack.getId();

  assert.equal(router.getStackHistory(aId).length, 1, 'Tab A should seed first route');
  assert.equal(router.getStackHistory(bId).length, 0, 'Tab B should be empty initially');

  // Open more in Tab A
  router.navigate('/a/one');
  router.navigate('/a/two');
  assert.equal(router.getStackHistory(aId).length, 3, 'Tab A should have 3 items');
  // Duplicate navigate should not push
  router.navigate('/a/two');
  assert.equal(router.getStackHistory(aId).length, 3, 'Duplicate navigate on Tab A is ignored');

  // Switch to Tab B by navigating to B route
  router.navigate('/b');
  assert.equal(router.getActiveTabIndex(), 1, 'Active tab should be B');
  assert.equal(router.getStackHistory(bId).length, 1, 'Tab B should seed first route');

  // Open more in Tab B
  router.navigate('/b/one');
  router.navigate('/b/two');
  assert.equal(router.getStackHistory(bId).length, 3, 'Tab B should have 3 items');

  // Open global overlay
  router.navigate('/auth');
  assert.equal(router.getStackHistory(gId).length, 1, 'Global should have 1 item');
  // Duplicate global navigate should not push
  router.navigate('/auth');
  assert.equal(router.getStackHistory(gId).length, 1, 'Duplicate global navigate is ignored');

  // Close global overlay
  router.goBack();
  assert.equal(router.getStackHistory(gId).length, 0, 'Global should be empty after back');

  // Verify both tabs preserved their stacks
  assert.equal(router.getStackHistory(aId).length, 3, 'Tab A items preserved');
  assert.equal(router.getStackHistory(bId).length, 3, 'Tab B items preserved');

  // Active tab remains B (goBack on global does not switch tabs)
  assert.equal(router.getActiveTabIndex(), 1, 'Active tab should remain B');

  // goBack on tab B should pop within B until seed remains
  router.goBack();
  assert.equal(router.getStackHistory(bId).length, 2, 'Tab B popped to 2');
  router.goBack();
  assert.equal(router.getStackHistory(bId).length, 1, 'Tab B popped to seed');
  router.goBack();
  assert.equal(
    router.getStackHistory(bId).length,
    1,
    'Tab B seed is protected from popping',
  );

  // Switch to tab B via index and validate pop after an extra push
  router.setActiveTabIndex(1);
  router.navigate('/b/one');
  assert.equal(router.getStackHistory(bId).length, 2, 'Tab B prepared to 2');
  router.goBack();
  assert.equal(router.getStackHistory(bId).length, 1, 'Tab B popped back to seed');

  // Root-only scenario
  const rootOnly = new NavigationStack().addScreen('/r', ScreenA).addScreen('/r/next', ScreenA);
  const router2 = new Router({ root: rootOnly });
  const rId = rootOnly.getId();
  assert.equal(router2.getStackHistory(rId).length, 1, 'Root-only seeded');
  router2.navigate('/r/next');
  assert.equal(router2.getStackHistory(rId).length, 2, 'Root-only pushed');
  // Duplicate root navigate should not push
  router2.navigate('/r/next');
  assert.equal(router2.getStackHistory(rId).length, 2, 'Duplicate root navigate ignored');
  router2.goBack();
  assert.equal(router2.getStackHistory(rId).length, 1, 'Root-only popped to seed');
  router2.goBack();
  assert.equal(router2.getStackHistory(rId).length, 1, 'Root-only seed protected');

  // Global overlay with empty root slice below
  const router3 = new Router({ root: rootOnly, global: globalStack });
  const r3Id = rootOnly.getId();
  router3.navigate('/auth');
  assert.equal(router3.getStackHistory(gId).length, 1, 'Global added over root-only');
  router3.goBack();
  assert.equal(router3.getStackHistory(gId).length, 0, 'Global popped over root-only');
  assert.equal(router3.getStackHistory(r3Id).length, 1, 'Root-only seed remains');

  // setRoot transitions and reseed behavior
  const authRoot = new NavigationStack().addScreen('/login', ScreenAuth);
  const router5 = new Router({ root: authRoot });
  let rootChanges = 0;
  const unsub = router5.subscribeRoot(() => {
    rootChanges += 1;
  });
  // Initially root-only seeded
  const r5Id = authRoot.getId();
  assert.equal(router5.hasTabBar(), false, 'No tab bar initially');
  assert.equal(router5.getStackHistory(r5Id).length, 1, 'Auth seeded');

  const newTabBar = new TabBar().addTab({ stack: stackA, title: 'A' }).addTab({ stack: stackB, title: 'B' });
  router5.setRoot(newTabBar as any, { transition: 'fade' });
  assert.equal(router5.hasTabBar(), true, 'Switched to tab bar');
  assert.equal(router5.getRootTransition(), 'fade', 'Root transition applied to tab bar');
  const activeIdx5 = router5.getActiveTabIndex();
  const state5 = newTabBar.getState();
  const route5 = state5.routes[activeIdx5];
  const seededStack5 = newTabBar.stacks[route5.key];
  assert.ok(seededStack5, 'Active tab stack exists');
  assert.equal(router5.getStackHistory(seededStack5.getId()).length, 1, 'Active tab seeded');

  // Switch back to auth root with different transition
  router5.setRoot(authRoot, { transition: 'slide_from_right' });
  assert.equal(router5.hasTabBar(), false, 'Switched back to root stack');
  assert.equal(router5.getRootTransition(), 'slide_from_right', 'Root transition updated');
  assert.equal(router5.getStackHistory(r5Id).length, 1, 'Auth re-seeded');
  assert.ok(rootChanges >= 2, 'Root change emitted on each setRoot');
  unsub();

  // Multi tab switch then goBack should pop current tab only
  const router4 = new Router({ root: tabBar as any });
  // Depending on external tabBar index, either A or B seeded. We explicitly
  // build desired stacks below.
  router4.navigate('/a/one'); // A:1 (direct push without seed)
  router4.navigate('/a/two'); // A:2
  router4.setActiveTabIndex(1); // switch to B
  router4.navigate('/b/one'); // B:2
  router4.setActiveTabIndex(0); // back to A
  const a4Id = stackA.getId();
  const b4Id = stackB.getId();
  assert.equal(router4.getStackHistory(a4Id).length, 2, 'A has 2 before pop');
  assert.equal(router4.getStackHistory(b4Id).length, 2, 'B has 2 before pop');
  router4.goBack();
  assert.equal(router4.getStackHistory(a4Id).length, 1, 'goBack popped current tab A');
  assert.equal(router4.getStackHistory(b4Id).length, 2, 'B unchanged');
  router4.setActiveTabIndex(1);
  router4.goBack();
  assert.equal(router4.getStackHistory(b4Id).length, 1, 'Then popped current tab B');

  // Test addModal convenience method
  const modalStack = new NavigationStack().addModal('/modal', ScreenAuth, {
    header: { title: 'Modal Screen' },
  });
  const modalRoutes = modalStack.getRoutes();
  assert.equal(modalRoutes.length, 1, 'Modal stack should have 1 route');
  assert.equal(modalRoutes[0].options?.stackPresentation, 'modal', 'addModal should set stackPresentation to modal');
  assert.equal(modalRoutes[0].options?.header?.title, 'Modal Screen', 'addModal should preserve other options');

  // eslint-disable-next-line no-console
  console.log('router slices test: OK');
}

run();



// Test controllers functionality
function testControllers() {
  // Create test controller that delays navigation
  let controllerCallCount = 0;
  let controllerReceivedParams: any = null;
  let controllerReceivedQuery: any = null;
  let presentCallback: any = null;

  const TestController = createController<any>((input, present) => {
    controllerCallCount++;
    controllerReceivedParams = input.params;
    controllerReceivedQuery = input.query;
    presentCallback = present;
    // Don't call present immediately - simulate async operation
  });

  // Create screen component
  const TestScreen: React.ComponentType<any> = () => null;

  // Create stack with controller
  const stackWithController = new NavigationStack()
    .addScreen('/test', TestScreen)
    .addScreen('/test/:id', { controller: TestController, component: TestScreen });

  const router = new Router({ root: stackWithController });
  const stackId = stackWithController.getId();

  // Initial state - should have seeded route
  assert.equal(router.getStackHistory(stackId).length, 1, 'Stack should be seeded');

  // Navigate to route with controller - screen should NOT appear yet
  router.navigate('/test/123?param=value');
  
  // Controller should be called but screen not pushed yet
  assert.equal(controllerCallCount, 1, 'Controller should be called once');
  assert.equal(router.getStackHistory(stackId).length, 1, 'Screen should not be pushed until controller calls present');
  assert.deepEqual(controllerReceivedParams, { id: '123' }, 'Controller should receive correct params');
  assert.deepEqual(controllerReceivedQuery, { param: 'value' }, 'Controller should receive correct query');
  
  // Now controller calls present with props
  const testProps = { data: 'test-data', loading: false };
  presentCallback(testProps);
  
  // Screen should now be pushed
  assert.equal(router.getStackHistory(stackId).length, 2, 'Screen should be pushed after controller calls present');
  
  // Verify screen receives passProps
  const currentStack = router.getStackHistory(stackId);
  const topItem = currentStack[currentStack.length - 1];
  assert.deepEqual(topItem.passProps, testProps, 'Screen should receive props from controller');
  assert.equal(topItem.params?.id, '123', 'Screen should have correct params');
  assert.equal(topItem.query?.param, 'value', 'Screen should have correct query');

  // Test replace with controller
  controllerCallCount = 0;
  router.replace('/test/456?param=newvalue');
  
  assert.equal(controllerCallCount, 1, 'Controller should be called for replace');
  assert.equal(router.getStackHistory(stackId).length, 2, 'Stack should still have 2 items before controller calls present');
  assert.deepEqual(controllerReceivedParams, { id: '456' }, 'Controller should receive new params for replace');
  
  // Controller calls present for replace
  const replaceProps = { data: 'replace-data', loading: true };
  presentCallback(replaceProps);
  
  // Stack should still have 2 items but top item should be replaced
  assert.equal(router.getStackHistory(stackId).length, 2, 'Stack should have 2 items after replace');
  const replacedStack = router.getStackHistory(stackId);
  const replacedTopItem = replacedStack[replacedStack.length - 1];
  assert.deepEqual(replacedTopItem.passProps, replaceProps, 'Replaced screen should receive new props');
  assert.equal(replacedTopItem.params?.id, '456', 'Replaced screen should have new params');

  // Test navigation to route without controller (should work normally)
  router.navigate('/test');
  assert.equal(router.getStackHistory(stackId).length, 3, 'Route without controller should navigate immediately');

  // eslint-disable-next-line no-console
  console.log('router controllers test: OK');
}

// Run controller tests
testControllers();

import assert from 'node:assert';
import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import { TabBar } from '../TabBar/TabBar';

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

  // eslint-disable-next-line no-console
  console.log('router slices test: OK');
}

run();



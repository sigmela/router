import type { NavigationAppearance } from './types';
import { RenderTabBar } from './TabBar';
import { RouterContext } from './RouterContext';
import { Router } from './Router';
import { memo } from 'react';

export interface NavigationProps {
  router: Router;
  appearance?: NavigationAppearance;
}

//

export const Navigation = memo<NavigationProps>(({ router, appearance }) => {
  // Root stacks rendering is under construction for native; currently render TabBar only

  return (
    <RouterContext.Provider value={router}>
      {/* <ScreenStack style={styles.flex}> */}
      {/* {hasTabBar && (
          <RNNScreenStackItem
            screenId="root-tabbar"
            headerConfig={{ hidden: true }}
            style={styles.flex}
            stackAnimation={rootTransition}
          > */}
      <RenderTabBar tabBar={router.tabBar!} appearance={appearance} />
      {/* </RNNScreenStackItem>
        )} */}
      {/* {rootItems.map((item) => (
          <ScreenStackItem
            key={item.key}
            stackId={rootId}
            item={item}
            stackAnimation={rootTransition}
            appearance={appearance}
          />
        ))}
        {globalItems.map((item) => (
          <ScreenStackItem
            appearance={appearance}
            key={item.key}
            stackId={globalId}
            item={item}
          />
        ))}
      </ScreenStack> */}
    </RouterContext.Provider>
  );
});

// const styles = StyleSheet.create({
//   flex: { flex: 1 },
// });

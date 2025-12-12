/**
 * The height of the TabBar in pixels
 */
export const TAB_BAR_HEIGHT = 57;

/**
 * Hook that returns the height of the TabBar
 * @returns {number} The height of the TabBar in pixels
 *
 * @example
 * ```tsx
 * const TabBarExample = () => {
 *   const tabBarHeight = useTabBarHeight();
 *   return <div style={{ paddingBottom: tabBarHeight }}>Content</div>;
 * };
 * ```
 */
export const useTabBarHeight = (): number => {
  return TAB_BAR_HEIGHT;
};

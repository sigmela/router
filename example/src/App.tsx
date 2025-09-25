import '@sigmela/router/styles.css';
import { Navigation } from '@sigmela/router';
import { router } from './navigation/router';
import {
  AppearanceProvider,
  useAppearance,
} from './contexts/AppearanceContext';

const AppContent = () => {
  const { appearance } = useAppearance();
  return <Navigation router={router} appearance={appearance} />;
};

export default function App() {
  return (
    <AppearanceProvider>
      <AppContent />
    </AppearanceProvider>
  );
}

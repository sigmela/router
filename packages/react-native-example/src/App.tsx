import { Navigation } from '@sigmela/router';
import { router } from './navigation/router';

export default function App() {
  return <Navigation router={router} />;
}

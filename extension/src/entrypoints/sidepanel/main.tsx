import { createRoot } from 'react-dom/client';
import '@/assets/tailwind.css';
import { App } from './App';
import { useActiveTab } from './useActiveTab';

function Root() {
  return <App activeTab={useActiveTab()} />;
}
createRoot(document.getElementById('root')!).render(<Root />);

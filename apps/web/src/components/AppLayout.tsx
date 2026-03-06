import type { ParentComponent } from 'solid-js';
import AuthGuard from './AuthGuard.js';
import ServerSidebar from './ServerSidebar.js';
import ChannelSidebar from './ChannelSidebar.js';

const AppLayout: ParentComponent = (props) => {
  return (
    <AuthGuard>
      <div class="flex h-screen overflow-hidden">
        <ServerSidebar />
        <ChannelSidebar />
        <main class="flex min-w-0 flex-1 flex-col bg-bg-tertiary">{props.children}</main>
      </div>
    </AuthGuard>
  );
};

export default AppLayout;

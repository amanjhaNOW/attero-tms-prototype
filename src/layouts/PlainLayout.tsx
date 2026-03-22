import { Outlet } from 'react-router-dom';

export function PlainLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}

import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <main>
      <nav>
        <Link to='/'>Home</Link>
        {' · '}
        <Link to='/projects'>Projects</Link>
        {' · '}
        <Link to='/action-sample'>Action Sample</Link>
      </nav>
      <Outlet />
    </main>
  );
}

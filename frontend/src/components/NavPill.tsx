import { NavLink } from 'react-router-dom';

interface Item {
  to: string;
  label: string;
  end?: boolean;
}

interface Props {
  items: Item[];
}

export function NavPill({ items }: Props) {
  return (
    <nav className="nav-pill" aria-label="Navegação principal">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className="inline-flex">
          {({ isActive }) => (
            <span data-active={isActive ? 'true' : 'false'} className="nav-pill-item">
              {item.label}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

import { useRef } from 'react';
import { useMagnetic } from '../../hooks/useMagnetic';

// H6 — blue fill sweeps in from the left on hover; the button is pulled toward the cursor.
export default function Button({ children, solid = false, className = '', as = 'button', ...rest }) {
  const ref = useRef(null);
  useMagnetic(ref, 0.25);
  const Tag = as;
  return (
    <Tag ref={ref} className={`btn ${solid ? 'solid' : ''} ${className}`} {...rest}>
      <span className="btn-fill" />
      {children}
    </Tag>
  );
}

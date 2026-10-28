import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);

  const push = useCallback((kind, text) => {
    if (!text) return;
    const id = ++seq.current;
    setItems((current) => [...current, { id, kind, text }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 5200);
  }, []);

  const value = useMemo(() => ({
    success: (text) => push('success', text),
    error: (text) => push('error', text),
    info: (text) => push('info', text),
    dismiss: (id) => setItems((current) => current.filter((item) => item.id !== id)),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 1090 }}>
        {items.map((item) => (
          <Toast
            key={item.id}
            bg={item.kind === 'success' ? 'success' : item.kind === 'error' ? 'danger' : 'primary'}
            onClose={() => value.dismiss(item.id)}
            delay={5000}
            autohide
          >
            <Toast.Body className="text-white d-flex gap-2 align-items-start">
              <span aria-hidden="true">{item.kind === 'success' ? '✓' : item.kind === 'error' ? '!' : 'i'}</span>
              <span>Local demo: {item.text}</span>
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

import { lazy, Suspense, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIrisModal } from '@/shared/stores/useIrisModal';
import { useIaEnabled } from '@/shared/stores/useAuthStore';

// Reaproveita o chat existente da IRIS Dev — já aceita onClose e usa height:100%.
const PergunteIrisPage = lazy(() => import('@/modules/iris/pages/PergunteIrisPage'));

/**
 * Modal global e independente da IRIS Dev: fundo escurecido + entrada animada.
 * Chamável de qualquer parte do sistema (Ctrl+K ou orbe do sidebar). Fecha no
 * Esc, no clique do fundo ou no X interno do chat.
 */
export function IrisModal() {
  const { isOpen, close } = useIrisModal();
  const iaEnabled = useIaEnabled();

  // Esc fecha (registrado só enquanto aberto)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!iaEnabled) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="iris-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
            background: 'rgba(12,18,28,0.62)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <motion.div
            key="iris-panel"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', width: '100%', maxWidth: 940,
              height: '86vh', maxHeight: 860,
              borderRadius: 18, overflow: 'hidden',
              background: '#E8E1D4',
              border: '1px solid rgba(40,55,74,0.14)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            }}
          >
            <Suspense fallback={
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#28374A', fontWeight: 700 }}>
                Abrindo a IRIS…
              </div>
            }>
              <PergunteIrisPage onClose={close} />
            </Suspense>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

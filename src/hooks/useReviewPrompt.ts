/**
 * useReviewPrompt — small hook that decides whether to surface the
 * review prompt after a positive user moment.
 *
 * Usage from inside a value moment (e.g. after a successful PDF export):
 *
 *   const { tryPrompt, modalProps } = useReviewPrompt();
 *
 *   const handleDownloadSuccess = async () => {
 *     // ...the actual download work...
 *     await reviewSignals.pdfExported();
 *     // Wait a beat so the success animation can play, then check
 *     setTimeout(() => tryPrompt(), 1500);
 *   };
 *
 *   return (
 *     <>
 *       ...screen...
 *       <ReviewPromptModal {...modalProps} />
 *     </>
 *   );
 *
 * `tryPrompt` is a no-op if the user is not eligible — calling it is
 * safe at any time.
 */

import { useCallback, useState } from 'react';
import { isEligible } from '@/services/review/reviewManager';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
}

export function useReviewPrompt(): {
  tryPrompt: () => Promise<void>;
  modalProps: ModalProps;
} {
  const [visible, setVisible] = useState(false);

  const tryPrompt = useCallback(async () => {
    const eligible = await isEligible();
    if (eligible) {
      setVisible(true);
    }
  }, []);

  return {
    tryPrompt,
    modalProps: {
      visible,
      onClose: () => setVisible(false),
    },
  };
}

export default useReviewPrompt;

import { useCallback, useRef, useState } from 'react';

const hiddenFeedback = {
  visible: false,
  type: 'success',
  title: '',
  message: '',
  buttonText: 'OK',
};

const useFeedbackModal = () => {
  const onCloseRef = useRef(null);
  const [feedback, setFeedback] = useState(hiddenFeedback);

  const showFeedback = useCallback((nextFeedback) => {
    onCloseRef.current = nextFeedback.onClose || null;
    setFeedback({
      visible: true,
      type: nextFeedback.type || 'success',
      title: nextFeedback.title || '',
      message: nextFeedback.message || '',
      buttonText: nextFeedback.buttonText || 'OK',
    });
  }, []);

  const hideFeedback = useCallback(() => {
    const onClose = onCloseRef.current;
    onCloseRef.current = null;
    setFeedback(hiddenFeedback);

    if (typeof onClose === 'function') {
      onClose();
    }
  }, []);

  return {
    feedback,
    showFeedback,
    hideFeedback,
  };
};

export default useFeedbackModal;

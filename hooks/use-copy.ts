import { useState } from 'react';
import { toast } from 'sonner';

export default function useCopy() {
  const [isCopied, setIsCopied] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setCopiedText(text);
      setHasCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => {
        setIsCopied(false);
        setCopiedText('');
      }, 2000);
    });
  };

  const resetHasCopied = () => setHasCopied(false);

  return { copiedText, isCopied, hasCopied, copyToClipboard, resetHasCopied };
}

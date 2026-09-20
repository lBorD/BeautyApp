import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyCurrencyInputChange,
  createCurrencyBufferFromAmount,
  createEmptyCurrencyBuffer,
  formatCurrencyBuffer,
  getCurrencyBufferAmount,
  getCurrencyBufferSelection,
  isSameCurrencyAmount,
} from '../utils/currency';

// Liga o buffer de digitos de `utils/currency` a um TextInput controlado.
//
// O cursor precisa ser controlado por nos: com as duas casas decimais sempre
// visiveis, deixar o cursor no fim faria todo digito novo cair nos centavos.
// `selection` fica em state (e nao montado inline no JSX) porque o Android
// reenvia a selecao ao nativo sempre que a identidade do objeto muda, e o
// formulario re-renderiza a cada tecla por causa do "Falta pagar".
const useCurrencyInput = ({
  value = 0,
  syncToken = 0,
  onChangeValue,
  clearOnFocusWhenZero = true,
}) => {
  const bufferRef = useRef(createCurrencyBufferFromAmount(value));
  const onChangeValueRef = useRef(onChangeValue);
  const [text, setText] = useState(() => formatCurrencyBuffer(bufferRef.current));
  const [selection, setSelection] = useState(() => getCurrencyBufferSelection(bufferRef.current));

  useEffect(() => {
    onChangeValueRef.current = onChangeValue;
  }, [onChangeValue]);

  const applyBuffer = useCallback((nextBuffer) => {
    bufferRef.current = nextBuffer;
    setText(formatCurrencyBuffer(nextBuffer));
    setSelection(getCurrencyBufferSelection(nextBuffer));
  }, []);

  // Sincroniza com mudancas vindas de fora (chips de percentual, recalculo por
  // servico, abrir o formulario). O eco do proprio onChangeValue cai aqui como
  // no-op, entao nao ha laco.
  useEffect(() => {
    if (isSameCurrencyAmount(getCurrencyBufferAmount(bufferRef.current), value)) {
      return;
    }
    applyBuffer(createCurrencyBufferFromAmount(value));
  }, [applyBuffer, value]);

  // Redesenho forcado para os casos em que o valor externo nao muda mas o texto
  // precisa voltar ao normalizado: chip 0% com o campo ja zerado, reabrir o modal.
  useEffect(() => {
    applyBuffer(createCurrencyBufferFromAmount(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncToken]);

  const handleChangeText = useCallback((nextText) => {
    const nextBuffer = applyCurrencyInputChange(bufferRef.current, nextText);
    applyBuffer(nextBuffer);
    onChangeValueRef.current?.(getCurrencyBufferAmount(nextBuffer));
  }, [applyBuffer]);

  const handleFocus = useCallback(() => {
    if (!clearOnFocusWhenZero || getCurrencyBufferAmount(bufferRef.current) !== 0) {
      return;
    }
    // Esvazia sem avisar o dono do valor: continua sendo 0, entao tocar no campo
    // nao pode desmarcar o chip de percentual. So digitar desmarca.
    applyBuffer(createEmptyCurrencyBuffer());
  }, [applyBuffer, clearOnFocusWhenZero]);

  const handleBlur = useCallback(() => {
    applyBuffer(createCurrencyBufferFromAmount(getCurrencyBufferAmount(bufferRef.current)));
  }, [applyBuffer]);

  return {
    value: text,
    selection,
    onChangeText: handleChangeText,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };
};

export default useCurrencyInput;

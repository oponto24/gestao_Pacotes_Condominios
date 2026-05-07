import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BarcodeScannerInput } from '@/components/portaria/BarcodeScannerInput';

/**
 * Mock de html5-qrcode + lifecycle (anti-leak crítico).
 * Cobre: input texto + abrir/fechar modal + detecção + erro permissão + cleanup.
 */

type DecodeCallback = (text: string) => void;
type StartFn = (
  cam: unknown,
  cfg: unknown,
  onSuccess: DecodeCallback,
  onFailure: () => void,
) => Promise<void>;

const stopMock = vi.fn(() => Promise.resolve());
const clearMock = vi.fn();
const startMock = vi.fn<StartFn>(() => Promise.resolve());

let lastSuccess: DecodeCallback | null = null;
let startBehavior: 'resolve' | 'reject_permission' | 'reject_generic' = 'resolve';

class FakeHtml5Qrcode {
  start: StartFn;
  stop = stopMock;
  clear = clearMock;
  constructor() {
    this.start = (_cam, _cfg, onSuccess) => {
      lastSuccess = onSuccess;
      if (startBehavior === 'reject_permission') {
        return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
      }
      if (startBehavior === 'reject_generic') {
        return Promise.reject(new Error('Generic'));
      }
      return Promise.resolve();
    };
  }
}

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: FakeHtml5Qrcode,
  Html5QrcodeSupportedFormats: {
    QR_CODE: 0,
    CODE_128: 1,
    CODE_39: 2,
    EAN_13: 3,
    EAN_8: 4,
    UPC_A: 5,
  },
}));

beforeEach(() => {
  startMock.mockReset();
  stopMock.mockReset();
  stopMock.mockResolvedValue(undefined);
  clearMock.mockReset();
  lastSuccess = null;
  startBehavior = 'resolve';

  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(() => true),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BarcodeScannerInput', () => {
  it('renderiza input + botão "Bipar"', () => {
    render(<BarcodeScannerInput value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Código do pacote')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bipar/ })).toBeInTheDocument();
  });

  it('digitação manual chama onChange', () => {
    const onChange = vi.fn();
    render(<BarcodeScannerInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Código do pacote'), {
      target: { value: 'TESTE-123' },
    });
    expect(onChange).toHaveBeenCalledWith('TESTE-123');
  });

  it('respeita maxLength no input texto', () => {
    const onChange = vi.fn();
    render(<BarcodeScannerInput value="" onChange={onChange} maxLength={5} />);
    fireEvent.change(screen.getByLabelText('Código do pacote'), {
      target: { value: '1234567890' },
    });
    // Slice em maxLength=5
    expect(onChange).toHaveBeenCalledWith('12345');
  });

  it('click "Bipar" abre modal com título', async () => {
    render(<BarcodeScannerInput value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Bipar/ }));

    await waitFor(() => {
      expect(screen.getByText('Bipar código de barras')).toBeInTheDocument();
    });
  });

  it('detecção dispara onChange + fecha modal + cleanup', async () => {
    const onChange = vi.fn();
    render(<BarcodeScannerInput value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Bipar/ }));

    await waitFor(() => {
      expect(lastSuccess).not.toBeNull();
    });

    // Simula detecção
    lastSuccess!('CODIGO-DETECTADO');

    expect(navigator.vibrate).toHaveBeenCalledWith(50);

    // onChange chamado APÓS cleanup async (estado 'closing' → 'closed')
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('CODIGO-DETECTADO');
    });
    expect(stopMock).toHaveBeenCalled();
    expect(clearMock).toHaveBeenCalled();
  });

  it('detecção dupla do mesmo código é ignorada (debounce flag)', async () => {
    const onChange = vi.fn();
    render(<BarcodeScannerInput value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Bipar/ }));

    await waitFor(() => expect(lastSuccess).not.toBeNull());

    lastSuccess!('CODIGO-1');
    lastSuccess!('CODIGO-2'); // Deveria ser ignorada — flag alreadyDetected ativa

    // onChange resolve via cleanup async — esperar
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    expect(onChange).toHaveBeenCalledWith('CODIGO-1');
  });

  it('permissão negada → estado error com retry e fechar', async () => {
    startBehavior = 'reject_permission';
    const onError = vi.fn();
    render(<BarcodeScannerInput value="" onChange={vi.fn()} onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: /Bipar/ }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Sem acesso à câmera/)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Sem acesso'));
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fechar e digitar manualmente/ })).toBeInTheDocument();
  });

  it('erro genérico → mensagem fallback de digitação manual', async () => {
    startBehavior = 'reject_generic';
    render(<BarcodeScannerInput value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Bipar/ }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/digitar o código manualmente/)).toBeInTheDocument();
  });

  it('cleanup: stop + clear chamados no unmount', async () => {
    const { unmount } = render(<BarcodeScannerInput value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Bipar/ }));
    await waitFor(() => expect(lastSuccess).not.toBeNull());

    unmount();
    await waitFor(() => {
      expect(stopMock).toHaveBeenCalled();
    });
    expect(clearMock).toHaveBeenCalled();
  });
});

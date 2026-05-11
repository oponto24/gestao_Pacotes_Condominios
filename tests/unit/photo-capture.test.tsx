import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import {
  PhotoCapture,
  type PhotoCaptureHandle,
  type PhotoCaptureKind,
} from '@/components/portaria/PhotoCapture';

/**
 * Mocks de getUserMedia + canvas.toBlob para tests do PhotoCapture.
 *
 * **PR-3 refactor:** PhotoCapture virou controlled component (forwardRef).
 * Os testes agora chamam métodos via ref em vez de clicar botões internos —
 * que foram movidos pro FAB (BottomNavBar). Mantém cobertura da state machine
 * e do cleanup de tracks (anti-regressão de leak).
 */

class FakeTrack {
  stop = vi.fn();
  getSettings = () => ({ width: 1920, height: 1080 });
}

class FakeStream {
  tracks: FakeTrack[];
  constructor() {
    this.tracks = [new FakeTrack()];
  }
  getTracks() {
    return this.tracks as unknown as MediaStreamTrack[];
  }
  getVideoTracks() {
    return this.tracks as unknown as MediaStreamTrack[];
  }
}

let lastStream: FakeStream | null = null;
const getUserMediaMock = vi.fn();

beforeEach(() => {
  lastStream = null;
  getUserMediaMock.mockReset();

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock },
    configurable: true,
    writable: true,
  });

  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(() => true),
    configurable: true,
    writable: true,
  });

  HTMLCanvasElement.prototype.toBlob = function (
    callback: BlobCallback,
    type?: string,
    _q?: number,
  ) {
    const blob = new Blob(['fake-jpeg'], { type: type ?? 'image/jpeg' });
    callback(blob);
  };

  HTMLCanvasElement.prototype.toDataURL = function (type?: string) {
    return `data:${type ?? 'image/jpeg'};base64,ZmFrZQ==`;
  };

  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ drawImage: vi.fn() }) as unknown as RenderingContext,
  ) as typeof HTMLCanvasElement.prototype.getContext;

  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    get: () => 1920,
    configurable: true,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    get: () => 1080,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PhotoCapture state machine (ref-based API)', () => {
  it('renderiza estado idle com placeholder no visor (sem botão interno)', () => {
    render(<PhotoCapture onCapture={vi.fn()} />);
    expect(screen.getByText(/Posicione a etiqueta aqui/)).toBeInTheDocument();
    // PR-3: não há mais botão "Iniciar câmera" interno — é o FAB que dirige
    expect(
      screen.queryByRole('button', { name: /Iniciar câmera/ }),
    ).not.toBeInTheDocument();
  });

  it('idle → streaming quando ref.startCamera() resolve', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    const ref = createRef<PhotoCaptureHandle>();
    render(<PhotoCapture ref={ref} onCapture={vi.fn()} />);

    act(() => {
      ref.current?.startCamera();
    });

    await waitFor(() => {
      expect(screen.getByText(/Câmera ligada/)).toBeInTheDocument();
    });
  });

  it('idle → error quando permissão negada (NotAllowedError)', async () => {
    const onError = vi.fn();
    getUserMediaMock.mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError'),
    );

    const ref = createRef<PhotoCaptureHandle>();
    render(<PhotoCapture ref={ref} onCapture={vi.fn()} onError={onError} />);

    act(() => {
      ref.current?.startCamera();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Sem acesso à câmera/)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Sem acesso'));
    // Estado terminal `error` mantém botão interno "Tentar novamente"
    expect(
      screen.getByRole('button', { name: /Tentar novamente/ }),
    ).toBeInTheDocument();
  });

  it('streaming → captured ao ref.capture(); chama onCapture com Blob+dataUrl em ref.confirm()', async () => {
    const onCapture = vi.fn();
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    const ref = createRef<PhotoCaptureHandle>();
    render(<PhotoCapture ref={ref} onCapture={onCapture} />);

    act(() => {
      ref.current?.startCamera();
    });
    await waitFor(() => screen.getByText(/Câmera ligada/));

    await act(async () => {
      await ref.current?.capture();
    });

    expect(navigator.vibrate).toHaveBeenCalledWith(50);

    act(() => {
      ref.current?.confirm();
    });

    expect(onCapture).toHaveBeenCalledTimes(1);
    const [blob, dataUrl] = onCapture.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(dataUrl).toContain('data:image/jpeg');
  });

  it('captured → streaming ao ref.retake()', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    const ref = createRef<PhotoCaptureHandle>();
    const onStateChange = vi.fn<[PhotoCaptureKind], void>();
    render(
      <PhotoCapture
        ref={ref}
        onCapture={vi.fn()}
        onStateChange={onStateChange}
      />,
    );

    act(() => {
      ref.current?.startCamera();
    });
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith('streaming'),
    );

    await act(async () => {
      await ref.current?.capture();
    });
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith('captured'),
    );

    const newStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(newStream);

    act(() => {
      ref.current?.retake();
    });

    await waitFor(() => {
      expect(onStateChange).toHaveBeenLastCalledWith('streaming');
    });
  });

  it('notifica onStateChange a cada transição', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    const onStateChange = vi.fn<[PhotoCaptureKind], void>();
    const ref = createRef<PhotoCaptureHandle>();
    render(
      <PhotoCapture
        ref={ref}
        onCapture={vi.fn()}
        onStateChange={onStateChange}
      />,
    );

    // Mount: idle
    expect(onStateChange).toHaveBeenCalledWith('idle');

    act(() => {
      ref.current?.startCamera();
    });
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith('streaming'),
    );

    await act(async () => {
      await ref.current?.capture();
    });
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith('captured'),
    );
  });

  it('cleanup: para tracks no unmount (anti-leak)', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    const ref = createRef<PhotoCaptureHandle>();
    const { unmount } = render(<PhotoCapture ref={ref} onCapture={vi.fn()} />);

    act(() => {
      ref.current?.startCamera();
    });
    await waitFor(() => screen.getByText(/Câmera ligada/));

    const track = lastStream!.tracks[0];
    expect(track.stop).not.toHaveBeenCalled();

    unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it('cleanup: para tracks ao mover para captured (anti-leak)', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    const ref = createRef<PhotoCaptureHandle>();
    render(<PhotoCapture ref={ref} onCapture={vi.fn()} />);

    act(() => {
      ref.current?.startCamera();
    });
    await waitFor(() => screen.getByText(/Câmera ligada/));

    const track = lastStream!.tracks[0];
    await act(async () => {
      await ref.current?.capture();
    });

    expect(track.stop).toHaveBeenCalled();
  });

  it('cleanup: para tracks ao entrar em error após retake falhar', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    const ref = createRef<PhotoCaptureHandle>();
    render(<PhotoCapture ref={ref} onCapture={vi.fn()} />);

    act(() => {
      ref.current?.startCamera();
    });
    await waitFor(() => screen.getByText(/Câmera ligada/));

    const track = lastStream!.tracks[0];
    expect(track.stop).not.toHaveBeenCalled();

    await act(async () => {
      await ref.current?.capture();
    });

    // Re-request falha
    getUserMediaMock.mockRejectedValue(
      new DOMException('User cancelled', 'NotAllowedError'),
    );
    act(() => {
      ref.current?.retake();
    });

    await waitFor(() => screen.getByRole('alert'));
    expect(track.stop).toHaveBeenCalled();
  });
});

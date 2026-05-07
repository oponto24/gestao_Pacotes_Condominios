import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PhotoCapture } from '@/components/portaria/PhotoCapture';

/**
 * Mocks de getUserMedia + canvas.toBlob para tests do PhotoCapture.
 * Foco: state machine + cleanup correto de tracks (anti-regressão de leak).
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

  // Mock vibrate (não suportado em jsdom)
  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(() => true),
    configurable: true,
    writable: true,
  });

  // Mock canvas.toBlob (jsdom retorna null por padrão)
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

  // Mock getContext para retornar objeto que aceita drawImage
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ drawImage: vi.fn() }) as unknown as RenderingContext,
  ) as typeof HTMLCanvasElement.prototype.getContext;

  // videoWidth/Height fallback
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

describe('PhotoCapture state machine', () => {
  it('renderiza estado idle com placeholder + botão "Iniciar câmera"', () => {
    render(<PhotoCapture onCapture={vi.fn()} />);
    expect(screen.getByText(/Posicione a etiqueta aqui/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar câmera/ })).toBeInTheDocument();
  });

  it('idle → streaming quando getUserMedia resolve', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    render(<PhotoCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar câmera/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tirar foto/ })).toBeInTheDocument();
    });
    expect(screen.getByText(/Câmera ligada/)).toBeInTheDocument();
  });

  it('idle → error quando permissão negada (NotAllowedError)', async () => {
    const onError = vi.fn();
    getUserMediaMock.mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError'),
    );

    render(<PhotoCapture onCapture={vi.fn()} onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar câmera/ }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Sem acesso à câmera/)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Sem acesso'));
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
  });

  it('streaming → captured ao clicar "Tirar foto", chama onCapture com Blob+dataUrl quando confirma', async () => {
    const onCapture = vi.fn();
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    render(<PhotoCapture onCapture={onCapture} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar câmera/ }));
    await waitFor(() => screen.getByRole('button', { name: /Tirar foto/ }));

    fireEvent.click(screen.getByRole('button', { name: /Tirar foto/ }));

    await waitFor(() => screen.getByRole('button', { name: /Usar essa foto/ }));
    expect(screen.getByRole('button', { name: /Refazer foto/ })).toBeInTheDocument();
    expect(navigator.vibrate).toHaveBeenCalledWith(50);

    fireEvent.click(screen.getByRole('button', { name: /Usar essa foto/ }));
    expect(onCapture).toHaveBeenCalledTimes(1);
    const [blob, dataUrl] = onCapture.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(dataUrl).toContain('data:image/jpeg');
  });

  it('captured → streaming ao clicar "Refazer foto"', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    render(<PhotoCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar câmera/ }));
    await waitFor(() => screen.getByRole('button', { name: /Tirar foto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Tirar foto/ }));
    await waitFor(() => screen.getByRole('button', { name: /Refazer foto/ }));

    // Mock NOVO stream para o retake
    const newStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(newStream);

    fireEvent.click(screen.getByRole('button', { name: /Refazer foto/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tirar foto/ })).toBeInTheDocument();
    });
  });

  it('cleanup: para tracks no unmount (anti-leak)', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    const { unmount } = render(<PhotoCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar câmera/ }));
    await waitFor(() => screen.getByRole('button', { name: /Tirar foto/ }));

    const track = lastStream!.tracks[0];
    expect(track.stop).not.toHaveBeenCalled();

    unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it('cleanup: para tracks ao mover para captured (anti-leak)', async () => {
    lastStream = new FakeStream();
    getUserMediaMock.mockResolvedValue(lastStream);

    render(<PhotoCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar câmera/ }));
    await waitFor(() => screen.getByRole('button', { name: /Tirar foto/ }));

    const track = lastStream!.tracks[0];
    fireEvent.click(screen.getByRole('button', { name: /Tirar foto/ }));
    await waitFor(() => screen.getByRole('button', { name: /Refazer foto/ }));

    expect(track.stop).toHaveBeenCalled();
  });

  it('cleanup: para tracks ao entrar em error', async () => {
    lastStream = new FakeStream();
    // Primeira chamada OK, segunda falha (simulando re-request com erro)
    getUserMediaMock.mockResolvedValue(lastStream);

    render(<PhotoCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar câmera/ }));
    await waitFor(() => screen.getByRole('button', { name: /Tirar foto/ }));

    const track = lastStream!.tracks[0];
    expect(track.stop).not.toHaveBeenCalled();

    // Simula um retake que falha
    getUserMediaMock.mockRejectedValue(new DOMException('User cancelled', 'NotAllowedError'));
    fireEvent.click(screen.getByRole('button', { name: /Tirar foto/ }));
    await waitFor(() => screen.getByRole('button', { name: /Refazer foto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Refazer foto/ }));

    await waitFor(() => screen.getByRole('alert'));
    expect(track.stop).toHaveBeenCalled();
  });
});

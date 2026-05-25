import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { LiveStreet } from '../../../types/liveSession';
import type { Card } from '../../../types/poker';
import type {
  RecognizedBoard,
  RecognizedCard,
  VisionApplyMode,
  VisionBoardCards,
  VisionCalibrationProfile,
  VisionRegion,
} from '../../../types/vision';
import {
  createVisionBoardTrackerState,
  evaluateRecognizedBoard,
  type VisionBoardEvaluation,
  type VisionBoardTrackerState,
} from '../../../utils/visionBoardState';
import { compareImageMotion, type MotionSample } from '../../../utils/visionMotion';
import { recognizeCardsFromImageData } from '../../../utils/visionCardRecognition';
import { cardKey } from '../../../utils/cardInput';

export const VISION_CALIBRATION_STORAGE_KEY = 'gto-vision-calibration:v1';

type RegionKey = 'boardRegion' | 'heroRegion';
type MotionPhase = 'off' | 'watching' | 'motion' | 'settling' | 'recognizing' | 'cooldown';

interface MotionStatus {
  phase: MotionPhase;
  label: string;
  changedRatio: number;
  region: string | null;
}

interface VisionCapturePanelProps {
  currentHeroCards: Card[];
  currentBoard: VisionBoardCards;
  resetSignal: number;
  disabled?: boolean;
  onApplyHeroCards: (cards: Card[]) => void;
  onApplyBoard: (board: VisionBoardCards, street: LiveStreet) => void;
}

const DEFAULT_BOARD_REGION: VisionRegion = {
  id: 'board-region',
  label: 'Board range',
  shape: 'rect',
  x: 0.31,
  y: 0.34,
  width: 0.38,
  height: 0.18,
};

const DEFAULT_HERO_REGION: VisionRegion = {
  id: 'hero-region',
  label: 'Hero cards',
  shape: 'rect',
  x: 0.41,
  y: 0.68,
  width: 0.18,
  height: 0.18,
};

const MOTION_SAMPLE_INTERVAL_MS = 140;
const MOTION_SETTLE_MS = 550;
const MOTION_COOLDOWN_MS = 1400;

function emptyCalibration(applyMode: VisionApplyMode = 'confirm'): VisionCalibrationProfile {
  return {
    version: 1,
    sourceKind: 'screen',
    boardRegion: null,
    heroRegion: null,
    villainRegions: [],
    betRegions: [],
    chipColors: [],
    applyMode,
    updatedAt: new Date().toISOString(),
  };
}

function loadCalibration(): VisionCalibrationProfile {
  try {
    const raw = localStorage.getItem(VISION_CALIBRATION_STORAGE_KEY);
    if (!raw) return emptyCalibration();
    const parsed = JSON.parse(raw) as VisionCalibrationProfile;
    if (parsed.version !== 1) return emptyCalibration();
    return {
      ...emptyCalibration(parsed.applyMode ?? 'confirm'),
      ...parsed,
      villainRegions: parsed.villainRegions ?? [],
      betRegions: parsed.betRegions ?? [],
      chipColors: parsed.chipColors ?? [],
    };
  } catch {
    return emptyCalibration();
  }
}

function saveCalibration(profile: VisionCalibrationProfile): void {
  localStorage.setItem(VISION_CALIBRATION_STORAGE_KEY, JSON.stringify(profile));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function regionStyle(region: VisionRegion): CSSProperties {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
  };
}

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

function cardsLabel(cards: Card[]): string {
  return cards.map(item => `${item.rank}${item.suit.toUpperCase()}`).join(' ');
}

function isSameCards(first: Card[], second: Card[]): boolean {
  if (first.length !== second.length) return false;
  return first.every((item, index) => cardKey(item) === cardKey(second[index]));
}

function hasDuplicateCards(cards: Card[]): boolean {
  return new Set(cards.map(cardKey)).size !== cards.length;
}

function makeRecognizedCard(item: Card, index: number, total: number): RecognizedCard {
  const observedAt = new Date().toISOString();
  const width = 0.08;
  const gap = total > 1 ? 0.72 / (total - 1) : 0;
  return {
    card: item,
    confidence: 0.96,
    sourceKind: 'screen',
    observedAt,
    bounds: {
      id: `mock-card-${index}`,
      label: `Mock card ${index + 1}`,
      shape: 'rect',
      x: 0.1 + index * gap,
      y: 0.2,
      width,
      height: 0.3,
    },
  };
}

function boardCount(board: VisionBoardCards): number {
  return board.filter((item): item is Card => item !== null).length;
}

export function VisionCapturePanel({
  currentHeroCards,
  currentBoard,
  resetSignal,
  disabled = false,
  onApplyHeroCards,
  onApplyBoard,
}: VisionCapturePanelProps) {
  const [calibration, setCalibration] = useState<VisionCalibrationProfile>(() => loadCalibration());
  const [activeRegion, setActiveRegion] = useState<RegionKey>('boardRegion');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captureError, setCaptureError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [pendingHero, setPendingHero] = useState<RecognizedCard[]>([]);
  const [pendingBoard, setPendingBoard] = useState<VisionBoardEvaluation | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [motionWatchEnabled, setMotionWatchEnabled] = useState(true);
  const [motionStatus, setMotionStatus] = useState<MotionStatus>({
    phase: 'off',
    label: 'Motion watch idle',
    changedRatio: 0,
    region: null,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerRef = useRef<VisionBoardTrackerState>(createVisionBoardTrackerState(currentBoard));
  const previousMotionFramesRef = useRef<Record<RegionKey, ImageData | null>>({ boardRegion: null, heroRegion: null });
  const motionPhaseRef = useRef<MotionPhase>('off');
  const lastMotionAtRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const pendingMotionRegionRef = useRef<RegionKey | null>(null);
  const currentBoardCount = boardCount(currentBoard);
  const canCapture = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getDisplayMedia === 'function';

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    trackerRef.current = createVisionBoardTrackerState(currentBoard);
    setPendingBoard(null);
    setPendingHero([]);
    previousMotionFramesRef.current = { boardRegion: null, heroRegion: null };
    pendingMotionRegionRef.current = null;
  }, [currentBoard, resetSignal]);

  useEffect(() => () => {
    stream?.getTracks().forEach(track => track.stop());
  }, [stream]);

  const applyMode = calibration.applyMode;
  const heroSummary = pendingHero.length > 0
    ? `${cardsLabel(pendingHero.map(item => item.card))} · ${Math.round(Math.min(...pendingHero.map(item => item.confidence)) * 100)}%`
    : 'No pending hero cards';
  const boardSummary = pendingBoard
    ? `${pendingBoard.cards.length} card${pendingBoard.cards.length === 1 ? '' : 's'} · ${pendingBoard.status}`
    : 'No pending board';
  const hasCalibration = !!calibration.boardRegion || !!calibration.heroRegion;

  const updateCalibration = (updates: Partial<VisionCalibrationProfile>) => {
    setCalibration(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
    setSaveStatus('');
  };

  const setRegion = (key: RegionKey, region: VisionRegion) => {
    updateCalibration({ [key]: region });
  };

  const applyDefaults = () => {
    updateCalibration({
      boardRegion: DEFAULT_BOARD_REGION,
      heroRegion: DEFAULT_HERO_REGION,
    });
  };

  const persistCalibration = () => {
    saveCalibration(calibration);
    setSaveStatus('Saved locally');
  };

  const startCapture = async () => {
    setCaptureError('');
    if (!canCapture) {
      setCaptureError('Screen capture is not available in this browser.');
      return;
    }
    try {
      const nextStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      stream?.getTracks().forEach(track => track.stop());
      setStream(nextStream);
    } catch {
      setCaptureError('Screen capture was cancelled or blocked.');
    }
  };

  const stopCapture = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
  };

  const applyHero = (cards: Card[]) => {
    onApplyHeroCards(cards);
    setPendingHero([]);
  };

  const maybeAutoApplyHero = (cards: Card[]) => {
    if (applyMode !== 'autoStable') return;
    if (hasDuplicateCards(cards)) return;
    if (currentHeroCards.length === 2 && !isSameCards(currentHeroCards, cards)) return;
    applyHero(cards);
  };

  const mockHero = () => {
    const observed = [card('A', 's'), card('K', 'd')].map((item, index) => makeRecognizedCard(item, index, 2));
    setPendingHero(observed);
    maybeAutoApplyHero(observed.map(item => item.card));
  };

  const submitRecognizedBoard = (recognized: RecognizedBoard) => {
    let state = trackerRef.current;
    let evaluation: VisionBoardEvaluation | null = null;
    for (let index = 0; index < 3; index += 1) {
      const result = evaluateRecognizedBoard(state, recognized);
      state = result.state;
      evaluation = result.evaluation;
    }
    trackerRef.current = state;
    setPendingBoard(evaluation);
    if (evaluation?.status === 'stable' && applyMode === 'autoStable') {
      onApplyBoard(evaluation.board, evaluation.street);
    }
  };

  const submitBoardRecognition = (cards: Card[]) => {
    const observedAt = new Date().toISOString();
    submitRecognizedBoard({
      sourceKind: 'screen',
      observedAt,
      cards: cards.map((item, index) => makeRecognizedCard(item, index, cards.length)),
    });
  };

  const mockBadBoard = () => {
    submitBoardRecognition([card('A', 's'), card('A', 's'), card('Q', 'h')]);
  };

  const captureRegionImageData = (region: VisionRegion): ImageData | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return null;
    const width = Math.max(8, Math.round(region.width * video.videoWidth));
    const height = Math.max(8, Math.round(region.height * video.videoHeight));
    const sourceX = Math.round(region.x * video.videoWidth);
    const sourceY = Math.round(region.y * video.videoHeight);
    const canvas = motionCanvasRef.current ?? document.createElement('canvas');
    motionCanvasRef.current = canvas;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, sourceX, sourceY, width, height, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  };

  const scanHeroRegion = () => {
    setScanStatus('');
    if (!calibration.heroRegion) {
      setScanStatus('Set a hero region before scanning.');
      return;
    }
    const image = captureRegionImageData(calibration.heroRegion);
    if (!image) {
      setScanStatus('Hero scan could not read the video frame yet.');
      return;
    }
    const cards = recognizeCardsFromImageData(image, 'screen').slice(0, 2);
    setPendingHero(cards);
    if (cards.length === 0) {
      setScanStatus('Hero scan found no face-up cards.');
      return;
    }
    setScanStatus(`Hero scan found ${cards.length} card${cards.length === 1 ? '' : 's'}.`);
    if (cards.length === 2) maybeAutoApplyHero(cards.map(item => item.card));
  };

  const scanBoardRegion = () => {
    setScanStatus('');
    if (!calibration.boardRegion) {
      setScanStatus('Set a board region before scanning.');
      return;
    }
    const image = captureRegionImageData(calibration.boardRegion);
    if (!image) {
      setScanStatus('Board scan could not read the video frame yet.');
      return;
    }
    const cards = recognizeCardsFromImageData(image, 'screen').slice(0, 5);
    if (cards.length === 0) {
      setScanStatus('Board scan found no face-up cards.');
      return;
    }
    submitRecognizedBoard({
      sourceKind: 'screen',
      observedAt: new Date().toISOString(),
      cards,
    });
    setScanStatus(`Board scan found ${cards.length} card${cards.length === 1 ? '' : 's'}.`);
  };

  useEffect(() => {
    if (!stream || !motionWatchEnabled || disabled) {
      motionPhaseRef.current = 'off';
      setMotionStatus({
        phase: 'off',
        label: stream ? 'Motion watch paused' : 'Motion watch idle',
        changedRatio: 0,
        region: null,
      });
      return;
    }

    let frameId = 0;
    let lastSampleAt = 0;
    let cancelled = false;

    const setPhase = (phase: MotionPhase, label: string, sample?: MotionSample, region?: RegionKey | null) => {
      if (motionPhaseRef.current === phase && !sample && (region ?? null) === pendingMotionRegionRef.current) return;
      motionPhaseRef.current = phase;
      setMotionStatus({
        phase,
        label,
        changedRatio: sample?.changedRatio ?? 0,
        region: region === 'boardRegion' ? 'Board range' : region === 'heroRegion' ? 'Hero cards' : null,
      });
    };

    const runMotionTriggeredRecognition = (region: RegionKey | null) => {
      setPhase('recognizing', 'Movement settled. Running recognition.', undefined, region);
      if (region === 'heroRegion' && currentHeroCards.length < 2) {
        scanHeroRegion();
      }
      if (region === 'boardRegion' && currentBoardCount < 5) {
        scanBoardRegion();
      }
      pendingMotionRegionRef.current = null;
      cooldownUntilRef.current = performance.now() + MOTION_COOLDOWN_MS;
      setPhase('cooldown', 'Recognition complete. Cooling down.', undefined, region);
    };

    const sample = (now: number) => {
      if (cancelled) return;
      frameId = requestAnimationFrame(sample);
      if (now - lastSampleAt < MOTION_SAMPLE_INTERVAL_MS) return;
      lastSampleAt = now;

      if (now < cooldownUntilRef.current) {
        setPhase('cooldown', 'Recognition complete. Cooling down.', undefined, pendingMotionRegionRef.current);
        return;
      }

      const candidates: Array<[RegionKey, VisionRegion | null, boolean]> = [
        ['heroRegion', calibration.heroRegion, currentHeroCards.length < 2],
        ['boardRegion', calibration.boardRegion, currentBoardCount < 5],
      ];
      let strongest: { key: RegionKey; sample: MotionSample } | null = null;

      for (const [key, region, enabled] of candidates) {
        if (!region || !enabled) continue;
        const nextFrame = captureRegionImageData(region);
        if (!nextFrame) continue;
        const motion = compareImageMotion(previousMotionFramesRef.current[key], nextFrame);
        previousMotionFramesRef.current[key] = nextFrame;
        if (motion.motion && (!strongest || motion.changedRatio > strongest.sample.changedRatio)) {
          strongest = { key, sample: motion };
        }
      }

      if (strongest) {
        pendingMotionRegionRef.current = strongest.key;
        lastMotionAtRef.current = now;
        setPhase('motion', 'Movement detected. Waiting for it to settle.', strongest.sample, strongest.key);
        return;
      }

      if (pendingMotionRegionRef.current && now - lastMotionAtRef.current < MOTION_SETTLE_MS) {
        setPhase('settling', 'Movement settling...', undefined, pendingMotionRegionRef.current);
        return;
      }

      if (pendingMotionRegionRef.current && now - lastMotionAtRef.current >= MOTION_SETTLE_MS) {
        runMotionTriggeredRecognition(pendingMotionRegionRef.current);
        return;
      }

      setPhase('watching', 'Watching for card movement.', undefined, null);
    };

    frameId = requestAnimationFrame(sample);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [
    calibration.boardRegion,
    calibration.heroRegion,
    currentBoardCount,
    currentHeroCards,
    disabled,
    motionWatchEnabled,
    stream,
  ]);

  const applyPendingBoard = () => {
    if (!pendingBoard || pendingBoard.status !== 'stable') return;
    onApplyBoard(pendingBoard.board, pendingBoard.street);
    setPendingBoard(null);
  };

  const clearPending = () => {
    setPendingBoard(null);
    setPendingHero([]);
    setScanStatus('');
    trackerRef.current = createVisionBoardTrackerState(currentBoard);
  };

  const pointerToNormalized = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = previewRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return null;
    return {
      x: clamp01((event.clientX - box.left) / box.width),
      y: clamp01((event.clientY - box.top) / box.height),
    };
  };

  const beginRegionDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const point = pointerToNormalized(event);
    if (!point) return;
    setDragStart(point);
  };

  const finishRegionDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const end = pointerToNormalized(event);
    setDragStart(null);
    if (!end) return;
    const x = Math.min(dragStart.x, end.x);
    const y = Math.min(dragStart.y, end.y);
    const width = Math.abs(end.x - dragStart.x);
    const height = Math.abs(end.y - dragStart.y);
    if (width < 0.03 || height < 0.03) return;
    const isBoard = activeRegion === 'boardRegion';
    setRegion(activeRegion, {
      id: isBoard ? 'board-region' : 'hero-region',
      label: isBoard ? 'Board range' : 'Hero cards',
      shape: 'rect',
      x,
      y,
      width,
      height,
    });
  };

  const regions = useMemo(
    () => [calibration.boardRegion, calibration.heroRegion].filter((region): region is VisionRegion => region !== null),
    [calibration.boardRegion, calibration.heroRegion],
  );

  return (
    <section className="vision-capture-panel" aria-label="Vision capture">
      <div className="vision-capture-head">
        <div>
          <div className="live-card-modal-kicker">Vision capture</div>
          <h3 className="vision-capture-title">Screen calibration</h3>
        </div>
        <label className="vision-auto-toggle">
          <input
            type="checkbox"
            checked={applyMode === 'autoStable'}
            onChange={event => updateCalibration({ applyMode: event.target.checked ? 'autoStable' : 'confirm' })}
            disabled={disabled}
          />
          <span>Auto apply</span>
        </label>
        <label className="vision-auto-toggle">
          <input
            type="checkbox"
            checked={motionWatchEnabled}
            onChange={event => setMotionWatchEnabled(event.target.checked)}
            disabled={disabled}
          />
          <span>Motion watch</span>
        </label>
      </div>

      <div className="vision-capture-grid">
        <div className="vision-preview-wrap">
          <div
            ref={previewRef}
            className={`vision-preview ${stream ? 'active' : ''}`}
            onPointerDown={beginRegionDraw}
            onPointerUp={finishRegionDraw}
          >
            {stream ? (
              <video ref={videoRef} autoPlay muted playsInline aria-label="Captured table preview" />
            ) : (
              <div className="vision-preview-empty">
                <strong>{canCapture ? 'No screen shared' : 'Screen capture unavailable'}</strong>
                <span>{canCapture ? 'Share a poker table window, then draw regions.' : 'This browser cannot start screen capture here.'}</span>
              </div>
            )}
            {regions.map(region => (
              <div key={region.id} className={`vision-region-box ${region.id}`} style={regionStyle(region)}>
                <span>{region.label}</span>
              </div>
            ))}
          </div>
          {captureError && <div className="vision-capture-error" role="alert">{captureError}</div>}
        </div>

        <div className="vision-capture-controls">
          <div className={`vision-motion-status ${motionStatus.phase}`}>
            <span>{motionStatus.region ?? 'Watcher'}</span>
            <strong>{motionStatus.label}</strong>
            {motionStatus.changedRatio > 0 && <small>{Math.round(motionStatus.changedRatio * 100)}% changed</small>}
          </div>
          <div className="vision-button-row">
            <button type="button" className="btn-secondary" onClick={startCapture} disabled={disabled || !canCapture}>Start capture</button>
            <button type="button" className="btn-secondary" onClick={stopCapture} disabled={!stream}>Stop</button>
          </div>
          <div className="vision-region-tabs" role="tablist" aria-label="Calibration region">
            <button type="button" className={`hl-po-chip ${activeRegion === 'boardRegion' ? 'active' : ''}`} onClick={() => setActiveRegion('boardRegion')}>Board range</button>
            <button type="button" className={`hl-po-chip ${activeRegion === 'heroRegion' ? 'active' : ''}`} onClick={() => setActiveRegion('heroRegion')}>Hero cards</button>
          </div>
          <div className="vision-button-row">
            <button type="button" className="btn-secondary" onClick={applyDefaults} disabled={disabled}>Use default regions</button>
            <button type="button" className="btn-primary" onClick={persistCalibration} disabled={disabled || !hasCalibration}>Save calibration</button>
          </div>
          <div className="vision-save-status" aria-live="polite">{saveStatus}</div>
        </div>
      </div>

      <div className="vision-detection-grid">
        <div className="vision-detection-card">
          <div className="vision-detection-head">
            <span>Hero</span>
            <strong>{heroSummary}</strong>
          </div>
          <div className="vision-button-row">
            <button type="button" className="hl-po-chip" onClick={scanHeroRegion} disabled={disabled || !stream}>Scan Hero</button>
            <button type="button" className="hl-po-chip" onClick={mockHero} disabled={disabled}>Mock Hero</button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => applyHero(pendingHero.map(item => item.card))}
              disabled={pendingHero.length !== 2 || hasDuplicateCards(pendingHero.map(item => item.card))}
            >
              Apply Hero
            </button>
          </div>
        </div>

        <div className="vision-detection-card">
          <div className="vision-detection-head">
            <span>Board</span>
            <strong>{boardSummary}</strong>
          </div>
          {scanStatus && <p className="vision-detection-note" aria-live="polite">{scanStatus}</p>}
          {pendingBoard?.reason && <p className="vision-detection-note">{pendingBoard.reason}</p>}
          <div className="vision-button-row">
            <button type="button" className="hl-po-chip" onClick={scanBoardRegion} disabled={disabled || !stream}>Scan Board</button>
            <button type="button" className="hl-po-chip" onClick={() => submitBoardRecognition([card('A', 's'), card('K', 'd'), card('Q', 'h')])} disabled={disabled}>Mock Flop</button>
            <button type="button" className="hl-po-chip" onClick={() => submitBoardRecognition([card('A', 's'), card('K', 'd'), card('Q', 'h'), card('J', 'c')])} disabled={disabled || currentBoardCount > 4}>Mock Turn</button>
            <button type="button" className="hl-po-chip" onClick={() => submitBoardRecognition([card('A', 's'), card('K', 'd'), card('Q', 'h'), card('J', 'c'), card('T', 's')])} disabled={disabled || currentBoardCount > 5}>Mock River</button>
            <button type="button" className="hl-po-chip" onClick={mockBadBoard} disabled={disabled}>Mock Bad/Duplicate</button>
          </div>
          <div className="vision-button-row">
            <button type="button" className="btn-secondary" onClick={applyPendingBoard} disabled={pendingBoard?.status !== 'stable'}>Apply Board</button>
            <button type="button" className="btn-secondary" onClick={clearPending} disabled={!pendingBoard && pendingHero.length === 0}>Clear</button>
          </div>
        </div>
      </div>
    </section>
  );
}

import React, { useState, useEffect } from 'react';
import { useUpwords } from './hooks/use-upwords';
import { Header } from './components/Header';
import { GameSettings } from './components/GameSettings';
import { Board } from './components/Board';
import { Rack } from './components/Rack';
import { Scoreboard } from './components/Scoreboard';
import { TileBagInfo } from './components/TileBagInfo';
import { MoveLog } from './components/MoveLog';
import { CoachPanel } from './components/CoachPanel';
import { Trophy, HelpCircle, Sparkles, RefreshCw, ShieldQuestion, CheckCircle2, XCircle } from 'lucide-react';
import { CandidateMove } from './lib/upwords-ai';

export default function App() {
  const {
    board, players, tileBag, currentTurn, history, gameEnded, winnerId,
    dictLoaded, dictLoadingProgress, gameStarted, isAiThinking,
    placements, activeRack, hint, coachAnalysis, lastPlayPlacements,
    coachEnabled, setCoachEnabled,
    startNewGame, placeTileTemp, removeTileTemp, recallTiles, shuffleRack, renamePlayer, reorderRack,
    submitPlay, passTurn, exchangeTiles, getHint, clearHint, challengeWord, removeWord, humanMovesReady,
    turnSnapshots, rewindToTurn,
    closeCoachAndAdvance, getPlacementsPreview
  } = useUpwords();

  // Index-based tile selection fixes the duplicate-letter bug
  const [selectedTile, setSelectedTile] = useState<{ letter: string; idx: number } | null>(null);
  const [bestMovePreview, setBestMovePreview] = useState<CandidateMove | null>(null);
  const [challengeResult, setChallengeResult] = useState<{ word: string; success: boolean } | null>(null);
  const [noHintAvailable, setNoHintAvailable] = useState(false);

  useEffect(() => {
    setNoHintAvailable(false);
  }, [currentTurn]);

  const handleCellClick = (r: number, c: number) => {
    if (players[currentTurn]?.isAi || gameEnded) return;
    const existingTemp = placements.find(p => p.r === r && p.c === c);
    if (existingTemp) {
      removeTileTemp(r, c);
    } else if (selectedTile) {
      placeTileTemp(r, c, selectedTile.letter);
      setSelectedTile(null);
    }
  };

  // Drag-and-drop from rack → board (also handles board temp-tile → board moves)
  const handleDropTile = (r: number, c: number, letter: string) => {
    if (players[currentTurn]?.isAi || gameEnded) return;
    placeTileTemp(r, c, letter);
    setSelectedTile(null);
  };

  const handleRestart = () => {
    if (window.confirm('Start a new game? Current progress will be lost.')) {
      window.location.reload();
    }
  };

  const handleChallenge = (word: string) => {
    const success = challengeWord(word);
    setChallengeResult({ word, success });
  };

  const handleAcceptHint = () => {
    if (!hint) return;
    setSelectedTile(null);
    const res = submitPlay(hint.placements);
    if (!res.success) {
      // Defensive fallback — board state changed since the hint was generated
      // and it's no longer valid. Just place the tiles so the player can see
      // why and adjust, rather than silently failing.
      hint.placements.forEach(p => placeTileTemp(p.r, p.c, p.letter));
    }
  };

  const handleRewind = (turnIndex: number) => {
    if (window.confirm('Rewind to before this move? Everything that happened after it will be undone.')) {
      setSelectedTile(null);
      rewindToTurn(turnIndex);
    }
  };

  const preview = getPlacementsPreview();
  const winner = gameEnded && winnerId !== null ? players.find(p => p.id === winnerId) : null;
  const finalMove = gameEnded ? [...history].reverse().find(h => h.type === 'play') : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-[#11161f] text-slate-100">
      <Header onRestart={handleRestart} gameStarted={gameStarted} winnerId={winnerId} players={players} />

      {!gameStarted ? (
        <GameSettings onStart={startNewGame} isLoading={!dictLoaded} dictProgress={dictLoadingProgress} />
      ) : (
        <main className="flex-1 flex flex-col lg:flex-row p-4 md:p-6 gap-6 max-w-7xl w-full mx-auto min-h-0">

          {/* Board + Rack */}
          <div className="flex-1 flex flex-col items-center gap-4 min-h-0 justify-center">

            {/* Live word validation preview */}
            {placements.length > 0 && preview && (
              <div className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md animate-popup border flex flex-wrap items-center gap-2 ${
                preview.isValid
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {preview.isValid ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      {preview.wordsFormed?.map(w => w.word).join(' + ')} — {preview.score} pts
                    </span>
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{preview.error}</span>
                    {preview.invalidWord && (
                      challengeResult?.word === preview.invalidWord ? (
                        challengeResult.success ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-normal">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Added — try Submit again
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400 font-normal">
                            <XCircle className="h-3.5 w-3.5" />
                            Not a recognised word in any dictionary
                          </span>
                        )
                      ) : (
                        <button
                          onClick={() => handleChallenge(preview.invalidWord!)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-semibold transition-all active:scale-95 cursor-pointer"
                          title="Add this word to the dictionary if it's a real everyday word"
                        >
                          <ShieldQuestion className="h-3.5 w-3.5" />
                          Challenge '{preview.invalidWord}'
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            )}

            <Board
              board={board}
              placements={placements}
              onCellClick={handleCellClick}
              onDropTile={handleDropTile}
              selectedLetter={selectedTile?.letter ?? null}
              hint={bestMovePreview || hint}
              lastPlayPlacements={lastPlayPlacements}
            />

            <Rack
              rack={activeRack}
              selectedTileIdx={selectedTile?.idx ?? null}
              onSelectTile={(letter, idx) => setSelectedTile(prev => prev?.idx === idx ? null : { letter, idx })}
              onDeselectTile={() => setSelectedTile(null)}
              onShuffle={shuffleRack}
              onRecall={recallTiles}
              onSubmit={submitPlay}
              onPass={passTurn}
              onExchange={exchangeTiles}
              onDropTile={handleDropTile}
              onReorder={reorderRack}
              bagCount={tileBag.length}
              hasPlacements={placements.length > 0}
            />
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[340px] flex flex-col gap-4 shrink-0 overflow-y-auto no-scrollbar max-h-[90vh]">
            <Scoreboard
              players={players} currentTurn={currentTurn}
              isAiThinking={isAiThinking} winnerId={winnerId} gameEnded={gameEnded}
              onRenamePlayer={renamePlayer}
            />
            <TileBagInfo bag={tileBag} />
            <CoachPanel
              onGetHint={() => setNoHintAvailable(!getHint())} onClearHint={clearHint} onAcceptHint={handleAcceptHint}
              activeHint={hint} coachAnalysis={coachAnalysis}
              onCloseAnalysis={closeCoachAndAdvance}
              onShowBestMovePreview={setBestMovePreview}
              hasPlacements={placements.length > 0}
              coachEnabled={coachEnabled}
              onToggleCoach={setCoachEnabled}
              isAiTurn={!!players[currentTurn]?.isAi}
              humanMovesReady={humanMovesReady}
              noHintAvailable={noHintAvailable}
            />
            <MoveLog history={history} players={players} onRemoveWord={removeWord}
              onRewind={handleRewind} canRewindTo={(idx) => idx < turnSnapshots.length} />
          </div>
        </main>
      )}

      <footer className="shrink-0 py-3 text-center">
        <p className="text-[10px] italic text-slate-500">©MMXXVI Michael O'Sullivan</p>
      </footer>

      {/* Game-over modal */}
      {gameEnded && winner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-3xl border border-white/10 shadow-2xl p-8 text-center animate-popup">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6 animate-bounce">
              <Trophy className="h-10 w-10" />
            </div>
            <h2 className="font-serif-luxury text-3xl font-bold text-white mb-2">Game Over!</h2>
            <p className="text-xs text-slate-400 mb-4">Final scores (rack penalties applied)</p>
            {finalMove && (
              <div className="mb-6 p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Final Play</p>
                <p className="text-xs text-slate-300">
                  <span className="font-bold text-slate-100">{finalMove.playerName}</span> played{' '}
                  <span className="font-serif-luxury font-bold text-red-300 text-sm">
                    {finalMove.allWords?.join(' + ') || finalMove.word}
                  </span>{' '}
                  for <span className="font-mono font-bold text-white">{finalMove.score} pts</span>
                </p>
              </div>
            )}
            <div className="space-y-3 mb-8">
              {[...players].sort((a, b) => b.score - a.score).map((player, idx) => (
                <div key={player.id} className={`flex items-center justify-between p-3.5 rounded-xl border ${
                  player.id === winnerId
                    ? 'bg-emerald-500/10 border-emerald-500/30 font-bold'
                    : 'bg-slate-950/40 border-white/5'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-slate-500">{idx + 1}.</span>
                    <span className="text-xs text-slate-200">{player.name}</span>
                    {player.id === winnerId && <CrownIcon className="h-3.5 w-3.5 text-yellow-400 fill-current" />}
                  </div>
                  <span className="font-mono text-sm text-white">
                    {player.score} <span className="text-[10px] text-slate-500 font-sans uppercase font-normal">pts</span>
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Play Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CrownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="currentColor" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M5 20h14" />
    </svg>
  );
}

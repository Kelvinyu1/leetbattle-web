import { useEffect, useState } from 'react';
import { useSocket } from './lib/useSocket';
import Editor from '@monaco-editor/react';

export default function App() {
  const { socket, connected } = useSocket();
  const [view, setView] = useState('lobby');
  const [state, setState] = useState({});
  const [code, setCode] = useState('');
  const [name, setName] = useState('Player');
  const [selfUserId, setSelfUserId] = useState(null);
  const [scoreboard, setScoreboard] = useState([]);
  const [rematchStatus, setRematchStatus] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('session', ({ userId }) => setSelfUserId(userId));
    socket.on('scoreboard.update', (list) => setScoreboard(list));

    socket.on('queue.status', (p) => setState((s) => ({ ...s, queue: p.status })));

    // First round for a newly formed room (server now emits match.start)
    socket.on('match.start', (p) => {
      // reset per-round state
      setState(p);
      setCode(p.problem.starter_code.javascript || 'module.exports = () => {};');
      setRematchStatus(null);
      setView('room');
    });

    // Back-compat if server still sends match.found (shouldn’t after this patch)
    socket.on('match.found', (p) => {
      setState(p);
      setCode(p.problem.starter_code.python || 'module.exports = () => {};');
      setRematchStatus(null);
      setView('room');
    });

    socket.on('timer.tick', (t) => setState((s) => ({ ...s, remaining: t.remaining })));
    socket.on('submission.result', (r) => setState((s) => ({ ...s, lastResult: r })));
    socket.on('match.over', (m) => setState((s) => ({ ...s, over: m })));

    socket.on('rematch.status', ({ readyCount, total }) => {
      setRematchStatus({ readyCount, total });
    });

    return () => {
      socket.off('session');
      socket.off('scoreboard.update');
      socket.off('queue.status');
      socket.off('match.start');
      socket.off('match.found');
      socket.off('timer.tick');
      socket.off('submission.result');
      socket.off('match.over');
      socket.off('rematch.status');
    };
  }, [socket]);

  function findMatch() {
    socket?.emit('queue.join', { name: name || 'Player' });
  }

  function submit() {
    socket?.emit('room.submit', { matchId: state.matchId, code, lang: 'python' });
  }

  function requestRematch() {
    socket?.emit('rematch.request');
  }

  if (view === 'lobby') {
    return (
      <div className="wrap">
        <h1>Leet Battle</h1>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <button disabled={!connected} onClick={findMatch}>
            {connected ? 'Find Match' : 'Connecting...'}
          </button>
        </div>

        {/* Scoreboard shown on lobby too */}
        {scoreboard.length > 0 && (
          <>
            <h3 style={{ marginTop: 24 }}>🏆 Leaderboard</h3>
            <ol>
              {scoreboard.slice(0, 10).map((p) => (
                <li key={p.userId}>
                  {p.name} — {p.wins}W/{p.losses}L
                </li>
              ))}
            </ol>
          </>
        )}

        {state.queue === 'waiting' && <p>⏳ Waiting for an opponent… open a second window to test.</p>}
      </div>
    );
  }

  const youWin = state.over?.winnerId && selfUserId && state.over.winnerId === selfUserId;

  return (
    <div className="grid">
      <div className="left">
        <h2>{state.problem?.title}</h2>
        <p className="meta">
          Difficulty: {state.problem?.difficulty}{' '}
          {state.problem?.url && (
            <>
              · <a href={state.problem.url} target="_blank" rel="noreferrer">Open on LeetCode</a>
            </>
          )}
        </p>
        <pre className="statement">{state.problem?.statement}</pre>

        <p>⏱️ Time left: {state.remaining ?? state.countdownSeconds}s</p>

        {state.lastResult && (
          <div className={`verdict ${state.lastResult.verdict === 'Accepted' ? 'ok' : 'bad'}`}>
            Last verdict: {state.lastResult.verdict} ({state.lastResult.passCount}/{state.lastResult.total}) · {state.lastResult.timeMs} ms
            {state.lastResult.error && <div className="err">{String(state.lastResult.error)}</div>}
          </div>
        )}

        {state.over && (
          <>
            <h3>🏁 {state.over.winnerId ? (youWin ? 'You win!' : 'You lose.') : 'Time up!'}</h3>
            <button className="submit" onClick={requestRematch}>🔁 Rematch</button>
            {rematchStatus && (
              <p>Rematch ready: {rematchStatus.readyCount}/{rematchStatus.total}</p>
            )}
          </>
        )}

        {/* Leaderboard in-room */}
        {scoreboard.length > 0 && (
          <>
            <h3 style={{ marginTop: 24 }}>🏆 Leaderboard</h3>
            <ol>
              {scoreboard.slice(0, 10).map((p) => (
                <li key={p.userId}>
                  {p.name} — {p.wins}W/{p.losses}L
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div className="right">
        <Editor
          height="70vh"
          defaultLanguage="python"
          value={code}
          onChange={(v) => setCode(v || '')}
          options={{ minimap: { enabled: false } }}
        />
        <button className="submit" onClick={submit} disabled={!!state.over}>Submit</button>
      </div>
    </div>
  );
}


/**
 * ApiKeyPanel.tsx
 *
 * Anthropic API key entry, shared by ChordAI and the Practice Coach. Setting
 * the key in either place sets it for both (useApiKeyStore).
 *
 * Setting the key unmounts the form, so focus moves to the active line's
 * Clear button; clearing moves it back to the key field.
 */

import { useEffect, useRef, useState } from 'react';
import { apiKeyProblem, useApiKeyStore } from '../../ai/apiKey';
import { Button, Panel, Switch, TextField } from '../../ui';

export default function ApiKeyPanel() {
  const apiKey = useApiKeyStore((s) => s.apiKey);
  const remembered = useApiKeyStore((s) => s.remembered);
  const setApiKey = useApiKeyStore((s) => s.setApiKey);
  const clearApiKey = useApiKeyStore((s) => s.clearApiKey);

  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);

  const apiKeySet = apiKey !== '';
  const problem = apiKeyProblem(input);
  const canSet = input.trim() !== '' && !problem;

  const keyFieldRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const prevKeySet = useRef(apiKeySet);

  useEffect(() => {
    // Only on a change (a user set/clear), never on mount
    if (prevKeySet.current === apiKeySet) return;
    prevKeySet.current = apiKeySet;
    if (apiKeySet) clearRef.current?.focus();
    else keyFieldRef.current?.focus();
  }, [apiKeySet]);

  const submit = () => {
    if (!canSet) return;
    setApiKey(input, remember);
    setInput('');
    setShow(false);
  };

  return (
    <Panel title="Anthropic API key" headingLevel={3}>
      {!apiKeySet ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <TextField
              ref={keyFieldRef}
              className="flex-1"
              label="Anthropic API key"
              hideLabel
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="sk-ant-api..."
              aria-invalid={problem ? true : undefined}
              hint={
                problem ??
                (remember
                  ? 'Saved in this browser until you clear it. Used for ChordAI and the Coach.'
                  : 'Held in memory until you reload. Used for ChordAI and the Coach.')
              }
              trailing={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide API key' : 'Show API key'}
                  title={show ? 'Hide key' : 'Show key'}
                >
                  {show ? 'Hide' : 'Show'}
                </Button>
              }
            />
            <Button variant="secondary" onClick={submit} disabled={!canSet}>
              Set key
            </Button>
          </div>
          <Switch checked={remember} onChange={setRemember} label="Remember on this device" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">
            {remembered ? 'Key saved on this device' : 'Key active until you reload'}
          </p>
          <Button ref={clearRef} variant="ghost" size="sm" onClick={clearApiKey}>
            Clear
          </Button>
        </div>
      )}
    </Panel>
  );
}

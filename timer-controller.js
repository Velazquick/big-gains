((scope) => {
  'use strict';

  const PLAY_START_TIMEOUT_MS = 900;
  const TIMER_GESTURE_SELECTOR = '#startWorkout,#quickStartSession,#loadRoutine,#addSelectedExercise,[data-add],[data-complete-set],[data-timer-preset],#returnToWorkout';

  function create({
    getState,
    getActiveWorkout,
    persist,
    resolveRestDuration,
    setPetState,
    getElement,
    formatTime,
    defaultRest = 150,
    documentTarget = document,
    windowTarget = window,
    navigatorTarget = navigator,
    now = () => Date.now(),
    scheduleInterval = (callback, delay) => windowTarget.setInterval(callback, delay),
    cancelInterval = handle => windowTarget.clearInterval(handle),
    scheduleTimeout = (callback, delay) => windowTarget.setTimeout(callback, delay),
    cancelTimeout = handle => windowTarget.clearTimeout(handle),
    warn = (...args) => console.warn(...args)
  }) {
    const requiredPorts = { getState, getActiveWorkout, persist, resolveRestDuration, setPetState, getElement, formatTime };
    for (const [name, port] of Object.entries(requiredPorts)) {
      if (typeof port !== 'function') throw new TypeError(`Big Gains TimerController requires ${name}().`);
    }

    let initialized = false;
    let ticker = null;
    let runGeneration = 0;
    let remainingSeconds = defaultRest;
    let idleSeconds = defaultRest;
    let nextOverrideSeconds = null;
    let feedbackReset = null;
    let feedbackGeneration = 0;
    let lastAnnouncedCompletionKey = null;
    let soundSessionState = 'unverified';
    let lastFeedbackCompletionKey = null;

    const element = id => getElement(id);
    const activeWorkout = () => getActiveWorkout() || null;
    const currentState = () => getState();
    const vibrationAvailable = () => typeof navigatorTarget.vibrate === 'function';
    const audioElement = () => element('timerCompletionAudio');
    const audioSupported = () => typeof audioElement()?.play === 'function';
    const audioAvailable = () => audioSupported() && soundSessionState !== 'unavailable';
    const restLabel = seconds => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

    function timerPreferences() {
      const state = currentState();
      if (!state.timerPreferences) state.timerPreferences = { sound: true, vibration: true };
      return state.timerPreferences;
    }

    function currentRestDeadline() {
      const deadline = Number(currentState()?.restTimerEndsAt);
      return activeWorkout() && Number.isFinite(deadline) && deadline > 0 ? deadline : null;
    }

    function renderTimer() {
      const display = element('timerDisplay');
      if (display) display.textContent = formatTime(remainingSeconds);
    }

    function setTimerPresetsOpen(open) {
      element('timerPresets')?.classList.toggle('hidden', !open);
      element('timerAdjust')?.setAttribute('aria-expanded', String(open));
    }

    function stopTicker() {
      runGeneration += 1;
      cancelInterval(ticker);
      ticker = null;
    }

    function clearCompletionFeedback() {
      feedbackGeneration += 1;
      cancelTimeout(feedbackReset);
      feedbackReset = null;
      element('timerCard')?.classList.remove('timer-feedback-ready', 'timer-completing');
      const status = element('timerFeedbackStatus');
      if (status) status.textContent = '';
    }

    function setLifecycle(next, { message, status = '', remaining = remainingSeconds } = {}) {
      const card = element('timerCard');
      if (!card) return false;
      card.classList.remove('hidden', 'timer-feedback-ready', 'timer-completing', 'timer-dismissing');
      card.dataset.timerState = next;
      if (next === 'ready') card.classList.add('timer-feedback-ready', 'timer-completing');
      if (next === 'idle') card.classList.add('hidden');
      remainingSeconds = Math.max(0, Number(remaining) || 0);
      renderTimer();
      const nextMessage = element('timerNext');
      if (nextMessage) nextMessage.textContent = message;
      const feedbackStatus = element('timerFeedbackStatus');
      if (feedbackStatus) feedbackStatus.textContent = status;
      const deadline = currentRestDeadline();
      const skip = element('timerSkip');
      if (skip) skip.disabled = !(next === 'running' && deadline && deadline > now());
      return true;
    }

    function setFeedbackStatus(message) {
      const status = element('timerFeedbackStatus');
      if (status) status.textContent = message;
    }

    function showIdle(message = 'Timer ready. Complete a set to start rest.') {
      const deadline = currentRestDeadline();
      if (deadline) return deadline <= now() ? complete(deadline) : run();
      stopTicker();
      clearCompletionFeedback();
      setLifecycle('idle', { message, remaining: idleSeconds });
      return true;
    }

    function deactivate() {
      stopTicker();
      clearCompletionFeedback();
      idleSeconds = defaultRest;
      nextOverrideSeconds = null;
      setTimerPresetsOpen(false);
      const card = element('timerCard');
      if (card) {
        card.dataset.timerState = 'unavailable';
        card.classList.add('hidden');
      }
      const skip = element('timerSkip');
      if (skip) skip.disabled = true;
      return true;
    }

    function showCompletionFeedback(completionKey) {
      if (completionKey === lastAnnouncedCompletionKey) return false;
      lastAnnouncedCompletionKey = completionKey;
      clearCompletionFeedback();
      const expectedFeedbackGeneration = feedbackGeneration;
      setLifecycle('ready', {
        message: "Rest complete. You're up.",
        status: 'Rest complete. Ready for your next set.',
        remaining: 0
      });
      feedbackReset = scheduleTimeout(() => {
        if (
          expectedFeedbackGeneration === feedbackGeneration
          && activeWorkout()
          && !currentRestDeadline()
          && element('timerCard')?.dataset.timerState === 'ready'
        ) showIdle('Ready for your next set.');
      }, 3000);
      return true;
    }

    function resetAudio(audio) {
      if (!audio) return;
      try { audio.pause(); } catch {}
      try { audio.currentTime = 0; } catch {}
    }

    function markAudioUnavailable(reason, error) {
      soundSessionState = 'unavailable';
      renderPreferences();
      if (error) warn(`Timer sound ${reason}`, error);
      return { ok: false, reason };
    }

    function isDirectUserGesture(event) {
      return Boolean(event && event.isTrusted);
    }

    function attemptAudioFromGesture(event, { quiet = false, markFailure = false } = {}) {
      if (!timerPreferences().sound) return { ok: false, reason: 'disabled' };
      if (!isDirectUserGesture(event)) return { ok: false, reason: 'gesture' };
      if (soundSessionState === 'unavailable') return { ok: false, reason: 'unavailable' };
      const audio = audioElement();
      if (!audioSupported()) return markFailure ? markAudioUnavailable('unsupported') : { ok: false, reason: 'unsupported' };
      resetAudio(audio);
      const previousVolume = audio.volume;
      if (quiet) {
        // Keep the element technically audible for iOS/WebKit media unlocking, but
        // reduce the arm to the least perceptible level and stop it on `playing`.
        try { audio.volume = .01; } catch {}
      }

      let timeoutId = null;
      let playingListener = null;
      let settled = false;
      const restore = () => {
        if (!quiet) return;
        resetAudio(audio);
        try { audio.volume = previousVolume; } catch {}
      };
      const cleanup = () => {
        if (settled) return;
        settled = true;
        audio.removeEventListener('playing', playingListener);
        cancelTimeout(timeoutId);
      };
      const started = new Promise(resolve => {
        playingListener = () => {
          restore();
          resolve();
        };
        audio.addEventListener('playing', playingListener);
      });
      const timedOut = new Promise(resolve => {
        timeoutId = scheduleTimeout(() => resolve({ ok: false, reason: 'timeout' }), PLAY_START_TIMEOUT_MS);
      });
      let playPromise;
      try {
        // This call intentionally remains in the trusted click task. Moving it past
        // an await breaks iOS/WebKit playback permission.
        playPromise = audio.play();
      } catch (error) {
        cleanup();
        restore();
        return markFailure ? markAudioUnavailable('rejected', error) : { ok: false, reason: 'rejected' };
      }
      const playback = Promise.all([Promise.resolve(playPromise), started])
        .then(() => ({ ok: true, reason: 'success' }), error => ({ ok: false, reason: 'rejected', error }));
      return Promise.race([playback, timedOut]).then(result => {
        cleanup();
        if (!result.ok) {
          restore();
          if (markFailure) return markAudioUnavailable(result.reason, result.error);
          soundSessionState = 'unverified';
          if (result.error) warn(`Timer sound arm ${result.reason}`, result.error);
          return { ok: false, reason: result.reason };
        }
        soundSessionState = 'verified';
        renderPreferences();
        return result;
      });
    }

    function armFromGesture(event) {
      if (soundSessionState === 'verified') return Promise.resolve({ ok: true, reason: 'already-verified' });
      if (soundSessionState === 'arming') return Promise.resolve({ ok: false, reason: 'arming' });
      soundSessionState = 'arming';
      const attempt = attemptAudioFromGesture(event, { quiet: true, markFailure: false });
      return Promise.resolve(attempt).then(result => {
        if (!result.ok && soundSessionState === 'arming') soundSessionState = 'unverified';
        return result;
      });
    }

    async function verifyFromGesture(event) {
      return attemptAudioFromGesture(event, { quiet: false, markFailure: true });
    }

    function playVerifiedCompletion() {
      if (soundSessionState !== 'verified' || !timerPreferences().sound) return false;
      const audio = audioElement();
      if (!audioSupported()) return false;
      resetAudio(audio);
      let settled = false;
      let timeoutId = null;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        cancelTimeout(timeoutId);
        audio.removeEventListener('playing', onPlaying);
      };
      const fail = (reason, error) => {
        if (settled) return;
        cleanup();
        resetAudio(audio);
        markAudioUnavailable(reason, error);
      };
      const onPlaying = () => cleanup();
      audio.addEventListener('playing', onPlaying);
      timeoutId = scheduleTimeout(() => fail('timeout'), PLAY_START_TIMEOUT_MS);
      try {
        const playPromise = audio.play();
        Promise.resolve(playPromise).catch(error => fail('rejected', error));
        return true;
      } catch (error) {
        fail('rejected', error);
        return false;
      }
    }

    function completeFeedback(completionKey) {
      if (completionKey && completionKey === lastFeedbackCompletionKey) {
        return { sounded: false, vibrated: false, duplicate: true };
      }
      lastFeedbackCompletionKey = completionKey || null;
      let sounded = false;
      let vibrated = false;
      // Completion never verifies or retries audio. It requests one playback only
      // after successful session arming and never blocks the visual cue.
      if (timerPreferences().sound) sounded = playVerifiedCompletion();
      if (timerPreferences().vibration && vibrationAvailable()) {
        try { vibrated = navigatorTarget.vibrate([150, 80, 150]) !== false; } catch { vibrated = false; }
      }
      return { sounded, vibrated };
    }

    const feedback = Object.freeze({
      armFromGesture,
      verifyFromGesture,
      complete: completeFeedback,
      audioAvailable,
      vibrationAvailable,
      getSoundSessionState: () => soundSessionState
    });

    function complete(deadline, workoutId = activeWorkout()?.id) {
      const expectedDeadline = Number(deadline);
      const currentDeadline = currentRestDeadline();
      const active = activeWorkout();
      if (!active || active.id !== workoutId || currentDeadline !== expectedDeadline || expectedDeadline > now()) return false;
      const completionKey = `${workoutId}:${expectedDeadline}`;
      stopTicker();
      currentState().restTimerEndsAt = null;
      persist();
      setPetState('ready');
      showCompletionFeedback(completionKey);
      completeFeedback(completionKey);
      return true;
    }

    function run() {
      stopTicker();
      clearCompletionFeedback();
      const deadline = currentRestDeadline();
      const workoutId = activeWorkout()?.id;
      if (!deadline) {
        if (activeWorkout()) showIdle();
        else deactivate();
        return false;
      }
      if (deadline <= now()) return complete(deadline, workoutId);
      const expectedRunGeneration = runGeneration;
      setLifecycle('running', {
        message: 'Recover. Your next set is waiting.',
        remaining: Math.max(0, Math.ceil((deadline - now()) / 1000))
      });
      setPetState('attentive');
      const tick = () => {
        if (
          expectedRunGeneration !== runGeneration
          || activeWorkout()?.id !== workoutId
          || currentRestDeadline() !== deadline
        ) return false;
        remainingSeconds = Math.max(0, Math.ceil((deadline - now()) / 1000));
        renderTimer();
        if (remainingSeconds <= 0) return complete(deadline, workoutId);
        return true;
      };
      if (tick()) ticker = scheduleInterval(tick, 1000);
      return true;
    }

    function reconcile() {
      if (!activeWorkout()) {
        deactivate();
        return false;
      }
      const deadline = currentRestDeadline();
      if (!deadline) {
        if (['running', 'unavailable'].includes(element('timerCard')?.dataset.timerState)) showIdle();
        else {
          const skip = element('timerSkip');
          if (skip) skip.disabled = true;
        }
        if (documentTarget.body?.dataset.workoutPetState !== 'ready') setPetState('calm');
        return true;
      }
      if (deadline <= now()) return complete(deadline);
      return run();
    }

    function start(exerciseIndex) {
      const active = activeWorkout();
      const state = currentState();
      if (!active || !state) return false;
      const seconds = Number(resolveRestDuration({
        activeWorkout: active,
        state,
        exerciseIndex,
        defaultRest,
        overrideSeconds: nextOverrideSeconds
      })) || defaultRest;
      const exercise = active.exercises?.[exerciseIndex];
      state.restTimerEndsAt = now() + seconds * 1000;
      persist();
      run();
      const message = element('timerNext');
      if (message && exercise) message.textContent = `${exercise.name} · ${restLabel(seconds)} recovery.`;
      idleSeconds = seconds;
      nextOverrideSeconds = null;
      return seconds;
    }

    function skip() {
      if (!activeWorkout()) return false;
      stopTicker();
      const state = currentState();
      if (state.restTimerEndsAt !== null) {
        state.restTimerEndsAt = null;
        persist();
      }
      setTimerPresetsOpen(false);
      showIdle('Rest skipped. Timer ready for the next set.');
      setPetState('calm');
      return true;
    }

    function selectPreset(seconds) {
      seconds = Number(seconds);
      if (!Number.isFinite(seconds) || seconds <= 0) return false;
      const deadline = currentRestDeadline();
      setTimerPresetsOpen(false);
      if (deadline && deadline > now()) {
        currentState().restTimerEndsAt = now() + seconds * 1000;
        idleSeconds = seconds;
        persist();
        run();
        return true;
      }
      idleSeconds = seconds;
      nextOverrideSeconds = seconds;
      showIdle(`Next rest set to ${formatTime(seconds)}.`);
      return true;
    }

    function acknowledgeReady() {
      if (documentTarget.body?.dataset.workoutPetState !== 'ready') return false;
      setPetState('calm');
      return true;
    }

    function renderPreferences() {
      const preferences = timerPreferences();
      const sound = element('timerSoundToggle');
      const vibration = element('timerVibrationToggle');
      const soundAvailable = audioAvailable();
      if (sound) {
        sound.disabled = !soundAvailable;
        sound.setAttribute('aria-disabled', String(!soundAvailable));
        sound.setAttribute('aria-pressed', String(soundAvailable && preferences.sound));
        sound.textContent = soundAvailable ? `Sound ${preferences.sound ? 'on' : 'off'}` : 'Sound unavailable';
      }
      if (vibration) {
        const available = vibrationAvailable();
        vibration.hidden = !available;
        vibration.disabled = !available;
        vibration.setAttribute('aria-disabled', String(!available));
        vibration.setAttribute('aria-pressed', String(available && preferences.vibration));
        vibration.textContent = `Vibration ${preferences.vibration ? 'on' : 'off'}`;
      }
    }

    function togglePreference(name) {
      const preferences = timerPreferences();
      preferences[name] = !preferences[name];
      persist();
      renderPreferences();
      return preferences[name];
    }

    function soundResultMessage(result) {
      if (result.ok) return 'Sound on. Chime confirmed.';
      if (result.reason === 'timeout') return 'Sound unavailable this session: playback did not start.';
      if (result.reason === 'rejected') return 'Sound unavailable this session: playback was rejected.';
      if (result.reason === 'gesture') return 'Sound verification requires a direct tap or click.';
      return 'Sound is unavailable for this browser session.';
    }

    function bind(id, event, handler) {
      element(id)?.addEventListener(event, handler);
    }

    function initialize() {
      if (initialized) return false;
      initialized = true;
      documentTarget.addEventListener('click', event => {
        if (!event.target?.closest?.(TIMER_GESTURE_SELECTOR)) return;
        armFromGesture(event).catch(error => warn('Timer sound arm failed safely', error));
      }, true);
      bind('timerAdjust', 'click', () => setTimerPresetsOpen(element('timerAdjust')?.getAttribute('aria-expanded') !== 'true'));
      bind('timerPresets', 'click', event => {
        const preset = event.target.closest('[data-timer-preset]');
        if (preset) selectPreset(preset.dataset.timerPreset);
      });
      bind('timerSkip', 'click', skip);
      bind('timerSoundToggle', 'click', async event => {
        const enabled = togglePreference('sound');
        if (!enabled) {
          setFeedbackStatus('Sound off. Visual feedback stays on.');
          return;
        }
        const result = await verifyFromGesture(event);
        setFeedbackStatus(soundResultMessage(result));
      });
      bind('timerVibrationToggle', 'click', () => {
        if (vibrationAvailable()) togglePreference('vibration');
      });
      documentTarget.addEventListener('visibilitychange', () => {
        if (documentTarget.visibilityState === 'visible') reconcile();
      });
      windowTarget.addEventListener('pageshow', reconcile);
      windowTarget.addEventListener('focus', reconcile);
      renderPreferences();
      return true;
    }

    function getStatus() {
      const active = activeWorkout();
      const deadline = currentRestDeadline();
      const identity = deadline && active ? Object.freeze({ activeWorkoutId: active.id, exactDeadline: deadline }) : null;
      return Object.freeze({
        activeWorkoutId: active?.id || null,
        deadline,
        feedbackPending: feedbackReset !== null,
        identity,
        idleSeconds,
        initialized,
        lastAnnouncedCompletionKey,
        lifecycle: element('timerCard')?.dataset.timerState || (active ? 'idle' : 'unavailable'),
        oneShotOverrideSeconds: nextOverrideSeconds,
        remainingSeconds,
        soundSessionState,
        tickerActive: ticker !== null
      });
    }

    return Object.freeze({
      acknowledgeReady,
      deactivate,
      feedback,
      getStatus,
      initialize,
      reconcile,
      renderPreferences,
      selectPreset,
      skip,
      start
    });
  }

  Object.defineProperty(scope, 'BigGainsTimerController', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ create }),
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);

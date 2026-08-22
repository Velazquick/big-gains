((scope) => {
  'use strict';

  const CONTRACT = 'big-gains.program-origin.v1';
  const SLOT_INDEX_BASE = 0;
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' ? value.trim() : '';
  const validDate = value => Number.isFinite(Date.parse(value));
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function normalize(value, { accountId = null, profileId = null } = {}) {
    if (!isRecord(value) || value.contract !== CONTRACT) return null;
    const normalized = {
      contract: CONTRACT,
      accountId: text(value.accountId),
      profileId: text(value.profileId),
      programId: text(value.programId),
      programVersionId: text(value.programVersionId),
      routineId: text(value.routineId),
      routineVersionId: text(value.routineVersionId),
      slotId: text(value.slotId),
      slotIndex: Number(value.slotIndex),
      cycleNumber: Number(value.cycleNumber),
      materializedAt: validDate(value.materializedAt) ? new Date(value.materializedAt).toISOString() : null
    };
    if (!normalized.accountId || !normalized.profileId || !normalized.programId
      || !normalized.programVersionId || !normalized.routineId || !normalized.routineVersionId
      || !normalized.slotId || !Number.isInteger(normalized.slotIndex) || normalized.slotIndex < 0
      || !Number.isInteger(normalized.cycleNumber) || normalized.cycleNumber < 1
      || !normalized.materializedAt
      || (accountId && normalized.accountId !== accountId)
      || (profileId && normalized.profileId !== profileId)) return null;
    return freeze(normalized);
  }

  function snapshot({ accountId, profileId, programVersion, routineVersion, slotIndex, sequenceState, materializedAt }) {
    const index = Number(slotIndex);
    const slot = programVersion?.slots?.[index];
    if (!accountId || !profileId || !isRecord(programVersion) || !isRecord(routineVersion)
      || programVersion.accountId !== accountId || programVersion.profileId !== profileId
      || routineVersion.accountId !== accountId || routineVersion.profileId !== profileId
      || !slot || slot.routineId !== routineVersion.routineId
      || slot.routineVersionId !== routineVersion.routineVersionId
      || sequenceState?.programId !== programVersion.programId
      || sequenceState?.programVersionId !== programVersion.programVersionId
      || Number(sequenceState?.nextSlotIndex) !== index
      || !Number.isInteger(Number(sequenceState?.completedCycles))
      || Number(sequenceState.completedCycles) < 0 || !validDate(materializedAt)) {
      throw new Error('Program session materialization requires one exact active Program slot and pinned Routine version.');
    }
    return normalize({
      contract: CONTRACT,
      accountId,
      profileId,
      programId: programVersion.programId,
      programVersionId: programVersion.programVersionId,
      routineId: routineVersion.routineId,
      routineVersionId: routineVersion.routineVersionId,
      slotId: slot.slotId,
      slotIndex: index,
      cycleNumber: Number(sequenceState.completedCycles) + 1,
      materializedAt
    }, { accountId, profileId });
  }

  function materializeNext({ capture, accountId, profileId, catalog = null, materializedAt = new Date().toISOString() }) {
    const model = scope.BigGainsProgramModel;
    if (!model?.normalizeCapture) throw new Error('Program model is unavailable.');
    const stored = model.normalizeCapture(capture, { accountId, profileId, catalog });
    const programVersion = stored.programVersions.find(version => version.programVersionId === stored.activeProgramVersionId);
    const sequenceState = stored.sequenceState;
    if (!programVersion || !sequenceState
      || sequenceState.programId !== programVersion.programId
      || sequenceState.programVersionId !== programVersion.programVersionId) {
      throw new Error('An active Program with explicit rolling sequence state is required.');
    }
    const slotIndex = Number(sequenceState.nextSlotIndex);
    const slot = programVersion.slots[slotIndex];
    const routineVersion = stored.routineVersions.find(version => version.routineVersionId === slot?.routineVersionId);
    if (!slot || !routineVersion || routineVersion.routineId !== slot.routineId) {
      throw new Error('The next Program slot does not have its exact pinned Routine version.');
    }
    return freeze({
      programOrigin: snapshot({ accountId, profileId, programVersion, routineVersion, slotIndex, sequenceState, materializedAt }),
      programVersion: clone(programVersion),
      routineVersion: clone(routineVersion),
      slot: clone(slot),
      slotIndex
    });
  }

  function advanceCaptureForCompletion({ capture, programOrigin, accountId, profileId, catalog = null, completedAt = new Date().toISOString() }) {
    const model = scope.BigGainsProgramModel;
    if (!model?.normalizeCapture || !model?.advanceSequence) throw new Error('Program model is unavailable.');
    const stored = model.normalizeCapture(capture, { accountId, profileId, catalog });
    const origin = normalize(programOrigin, { accountId, profileId });
    if (!origin) return freeze({ capture: stored, advanced: false, reasonCode: 'NO_PROGRAM_ORIGIN' });
    const programVersion = stored.programVersions.find(version => version.programVersionId === stored.activeProgramVersionId);
    const sequence = stored.sequenceState;
    const slot = programVersion?.slots?.[origin.slotIndex];
    const currentCycle = Number(sequence?.completedCycles) + 1;
    const matches = programVersion
      && programVersion.programId === origin.programId
      && programVersion.programVersionId === origin.programVersionId
      && sequence?.programId === origin.programId
      && sequence?.programVersionId === origin.programVersionId
      && Number(sequence?.nextSlotIndex) === origin.slotIndex
      && currentCycle === origin.cycleNumber
      && slot?.slotId === origin.slotId
      && slot?.routineId === origin.routineId
      && slot?.routineVersionId === origin.routineVersionId;
    if (!matches) return freeze({ capture: stored, advanced: false, reasonCode: 'SEQUENCE_STATE_NO_LONGER_MATCHES_ORIGIN' });
    const next = {
      ...stored,
      sequenceState: model.advanceSequence(sequence, programVersion, () => new Date(completedAt).toISOString())
    };
    return freeze({ capture: next, advanced: true, reasonCode: 'SEQUENCE_ADVANCED_ON_COMPLETION' });
  }

  function matchesProgramSlot(origin, programVersion) {
    const slot = programVersion?.slots?.[origin.slotIndex];
    return Boolean(slot)
      && origin.programId === programVersion.programId
      && origin.programVersionId === programVersion.programVersionId
      && slot.slotId === origin.slotId
      && slot.routineId === origin.routineId
      && slot.routineVersionId === origin.routineVersionId;
  }

  function completedCycleNumbers({ workouts, programVersion, accountId = programVersion?.accountId, profileId = programVersion?.profileId }) {
    if (!isRecord(programVersion) || !Array.isArray(programVersion.slots) || !programVersion.slots.length) return freeze([]);
    const byCycle = new Map();
    (Array.isArray(workouts) ? workouts : []).forEach(workout => {
      if (!validDate(workout?.completedAt)) return;
      const origin = normalize(workout.programOrigin, { accountId, profileId });
      if (!origin || !matchesProgramSlot(origin, programVersion)) return;
      if (!byCycle.has(origin.cycleNumber)) byCycle.set(origin.cycleNumber, new Set());
      byCycle.get(origin.cycleNumber).add(origin.slotIndex);
    });
    return freeze([...byCycle.entries()]
      .filter(([, slots]) => programVersion.slots.every((_, index) => slots.has(index)))
      .map(([cycleNumber]) => cycleNumber)
      .sort((left, right) => left - right));
  }

  function toPerformanceProvenance(programOrigin, completedCycles = []) {
    const origin = normalize(programOrigin);
    if (!origin) return null;
    return freeze({
      programId: origin.programId,
      programVersionId: origin.programVersionId,
      routineId: origin.routineId,
      routineVersionId: origin.routineVersionId,
      slotId: origin.slotId,
      slotIndex: origin.slotIndex,
      cycleNumber: origin.cycleNumber,
      cycleCompleted: completedCycles.includes(origin.cycleNumber)
    });
  }

  const api = Object.freeze({
    contract: CONTRACT,
    slotIndexBase: SLOT_INDEX_BASE,
    normalize,
    snapshot,
    materializeNext,
    advanceCaptureForCompletion,
    completedCycleNumbers,
    toPerformanceProvenance
  });
  Object.defineProperty(scope, 'BigGainsProgramOrigin', { configurable: false, enumerable: true, value: api, writable: false });
})(typeof window === 'object' ? window : globalThis);

((scope) => {
  'use strict';

  const list = value => Array.isArray(value) ? value : [];
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' ? value.trim() : '';
  const validDate = value => Number.isFinite(Date.parse(value));

  function exactPerformedExercise(workout, exerciseId, catalog) {
    return list(workout?.exercises).find(exercise => {
      const persisted = exercise?.definitionId || exercise?.canonicalId || exercise?.id;
      return typeof persisted === 'string' && catalog.canonicalIdFor(persisted) === exerciseId;
    }) || null;
  }

  function progressionDecisions(goal) {
    const current = goal?.progressionState?.current;
    return [current, ...list(goal?.progressionState?.trace)]
      .filter(isRecord)
      .filter((decision, index, all) => text(decision.decisionId)
        && all.findIndex(candidate => candidate?.decisionId === decision.decisionId) === index);
  }

  function decisionForExposure(decisions, exposureId) {
    return decisions
      .filter(decision => list(decision.selectedExposureIds).includes(exposureId))
      .sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt) || left.decisionId.localeCompare(right.decisionId))[0] || null;
  }

  function evidenceCutoff({ goal, programVersion, workouts }) {
    const candidates = [goal?.updatedAt, programVersion?.createdAt, ...list(workouts).map(workout => workout?.completedAt)]
      .filter(validDate).map(value => new Date(value).toISOString()).sort();
    return candidates.at(-1) || null;
  }

  function compatibleDestinations(programVersion, routineVersions, exerciseId) {
    const byId = new Map(list(routineVersions).map(routine => [routine.routineVersionId, routine]));
    return list(programVersion?.slots).filter(slot => {
      const routine = byId.get(slot.routineVersionId);
      return routine && !list(routine.exercises).some(exercise => exercise.exerciseId === exerciseId);
    }).map(slot => slot.slotId);
  }

  function buildInput({ programVersion, routineVersions, programAnalysis, goals, workouts, catalog, programStatus = 'unknown' }) {
    const linked = list(goals).filter(goal => goal?.status === 'active' && list(programVersion?.priorityGoalIds).includes(goal.goalId));
    const goal = linked.length === 1 ? linked[0] : null;
    const cutoff = evidenceCutoff({ goal, programVersion, workouts });
    if (!goal) {
      return {
        programVersion,
        routineVersions,
        programAnalysis,
        goals,
        performanceEvidence: {
          contract: 'big-gains.program-performance-evidence.v1',
          availability: 'unavailable',
          reasonCode: 'INSUFFICIENT_COMPARABLE_EVIDENCE',
          programVersionId: programVersion?.programVersionId || null,
          evidenceCutoff: cutoff,
          exposures: []
        },
        goalProgressionEvidence: null,
        catalog,
        options: { programStatus, evaluatedAt: cutoff }
      };
    }
    const decisions = progressionDecisions(goal);
    const exactWorkouts = list(workouts).flatMap(workout => {
      const performed = exactPerformedExercise(workout, goal.exerciseId, catalog);
      return performed ? [{ workout, performed }] : [];
    });
    const originApi = scope.BigGainsProgramOrigin;
    const completedCycles = originApi?.completedCycleNumbers({
      workouts,
      programVersion,
      accountId: goal.accountId,
      profileId: goal.profileId
    }) || [];
    const provenanced = exactWorkouts.flatMap(({ workout, performed }) => {
      const origin = originApi?.normalize(workout.programOrigin, { accountId: goal.accountId, profileId: goal.profileId });
      const slot = origin && programVersion.slots?.[origin.slotIndex];
      if (!origin || origin.programId !== programVersion.programId
        || origin.programVersionId !== programVersion.programVersionId
        || slot?.slotId !== origin.slotId || slot?.routineId !== origin.routineId
        || slot?.routineVersionId !== origin.routineVersionId) return [];
      return [{ workout, performed, origin }];
    });
    const exposures = provenanced.map(({ workout, performed, origin }) => {
      const decision = decisionForExposure(decisions, workout.id);
      const workingSets = list(performed.sets).filter(set => set.warmup !== true);
      const completed = workingSets.length > 0 && workingSets.every(set => set.completed === true);
      return {
        exposureId: workout.id,
        workoutId: workout.id,
        accountId: goal.accountId,
        profileId: goal.profileId,
        exerciseId: goal.exerciseId,
        completedAt: workout.completedAt,
        comparable: Boolean(completed && decision),
        exclusionReasonCode: completed ? 'GOALS_COMPARABILITY_UNPROVEN' : 'INCOMPLETE_WORKING_SETS',
        progressionReasonCode: decision?.reasonCode || null,
        programProvenance: originApi.toPerformanceProvenance(origin, completedCycles)
      };
    });
    const adjustments = decisions.filter(decision => decision.reasonCode === 'ADJUST_REPEATED_MISS' && validDate(decision.issuedAt))
      .map(decision => ({ eventId: decision.decisionId, reasonCode: decision.reasonCode, issuedAt: new Date(decision.issuedAt).toISOString(), adopted: true }));
    const opportunities = adjustments.flatMap(adjustment => exposures
      .filter(exposure => exposure.comparable && Date.parse(exposure.completedAt) > Date.parse(adjustment.issuedAt))
      .map(exposure => ({ exposureId: exposure.exposureId, adjustmentEventId: adjustment.eventId })));
    const provenanceInsufficient = exactWorkouts.length > provenanced.length && provenanced.length < 4;
    return {
      programVersion,
      routineVersions,
      programAnalysis,
      goals,
      performanceEvidence: {
        contract: 'big-gains.program-performance-evidence.v1',
        availability: provenanceInsufficient ? 'unavailable' : 'available',
        reasonCode: provenanceInsufficient ? 'BLOCK_PROVENANCE_UNAVAILABLE' : null,
        programVersionId: programVersion.programVersionId,
        evidenceCutoff: cutoff,
        exposures
      },
      goalProgressionEvidence: {
        contract: 'big-gains.goals-progression-evidence.v1',
        goalId: goal.goalId,
        exerciseId: goal.exerciseId,
        policy: { id: 'strength_double_progression_v1', version: 1 },
        adjustmentEvents: adjustments,
        postAdjustmentOpportunities: opportunities
      },
      catalog,
      options: {
        goalId: goal.goalId,
        programStatus,
        evaluatedAt: cutoff,
        compatibleDestinationSlotIds: compatibleDestinations(programVersion, routineVersions, goal.exerciseId),
        currentBase: {
          programVersionId: programVersion.programVersionId,
          goalId: goal.goalId,
          routinePins: list(programVersion.slots).map(slot => ({ slotId: slot.slotId, routineVersionId: slot.routineVersionId }))
        }
      }
    };
  }

  function evaluateCurrent(context) {
    const engine = scope.BigGainsProgrammingEngine;
    if (!engine?.evaluate || !isRecord(context)) return null;
    return engine.evaluate(buildInput(context));
  }

  function markup(result, escapeHtml = value => String(value)) {
    if (!result) return '';
    const escape = value => escapeHtml(value == null ? '' : String(value));
    if (result.status === 'proposal') {
      const allocation = result.perExposureSetAllocation.map(item => `${item.workingSets} sets in position ${item.programPosition}`).join(' + ');
      const evidence = list(result.evidence?.facts).map(fact => `<li><strong>${escape(fact.value)} / ${escape(fact.required)}</strong><span>${escape(fact.name)}</span></li>`).join('');
      const variant = result.auxiliaryRoutineVariantRequired
        ? '<p class="programming-review-variant"><strong>Auxiliary Routine variant required</strong><span>Only the selected repeated slot receives the minimum successor diff. Unrelated exercises remain unchanged.</span></p>'
        : '';
      return `<section class="panel programming-review programming-review-proposal" data-programming-review-status="proposal" data-proposal-id="${escape(result.proposalId)}" aria-labelledby="programmingReviewTitle">
        <div class="plan-card-head"><div><span class="label">Programming review · proposal</span><h3 id="programmingReviewTitle">Redistribute ${escape(result.targetScope.exerciseName)} exposure</h3><p>${escape(result.explanation.summary)}</p></div><span class="plan-status is-linked">Approval required</span></div>
        <div class="programming-review-diff"><article><span>Before</span><strong>${escape(result.beforeExposureCount)} exposure</strong><small>${escape(result.totalCycleWorkingSetsBefore)} total cycle sets</small></article><span aria-hidden="true">→</span><article><span>After</span><strong>${escape(result.afterExposureCount)} exposures</strong><small>${escape(result.totalCycleWorkingSetsAfter)} total cycle sets · ${escape(allocation)}</small></article></div>
        ${variant}
        <details><summary>Evidence and exact review trace</summary><ul class="programming-review-evidence">${evidence}</ul><p>${escape(result.expectedConservativeEffect)}</p><p class="plan-muted">Base Program ${escape(result.baseProgramVersionId)} · Future unmaterialized sessions only</p></details>
        <div class="programming-review-actions"><button type="button" class="primary" data-programming-disposition="approve" disabled title="Application wiring follows in PE-1C">Approve</button><button type="button" class="secondary" data-programming-disposition="reject">Reject</button><button type="button" class="ghost" data-programming-disposition="later">Later</button></div>
        <p class="programming-review-parked">Approve is parked: atomic successor-version application and stale-base wiring follow in PE-1C.</p>
        <p class="programming-review-disposition" data-programming-disposition-status hidden></p>
      </section>`;
    }
    if (result.status === 'no_change') {
      return `<section class="panel programming-review" data-programming-review-status="no_change"><div class="plan-card-head"><div><span class="label">Programming review · no change</span><h3>${escape(result.targetScope?.exerciseName || 'Current Program')}</h3><p>${escape(result.explanation.summary)}</p></div><span class="plan-status is-active">No change</span></div><p class="plan-muted">${escape(result.futureReviewTrigger)}</p></section>`;
    }
    return `<section class="panel programming-review" data-programming-review-status="unavailable"><div class="plan-card-head"><div><span class="label">Programming review · unavailable</span><h3>${escape(result.targetScope?.exerciseName || 'Evidence boundary')}</h3><p>${escape(result.explanation.summary)}</p></div><span class="plan-status">Unavailable</span></div><p class="programming-review-resolution">${escape(result.resolutionAction || 'Recompute when the required exact evidence is available.')}</p><details><summary>Reason</summary><code>${escape(result.primaryReasonCode)}</code></details></section>`;
  }

  function recordDisposition(container, disposition) {
    if (!container || !['reject', 'later'].includes(disposition)) return false;
    const status = container.querySelector('[data-programming-disposition-status]');
    if (!status) return false;
    status.hidden = false;
    status.textContent = disposition === 'reject'
      ? 'Rejected for this view. No Program, Routine, Goal, workout, or History fact changed.'
      : 'Saved for later in this view only. The proposal must be recomputed and stale-checked before any future approval.';
    container.querySelectorAll('[data-programming-disposition]').forEach(button => { button.disabled = true; });
    container.dataset.programmingDisposition = disposition;
    return true;
  }

  const api = Object.freeze({ buildInput, evaluateCurrent, markup, recordDisposition });
  Object.defineProperty(scope, 'BigGainsProgrammingReview', { configurable: false, enumerable: true, value: api, writable: false });
})(typeof window === 'object' ? window : globalThis);

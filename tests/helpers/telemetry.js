import {expect} from '@playwright/test';
// Recovery still forbids every training-data write. Only this exact, validated
// telemetry RPC is handled separately; malformed or expanded payloads fail QA.
export function assertTelemetryRequest(request) {
  expect(request.method()).toBe('POST');
  const body=request.postDataJSON();expect(Object.keys(body)).toEqual(['event']);
  const event=body.event;
  expect(Object.keys(event).sort()).toEqual(['id','event_name','profile_client_id','release','platform','browser','mode','surface','category','training_mode',...(event.event_name==='app_error'?['error_code','module_id','lifecycle','error_class','diagnostic_fingerprint']:[]),...(/^conflict_(detected|presented|resolved)$/.test(event.event_name)?['episode_id']:[])].sort());
  expect(JSON.stringify(event).length).toBeLessThanOrEqual(1024);
  expect(event.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(['app_open','workout_started','workout_completed','program_adopted','exercise_swapped','stale_session_recovery_shown','stale_session_resumed','stale_session_finished','stale_session_discarded','recovery_required','conflict_detected','conflict_presented','conflict_resolved','app_error']).toContain(event.event_name);
  expect(event.release).toBe('v116-strength-history-correctness');
  expect(['ios','android','windows','mac','linux','other']).toContain(event.platform);
  expect(['edge','firefox','chrome','safari','other']).toContain(event.browser);
  expect(['standalone','browser']).toContain(event.mode);
  expect(['app','train','program','recovery','onboarding']).toContain(event.surface);
  expect(['none','javascript','promise','resource','sync','program','unknown']).toContain(event.category);
  expect(['unknown','freeform','program']).toContain(event.training_mode);
  if(event.event_name==='app_error'){expect(event.diagnostic_fingerprint).toMatch(/^BG-[0-9A-F]{8}$/);expect(['unknown','startup','interactive','background','recovery']).toContain(event.lifecycle);expect(event.module_id).toMatch(/^(unknown|[a-z0-9.-]+)$/);}
  if(event.episode_id)expect(event.episode_id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(event.profile_client_id).toMatch(/^[a-z0-9-]{1,100}$/i);
}

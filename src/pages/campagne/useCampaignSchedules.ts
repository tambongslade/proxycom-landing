import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSchedule,
  deleteSchedule,
  fetchCampaignSchedules,
  fetchCampaignSpots,
  materializeDay,
  replicateSchedules,
  type CreateSchedulePayload,
  type MaterializeResult,
  type ReplicateResult,
  type Spot,
  type SpotSchedule,
} from './builderApi';

// Shared state for the campaign builder and the schedule editor.
//
// `date` selects which plan is shown: null = the base "every-day" plan,
// "YYYY-MM-DD" = that day's override rows.
//
// There is no guaranteed GET for a campaign's schedules, so the merged view is:
// server listing (if the endpoint exists) or schedules embedded in the spots
// response, plus everything created in this session, minus deletions — always
// filtered to the selected plan.
export const useCampaignSchedules = (
  campaignId: string | undefined,
  enabled: boolean,
  date: string | null = null
) => {
  const queryClient = useQueryClient();

  const spotsQuery = useQuery<Spot[], Error>({
    queryKey: ['campaignSpots', campaignId],
    queryFn: () => fetchCampaignSpots(campaignId!),
    enabled: enabled && !!campaignId,
  });

  const serverQuery = useQuery<SpotSchedule[] | null, Error>({
    queryKey: ['campaignSchedules', campaignId, date ?? 'base'],
    queryFn: () => fetchCampaignSchedules(campaignId!, date),
    enabled: enabled && !!campaignId,
  });

  const [sessionSchedules, setSessionSchedules] = useState<SpotSchedule[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);

  const matchesPlan = useMemo(
    () => (s: SpotSchedule) => (date ? s.schedule_date === date : !s.schedule_date),
    [date]
  );

  const schedules = useMemo<SpotSchedule[]>(() => {
    const embedded = (spotsQuery.data ?? []).flatMap((s) => s.schedules ?? []);
    const base = serverQuery.data ?? embedded;
    const byId = new Map<number, SpotSchedule>();
    [...base, ...sessionSchedules].filter(matchesPlan).forEach((s) => byId.set(s.id, s));
    removedIds.forEach((id) => byId.delete(id));
    return [...byId.values()];
  }, [serverQuery.data, spotsQuery.data, sessionSchedules, removedIds, matchesPlan]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['campaignSchedules', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['campaignSpots', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['scheduleDates', campaignId] });
  };

  const addSchedule = useMutation<SpotSchedule, Error, CreateSchedulePayload>({
    mutationFn: (payload) => createSchedule(campaignId!, payload),
    onSuccess: (created, payload) => {
      // Some backends echo the row without schedule_date — keep the plan tag.
      const tagged = { ...created, schedule_date: created.schedule_date ?? payload.schedule_date ?? null };
      setSessionSchedules((prev) => [...prev, tagged]);
      setRemovedIds((prev) => prev.filter((id) => id !== created.id));
      invalidate();
    },
  });

  const removeSchedule = useMutation<void, Error, number>({
    mutationFn: (scheduleId) => deleteSchedule(campaignId!, scheduleId),
    onSuccess: (_data, scheduleId) => {
      setRemovedIds((prev) => [...prev, scheduleId]);
      setSessionSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      invalidate();
    },
  });

  const replicate = useMutation<
    ReplicateResult,
    Error,
    { sourceStationId: number; targets: number[] | 'all' }
  >({
    mutationFn: ({ sourceStationId, targets }) =>
      replicateSchedules(campaignId!, sourceStationId, targets),
    onSuccess: invalidate,
  });

  const materialize = useMutation<
    MaterializeResult,
    Error,
    { date: string; radioStationId?: number }
  >({
    mutationFn: ({ date: day, radioStationId }) => materializeDay(campaignId!, day, radioStationId),
    onSuccess: invalidate,
  });

  return {
    spots: spotsQuery.data ?? [],
    spotsLoading: spotsQuery.isLoading,
    schedules,
    schedulesKnown: serverQuery.data !== null, // false → only session/embedded data visible
    addSchedule,
    removeSchedule,
    replicate,
    materialize,
  };
};

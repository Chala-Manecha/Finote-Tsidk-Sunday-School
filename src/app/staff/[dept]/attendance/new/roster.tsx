'use client';
import { AttendanceRoster, type RosterMember } from '@/components/attendance-roster';
import type { SessionType } from '@/lib/constants';
import { createSession } from '../actions';

export function NewSessionRoster(props: {
  members: RosterMember[];
  type: SessionType;
  date: string;
  time: string | null;
}) {
  return (
    <AttendanceRoster
      members={props.members}
      initial={{}}
      startLocked={false}
      saveLabel="ክትትል አስቀምጥ"
      onSave={(statuses) => createSession({ type: props.type, date: props.date, time: props.time, statuses })}
    />
  );
}
